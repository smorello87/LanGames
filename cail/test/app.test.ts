import { beforeAll, describe, expect, it } from "vitest";
import { createTestIdentityIssuer, TEST_SUBJECTS, type TestIdentityIssuer } from "@cuny-ai-lab/cail-identity/testing";
import { quotaSnapshotBody } from "@cuny-ai-lab/cail-client/testing";
import app from "../src/app";
import type { Env } from "../src/env";
import { APP_AUDIENCE, LAUNCH_PATH } from "../src/identity";
import { DEFAULT_MODEL } from "../src/models";

// Real: Hono app, CAIL Identity verification against a real signing key, the
// CAIL Client. Substituted: the Gateway service binding, KV, and the asset
// binding. Nothing here proves a live Gateway call or a Doorway mount.

const ORIGIN = "https://tools.ailab.gc.cuny.edu";
let issuer: TestIdentityIssuer;

beforeAll(async () => {
  issuer = await createTestIdentityIssuer();
});

function memoryKv(): KVNamespace {
  const data = new Map<string, string>();
  return {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string) => void data.set(key, value),
  } as unknown as KVNamespace;
}

interface FakeGateway extends Fetcher {
  calls: Request[];
}

function fakeGateway(handler: (request: Request) => Response | Promise<Response>): FakeGateway {
  const calls: Request[] = [];
  return {
    calls,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      calls.push(request);
      return handler(request);
    },
  } as unknown as FakeGateway;
}

function chatCompletion(text: string, finishReason = "stop"): Response {
  return Response.json({
    id: "chatcmpl-test",
    object: "chat.completion",
    model: "test",
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: finishReason }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}

function env(gateway: Fetcher, overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: async (request: Request) => new Response(`asset:${new URL(request.url).pathname}`, { headers: { "content-type": "text/html" } }) } as unknown as Fetcher,
    GATEWAY: gateway,
    CACHE: memoryKv(),
    CAIL_REQUIRE_IDENTITY: "true",
    CAIL_IDENTITY_JWKS: issuer.jwksJson,
    CAIL_IDENTITY_ISSUER: issuer.issuer,
    CAIL_CANONICAL_ORIGIN: ORIGIN,
    ...overrides,
  };
}

async function legs(subject = TEST_SUBJECTS.alice, gatewaySubject = subject) {
  return {
    "x-cail-identity-jwt": await issuer.mintIdentityJwt({ audience: APP_AUDIENCE, subject }),
    "x-cail-gateway-identity-jwt": await issuer.mintIdentityJwt({ audience: "cail:gateway", subject: gatewaySubject }),
  };
}

function post(path: string, body: unknown, headers: Record<string, string>): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const noGateway = fakeGateway(() => new Response("unexpected", { status: 500 }));

describe("identity boundary", () => {
  it("answers an anonymous API call with 401 and the launch path, before any model call", async () => {
    const gateway = fakeGateway(() => chatCompletion("[]"));
    const response = await app.fetch(post("/langames/api/generate", { prompt: "x", maxTokens: 10 }, {}), env(gateway));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string; launch: string } };
    expect(body.error.code).toBe("authentication_required");
    expect(body.error.launch).toBe(LAUNCH_PATH);
    expect(gateway.calls).toHaveLength(0);
  });

  it("refuses an app leg minted for another tool", async () => {
    const headers = await legs();
    headers["x-cail-identity-jwt"] = await issuer.mintIdentityJwt({ audience: "cail:media-tools", subject: TEST_SUBJECTS.alice });
    const response = await app.fetch(new Request(`${ORIGIN}/langames/api/session`, { headers }), env(noGateway));
    expect(response.status).toBe(401);
  });

  it("refuses a gateway leg that names another person", async () => {
    const headers = await legs(TEST_SUBJECTS.alice, TEST_SUBJECTS.bob);
    const response = await app.fetch(new Request(`${ORIGIN}/langames/api/session`, { headers }), env(noGateway));
    expect(response.status).toBe(401);
  });

  it("reports a broken verifier configuration as 503, not 401", async () => {
    const response = await app.fetch(new Request(`${ORIGIN}/langames/api/session`, { headers: await legs() }), env(noGateway, { CAIL_IDENTITY_JWKS: "not json" }));
    expect(response.status).toBe(503);
  });

  it("refuses a cross-origin write even with valid legs", async () => {
    const response = await app.fetch(post("/langames/api/generate", { prompt: "x", maxTokens: 10 }, { ...(await legs()), origin: "https://evil.example" }), env(noGateway));
    expect(response.status).toBe(403);
  });

  it("tells a signed-in browser it is in CAIL mode", async () => {
    const response = await app.fetch(new Request(`${ORIGIN}/langames/api/session`, { headers: await legs() }), env(noGateway));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { cail: boolean; defaultModel: string; models: { id: string }[] };
    expect(body.cail).toBe(true);
    expect(body.models.map((m) => m.id)).toContain(body.defaultModel);
  });
});

describe("quota", () => {
  it("returns the Gateway's own snapshot for the signed-in person", async () => {
    // The package's own valid snapshot: its parser is strict about consistency.
    const snapshot = quotaSnapshotBody();
    const gateway = fakeGateway(() => Response.json(snapshot));
    const headers = await legs();
    const response = await app.fetch(new Request(`${ORIGIN}/langames/api/quota`, { headers }), env(gateway));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
    expect(gateway.calls[0]!.headers.get("x-cail-identity-jwt")).toBe(headers["x-cail-gateway-identity-jwt"]);
  });
});

describe("generate", () => {
  it("makes one Gateway call with the person's own gateway leg and the pinned system message", async () => {
    const gateway = fakeGateway(() => chatCompletion('["amore"]'));
    const headers = await legs();
    const response = await app.fetch(post("/langames/api/generate", { prompt: "five-letter words", maxTokens: 500 }, headers), env(gateway));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: '["amore"]', truncated: false, model: DEFAULT_MODEL });

    expect(gateway.calls).toHaveLength(1);
    const call = gateway.calls[0]!;
    expect(new URL(call.url).pathname).toBe("/v1/chat/completions");
    // The CAIL Client presents a JWT credential in this header, never as a
    // Bearer token, and it must be the gateway leg rather than the app leg.
    expect(call.headers.get("x-cail-identity-jwt")).toBe(headers["x-cail-gateway-identity-jwt"]);
    expect(call.headers.get("authorization")).toBeNull();
    expect(call.headers.get("x-cail-app")).toBe("langames");
    const sent = (await call.json()) as { model: string; max_tokens: number; messages: { role: string; content: string }[] };
    expect(sent.model).toBe(DEFAULT_MODEL);
    expect(sent.max_tokens).toBe(500);
    expect(sent.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(sent.messages[1]!.content).toBe("five-letter words");
  });

  it("rejects a model outside the server-owned list without calling the Gateway", async () => {
    const gateway = fakeGateway(() => chatCompletion("x"));
    const response = await app.fetch(post("/langames/api/generate", { prompt: "x", maxTokens: 10, model: "openai/gpt-5.4" }, await legs()), env(gateway));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("model_not_allowed");
    expect(gateway.calls).toHaveLength(0);
  });

  it.each([
    ["an empty prompt", { prompt: " ", maxTokens: 10 }],
    ["an oversized prompt", { prompt: "x".repeat(8001), maxTokens: 10 }],
    ["an oversized token budget", { prompt: "x", maxTokens: 100000 }],
    ["a non-integer token budget", { prompt: "x", maxTokens: 1.5 }],
  ])("rejects %s without calling the Gateway", async (_label, body) => {
    const gateway = fakeGateway(() => chatCompletion("x"));
    const response = await app.fetch(post("/langames/api/generate", body, await legs()), env(gateway));
    expect(response.status).toBe(400);
    expect(gateway.calls).toHaveLength(0);
  });

  it("passes a quota denial through as non-retryable and does not retry", async () => {
    const gateway = fakeGateway(() =>
      // `param` is required for the CAIL Client to read this as a CAIL envelope.
      Response.json({ error: { code: "quota_exceeded", type: "quota", message: "Monthly allowance reached", param: null, retry: false } }, { status: 429, headers: { "x-should-retry": "false" } }),
    );
    const response = await app.fetch(post("/langames/api/generate", { prompt: "x", maxTokens: 10 }, await legs()), env(gateway));
    expect(response.status).toBe(429);
    expect(response.headers.get("x-should-retry")).toBe("false");
    const body = (await response.json()) as { error: { code: string; retryable: boolean } };
    expect(body.error).toMatchObject({ code: "quota_exceeded", retryable: false });
    expect(gateway.calls).toHaveLength(1);
  });

  it("reports a reasoning model that spent its whole budget as 422, not as empty success", async () => {
    const gateway = fakeGateway(() => chatCompletion("", "length"));
    const response = await app.fetch(post("/langames/api/generate", { prompt: "x", maxTokens: 10 }, await legs()), env(gateway));
    expect(response.status).toBe(422);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("model_output_truncated");
  });
});

describe("shared content", () => {
  const content = { language: "Italian", difficulty: "beginner", wordle: ["amore"] };

  it("stores for a signed-in person and serves the link's content to an anonymous student", async () => {
    const shared = env(noGateway);
    const stored = await app.fetch(post("/langames/api/store-content", content, await legs()), shared);
    expect(stored.status).toBe(200);
    const { id, url } = (await stored.json()) as { id: string; url: string };
    expect(url).toBe(`${ORIGIN}/langames/index.html?id=${id}`);

    const fetched = await app.fetch(new Request(`${ORIGIN}/langames/api/get-content?id=${id}`), shared);
    expect(fetched.status).toBe(200);
    expect(await fetched.json()).toEqual(content);
  });

  it("does not let an anonymous caller store", async () => {
    const response = await app.fetch(post("/langames/api/store-content", content, {}), env(noGateway));
    expect(response.status).toBe(401);
  });

  it("limits stores per person, not per IP", async () => {
    const shared = env(noGateway);
    const alice = await legs(TEST_SUBJECTS.alice);
    for (let i = 0; i < 10; i++) expect((await app.fetch(post("/langames/api/store-content", content, alice), shared)).status).toBe(200);
    expect((await app.fetch(post("/langames/api/store-content", content, alice), shared)).status).toBe(429);
    expect((await app.fetch(post("/langames/api/store-content", content, await legs(TEST_SUBJECTS.bob)), shared)).status).toBe(200);
  });
});

describe("pages", () => {
  it("serves assets under the mount prefix with the page policy", async () => {
    const response = await app.fetch(new Request(`${ORIGIN}/langames/wordle-adaptive`), env(noGateway));
    expect(await response.text()).toBe("asset:/wordle-adaptive");
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("keeps the asset layer's .html redirects inside the mount", async () => {
    const assets = { fetch: async () => new Response(null, { status: 307, headers: { location: "/llm-settings" } }) } as unknown as Fetcher;
    const response = await app.fetch(new Request(`${ORIGIN}/langames/llm-settings.html`), env(noGateway, { ASSETS: assets }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/langames/llm-settings");
  });

  it("does not serve paths outside the mount", async () => {
    expect((await app.fetch(new Request(`${ORIGIN}/media/`), env(noGateway))).status).toBe(404);
  });

  it("withholds readiness reasons from the anonymous probe", async () => {
    const response = await app.fetch(new Request(`${ORIGIN}/health/ready`), env(noGateway, { CAIL_IDENTITY_JWKS: "" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, status: "not_ready", version: null });
  });
});
