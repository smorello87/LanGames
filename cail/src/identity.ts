import {
  CAIL_GATEWAY_AUDIENCE,
  createCailAuthError,
  loadIdentityVerifierConfig,
  readIdentityKeyring,
  serializeCailAuthError,
  verifyIdentityJwt,
  verifyKeyringGatewayJwt,
  type IdentityVerifierConfig,
  type LoadIdentityVerifierConfigResult,
} from "@cuny-ai-lab/cail-identity";
import { identityRequired, type Env } from "./env";

export const APP_AUDIENCE = "cail:langames";
export const APP_SLUG = "langames";
export const LAUNCH_PATH = "/launch/langames";
export const IDENTITY_HEADER = "x-cail-identity-jwt";

export interface Principal {
  subject: string;
  credential: { kind: "jwt" | "key"; token: string };
}

export type AuthResult = { ok: true; principal: Principal } | { ok: false; response: Response };

const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" };

export function authRequiredResponse(): Response {
  const body = createCailAuthError("authentication_required", "Sign in to continue.", LAUNCH_PATH);
  return new Response(serializeCailAuthError(body), {
    status: 401,
    headers: { ...JSON_HEADERS, "www-authenticate": 'Bearer realm="CAIL"' },
  });
}

export function misconfiguredResponse(): Response {
  const body = createCailAuthError(
    "identity_verification_misconfigured",
    "LanGames is not set up correctly right now. Email ailab@gc.cuny.edu.",
  );
  return new Response(serializeCailAuthError(body), { status: 503, headers: JSON_HEADERS });
}

const configCache = new Map<string, IdentityVerifierConfig>();

/**
 * Load a verifier config for `audience`, reusing the per-isolate cache so a
 * repeated call does not re-import the JWKS keys. A pinned `now` bypasses the
 * cache, because a config validated against a caller-supplied clock must not
 * be shared. Failures are never cached.
 */
export async function loadCachedVerifierConfig(env: Env, audience: string, now?: number): Promise<LoadIdentityVerifierConfigResult> {
  const key = `${audience}:${env.CAIL_IDENTITY_JWKS ?? ""}:${env.CAIL_IDENTITY_ISSUER ?? ""}`;
  if (now === undefined) {
    const cached = configCache.get(key);
    if (cached) return { ok: true, config: cached };
  }
  const loaded = await loadIdentityVerifierConfig({
    jwks: env.CAIL_IDENTITY_JWKS,
    issuer: env.CAIL_IDENTITY_ISSUER,
    expectedAudience: audience,
    ...(now === undefined ? {} : { now }),
  });
  if (loaded.ok && now === undefined) configCache.set(key, loaded.config);
  return loaded;
}

/**
 * Verify Doorway's two legs: the app assertion for this exact audience, and a
 * `cail:gateway` assertion for the same subject. The Gateway leg is what makes
 * a model call count against the signed-in person's own allowance.
 */
export async function authenticate(request: Request, env: Env, now?: number): Promise<AuthResult> {
  const appToken = request.headers.get(IDENTITY_HEADER);

  if (!identityRequired(env) && appToken === null) {
    const devKey = env.DEV_GATEWAY_KEY?.trim();
    if (devKey) return { ok: true, principal: { subject: "dev", credential: { kind: "key", token: devKey } } };
    return { ok: false, response: authRequiredResponse() };
  }

  const [appLoaded, gatewayLoaded] = await Promise.all([
    loadCachedVerifierConfig(env, APP_AUDIENCE, now),
    loadCachedVerifierConfig(env, CAIL_GATEWAY_AUDIENCE, now),
  ]);
  if (!appLoaded.ok || !gatewayLoaded.ok) return { ok: false, response: misconfiguredResponse() };

  if (appToken === null) return { ok: false, response: authRequiredResponse() };
  const identity = await verifyIdentityJwt(appToken, appLoaded.config);
  if (identity === null) return { ok: false, response: authRequiredResponse() };

  const keyring = readIdentityKeyring(request.headers);
  if (keyring === null || keyring.gatewayJwt === undefined) return { ok: false, response: authRequiredResponse() };
  const gatewayIdentity = await verifyKeyringGatewayJwt(keyring, gatewayLoaded.config, identity.subject);
  if (gatewayIdentity === null) return { ok: false, response: authRequiredResponse() };

  return { ok: true, principal: { subject: identity.subject, credential: { kind: "jwt", token: keyring.gatewayJwt } } };
}
