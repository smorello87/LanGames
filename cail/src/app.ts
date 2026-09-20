import { Hono } from "hono";
import { CailError } from "@cuny-ai-lab/cail-client";
import { correlationFromHeaders, type CailCorrelation } from "@cuny-ai-lab/cail-log";
import { readContent, storeContent, MAX_CONTENT_BYTES } from "../../src/content-store";
import { BASE_PATH, canonicalOrigin, type Env } from "./env";
import { authenticate, type Principal } from "./identity";
import { originAllowed } from "./csrf";
import { appErrorFrom, appErrorResponse, gatewayClient, readChatCompletion, type AppError, type ChatCompletionResult } from "./gateway";
import { DEFAULT_MODEL, MAX_OUTPUT_TOKENS, MAX_PROMPT_CHARS, MODELS, SYSTEM_PROMPT, isAllowedModel } from "./models";
import { checkConfigurationReadiness } from "./readiness";

export interface AppVariables {
  requestId: string;
  correlation: CailCorrelation;
  principal: Principal;
}

type AppEnv = { Bindings: Env; Variables: AppVariables };

const app = new Hono<AppEnv>();

/**
 * Doorway sets no policy on a tool response it proxies, so this page's policy
 * comes from here. The pages still use inline scripts and `onclick` handlers,
 * hence `'unsafe-inline'` for scripts; cdnjs serves LZString and
 * googletagmanager the analytics loader.
 *
 * `connect-src 'self'` is deliberate. On the other deployments the browser
 * calls a provider directly with a key kept in localStorage. This origin is
 * shared with every other CAIL tool, so a provider key must never be stored
 * or sent from here: generation goes through /langames/api/generate only.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://www.googletagmanager.com",
  "connect-src 'self' https://www.google-analytics.com",
  "img-src 'self' data: https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

function isHtml(contentType: string | null): boolean {
  return contentType?.toLowerCase().startsWith("text/html") === true;
}

function cacheControlFor(path: string, status: number, contentType: string | null): string {
  if (status >= 400) return "no-store";
  const dynamic = path.startsWith(`${BASE_PATH}/api/`) || path.startsWith("/health/");
  if (dynamic) return "no-store";
  return isHtml(contentType) ? "private, max-age=300" : "public, max-age=300";
}

app.use("*", async (c, next) => {
  const correlation = correlationFromHeaders(c.req.raw);
  c.set("correlation", correlation);
  c.set("requestId", correlation.request_id);
  await next();
  // Responses from bindings can have immutable headers in workerd.
  const response = new Response(c.res.body, c.res);
  const contentType = response.headers.get("content-type");
  response.headers.set("x-cail-request-id", correlation.request_id);
  response.headers.set("cache-control", cacheControlFor(new URL(c.req.url).pathname, response.status, contentType));
  response.headers.set("x-content-type-options", "nosniff");
  if (isHtml(contentType)) response.headers.set("content-security-policy", CONTENT_SECURITY_POLICY);
  c.res = response;
});

app.get("/health/live", (c) => c.json({ status: "alive" }));

// The verdict is public because Doorway's release probe runs unauthenticated;
// the reasons are not, and go to the LanGamesReadiness RPC instead.
app.get("/health/ready", async (c) => {
  const result = await checkConfigurationReadiness(c.env);
  const version = c.env.CF_VERSION_METADATA?.id ?? null;
  return result.ok ? c.json({ ok: true, status: "ready", version }) : c.json({ ok: false, status: "not_ready", version }, 503);
});

function fail(c: { get: (key: "requestId") => string }, error: AppError, gatewayRequestId?: string | null): Response {
  return appErrorResponse(error, c.get("requestId"), gatewayRequestId);
}

function invalid(message: string): AppError {
  return { code: "invalid_request", message, status: 400, retryable: false };
}

// Public: a student opening a share link has no CAIL session. Doorway routes
// this exact path without identity; everything else under /api is protected.
app.get(`${BASE_PATH}/api/get-content`, async (c) => {
  const result = await readContent(c.env.CACHE, c.req.query("id"));
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.content);
});

const api = new Hono<AppEnv>();

api.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD" && !originAllowed(c.req.raw, c.env)) {
    return fail(c, { code: "origin_mismatch", message: "Cross-origin requests are not allowed.", status: 403, retryable: false });
  }
  const auth = await authenticate(c.req.raw, c.env);
  if (!auth.ok) return auth.response;
  c.set("principal", auth.principal);
  await next();
});

// The frontend's mode probe: 200 here means "generate through CAIL".
api.get("/session", (c) => c.json({ cail: true, models: MODELS, defaultModel: DEFAULT_MODEL }));

api.get("/quota", async (c) => {
  try {
    const snapshot = await gatewayClient(c.env, c.get("correlation")).getQuota(c.get("principal").credential, { signal: c.req.raw.signal });
    return c.json(snapshot);
  } catch (error) {
    return fail(c, appErrorFrom(error));
  }
});

async function readBoundedText(request: Request, maxBytes: number): Promise<string | null> {
  // Doorway strips content-length over the service binding, so count bytes.
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function isTransportFailure(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (error instanceof CailError) return true;
  if (error instanceof SyntaxError) return false;
  const name = error instanceof Error ? error.name : "";
  return name === "AbortError" || name === "TimeoutError" || name === "TypeError";
}

/**
 * One generation call on the signed-in person's allowance. The browser sends
 * the section prompt it already builds for every deployment; this route bounds
 * it, pins the system message and the model list, and makes exactly one
 * Gateway attempt. Nothing is retried here and nothing is stored.
 */
api.post("/generate", async (c) => {
  const raw = await readBoundedText(c.req.raw, 64 * 1024);
  if (raw === null) return fail(c, { code: "payload_too_large", message: "Request body exceeds 64 KiB.", status: 413, retryable: false });
  let fields: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    fields = parsed as Record<string, unknown>;
  } catch {
    return fail(c, invalid("Send a JSON object body."));
  }

  const prompt = fields.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) return fail(c, invalid("prompt is required."));
  if (prompt.length > MAX_PROMPT_CHARS) return fail(c, invalid(`prompt exceeds ${MAX_PROMPT_CHARS} characters.`));
  const maxTokens = fields.maxTokens;
  if (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_OUTPUT_TOKENS) {
    return fail(c, invalid(`maxTokens must be an integer from 1 to ${MAX_OUTPUT_TOKENS}.`));
  }
  const model = fields.model === undefined ? DEFAULT_MODEL : fields.model;
  if (!isAllowedModel(model)) {
    return fail(c, { code: "model_not_allowed", message: "That model is not available in LanGames.", status: 400, retryable: false });
  }

  const signal = c.req.raw.signal;
  let completion: ChatCompletionResult;
  try {
    const response = await gatewayClient(c.env).chatCompletions(
      {
        model,
        stream: false,
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      },
      c.get("principal").credential,
      { signal, correlation: c.get("correlation") },
    );
    completion = await readChatCompletion(response);
  } catch (error) {
    // A reply that arrived whole but was not JSON is this service's problem.
    if (!isTransportFailure(error, signal)) throw error;
    return fail(c, appErrorFrom(error));
  }

  if (completion.text.length === 0) {
    const truncated = completion.finishReason === "length";
    return fail(
      c,
      truncated
        ? { code: "model_output_truncated", message: "The model reached its output limit before producing any text. Try another model.", status: 422, retryable: false }
        : { code: "empty_model_response", message: "The model returned no text.", status: 502, retryable: false },
      completion.gatewayRequestId,
    );
  }
  return c.json({ text: completion.text, truncated: completion.finishReason === "length", model });
});

// Storing is a signed-in action here, limited per person rather than per IP.
api.post("/store-content", async (c) => {
  const body = await readBoundedText(c.req.raw, MAX_CONTENT_BYTES);
  if (body === null) return c.json({ error: "Content too large (max 50KB)" }, 413);
  const result = await storeContent(c.env.CACHE, body, c.get("principal").subject);
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json({
    success: true,
    id: result.id,
    url: `${canonicalOrigin(c.env)}${BASE_PATH}/index.html?id=${result.id}`,
    expires: "365 days",
    expiresDate: result.expiresDate,
  });
});

api.all("*", (c) => fail(c, { code: "not_found", message: "No such API route.", status: 404, retryable: false }));

app.route(`${BASE_PATH}/api`, api);

app.all("*", async (c) => {
  const url = new URL(c.req.url);
  if (url.pathname === BASE_PATH) return c.redirect(`${BASE_PATH}/`, 301);
  if (!url.pathname.startsWith(`${BASE_PATH}/`)) return c.notFound();
  url.pathname = url.pathname.slice(BASE_PATH.length) || "/";
  const asset = await c.env.ASSETS.fetch(new Request(url.toString(), { method: c.req.method, headers: c.req.raw.headers }));
  // The asset layer canonicalises /x.html to /x relative to its own root.
  // Put the mount prefix back so the redirect stays inside /langames.
  const location = asset.headers.get("location");
  if (asset.status >= 300 && asset.status < 400 && location?.startsWith("/") && !location.startsWith(`${BASE_PATH}/`)) {
    const headers = new Headers(asset.headers);
    headers.set("location", `${BASE_PATH}${location}`);
    return new Response(null, { status: asset.status, headers });
  }
  return asset;
});

app.onError((_error, c) =>
  c.json({ error: { code: "internal_error", message: "Internal server error", requestId: c.get("requestId"), retryable: false } }, 500),
);

export default app;
