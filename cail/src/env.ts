export interface Env {
  ASSETS: Fetcher;
  GATEWAY?: Fetcher;
  CACHE: KVNamespace;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
  CAIL_IDENTITY_JWKS?: string;
  CAIL_IDENTITY_ISSUER?: string;
  CAIL_REQUIRE_IDENTITY?: string;
  CAIL_API_BASE?: string;
  CAIL_CANONICAL_ORIGIN?: string;
  DEV_GATEWAY_KEY?: string;
}

export type ConfigError =
  | "require_flag_invalid"
  | "identity_jwks_missing"
  | "identity_issuer_missing"
  | "gateway_binding_missing"
  | "content_binding_missing"
  | "dev_key_in_production"
  | "api_base_invalid";

// The API is mounted at the literal path /langames/api and Doorway preserves
// the prefix, so the base path is a constant rather than configuration.
export const BASE_PATH = "/langames";
const DEFAULT_ORIGIN = "https://tools.ailab.gc.cuny.edu";

export function identityRequired(env: Env): boolean {
  return env.CAIL_REQUIRE_IDENTITY === "true";
}

export function canonicalOrigin(env: Env): string {
  return env.CAIL_CANONICAL_ORIGIN ?? DEFAULT_ORIGIN;
}

function validHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "" && !value.includes("?") && !value.includes("#");
  } catch {
    return false;
  }
}

export function validateConfig(env: Env): { ok: true } | { ok: false; errors: ConfigError[] } {
  const flag = env.CAIL_REQUIRE_IDENTITY;
  if (flag !== undefined && flag !== "true" && flag !== "false") {
    return { ok: false, errors: ["require_flag_invalid"] };
  }
  const errors: ConfigError[] = [];
  if (identityRequired(env)) {
    if (!env.CAIL_IDENTITY_JWKS?.trim()) errors.push("identity_jwks_missing");
    if (!env.CAIL_IDENTITY_ISSUER?.trim()) errors.push("identity_issuer_missing");
    if (env.GATEWAY === undefined) errors.push("gateway_binding_missing");
    if (env.DEV_GATEWAY_KEY !== undefined && env.DEV_GATEWAY_KEY !== "") errors.push("dev_key_in_production");
  }
  // Declared non-optional, but a config mistake really does leave it undefined.
  if ((env.CACHE as unknown) === undefined || (env.CACHE as unknown) === null) errors.push("content_binding_missing");
  if (env.CAIL_API_BASE !== undefined && !validHttpsUrl(env.CAIL_API_BASE)) errors.push("api_base_invalid");
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
