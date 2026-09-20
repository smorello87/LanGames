import { outboundCorrelationHeaders, type CailCorrelation } from "@cuny-ai-lab/cail-log";
import { CailError, createCailClient, type CailClient } from "@cuny-ai-lab/cail-client";
import { APP_SLUG } from "./identity";
import { identityRequired, type Env } from "./env";

const DEFAULT_BASE = "https://tools.ailab.gc.cuny.edu";

export function gatewayClient(env: Env, correlation?: CailCorrelation): CailClient {
  const binding = env.GATEWAY;
  // wrangler dev cannot reach the real cail-model-api service, so without
  // required identity the client goes to CAIL_API_BASE over the public route.
  const transport: typeof fetch = identityRequired(env)
    ? (input, init) => {
        if (!binding) throw new Error("gateway_binding_missing");
        return binding.fetch(input, init);
      }
    : (input, init) => fetch(input, init);
  // getQuota has no correlation option in cail-client 6.2.2; the fetch adapter
  // carries the same validated headers for it as for model calls.
  const fetchImpl: typeof fetch = (input, init) => {
    if (!correlation) return transport(input, init);
    const headers = new Headers(init?.headers);
    for (const [name, value] of Object.entries(outboundCorrelationHeaders(correlation))) headers.set(name, value);
    return transport(input, { ...init, headers });
  };
  return createCailClient({ app: APP_SLUG, baseUrl: env.CAIL_API_BASE ?? DEFAULT_BASE, fetchImpl });
}

export interface AppError {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
  gatewayRequestId?: string;
}

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

export function appErrorFrom(error: unknown): AppError {
  if (error instanceof CailError) {
    const status = error.status >= 400 && error.status <= 599 ? error.status : 502;
    const retryFlag = error.extras?.should_retry;
    const retryable = typeof retryFlag === "boolean" ? retryFlag : RETRYABLE_STATUS.has(status);
    return { code: error.code, message: error.message, status, gatewayRequestId: error.extras?.request_id, retryable: error.code === "quota_exceeded" ? false : retryable };
  }
  return { code: "outcome_unknown", message: "The model service did not confirm whether the request completed.", status: 502, retryable: false };
}

export function appErrorResponse(error: AppError, requestId: string, gatewayRequestId: string | null = error.gatewayRequestId ?? null): Response {
  return Response.json(
    { error: { code: error.code, message: error.message, requestId, retryable: error.retryable, gatewayRequestId } },
    { status: error.status, headers: { "cache-control": "no-store", "x-should-retry": error.retryable ? "true" : "false" } },
  );
}

interface ChatChoice {
  message?: { content?: unknown };
  finish_reason?: unknown;
}

export interface ChatCompletionResult {
  text: string;
  finishReason: string | null;
  gatewayRequestId: string | null;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : ""))
      .join("");
  }
  return "";
}

export async function readChatCompletion(response: Response): Promise<ChatCompletionResult> {
  const gatewayRequestId = response.headers.get("x-cail-request-id") ?? response.headers.get("x-request-id") ?? null;
  const body = ((await response.json()) ?? {}) as { choices?: ChatChoice[] };
  const choice = body.choices?.[0];
  const text = extractText(choice?.message?.content);
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
  return { text, finishReason, gatewayRequestId };
}
