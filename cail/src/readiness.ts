import { CAIL_GATEWAY_AUDIENCE, type IdentityVerifierConfigErrorReason } from "@cuny-ai-lab/cail-identity";
import { identityRequired, validateConfig, type ConfigError, type Env } from "./env";
import { APP_AUDIENCE, loadCachedVerifierConfig } from "./identity";

export type ReadinessError =
  | ConfigError
  | `identity_app_verifier_${IdentityVerifierConfigErrorReason}`
  | `identity_gateway_verifier_${IdentityVerifierConfigErrorReason}`;

export type ConfigurationReadiness = { ok: true } | { ok: false; errors: ReadinessError[] };

export async function checkConfigurationReadiness(env: Env): Promise<ConfigurationReadiness> {
  const staticConfiguration = validateConfig(env);
  if (!staticConfiguration.ok) return staticConfiguration;
  if (!identityRequired(env)) return { ok: true };

  // The same cached loader authenticated requests use, for both identity legs:
  // the first probe performs the real JWKS validation and key import.
  const [appVerifier, gatewayVerifier] = await Promise.all([
    loadCachedVerifierConfig(env, APP_AUDIENCE),
    loadCachedVerifierConfig(env, CAIL_GATEWAY_AUDIENCE),
  ]);

  const errors: ReadinessError[] = [];
  if (!appVerifier.ok) errors.push(`identity_app_verifier_${appVerifier.reason}`);
  if (!gatewayVerifier.ok) errors.push(`identity_gateway_verifier_${gatewayVerifier.reason}`);
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export interface LanGamesReadinessResult {
  ok: boolean;
  service: "langames";
  configuration: "ready" | "not_ready";
  version_id: string | null;
  tag: string | null;
  /** Present only when not ready. Withheld from the anonymous HTTP probe. */
  errors?: ReadinessError[];
}

export async function readinessResult(env: Env): Promise<LanGamesReadinessResult> {
  const configuration = await checkConfigurationReadiness(env);
  const versionId = env.CF_VERSION_METADATA?.id?.trim() || null;
  const tag = env.CF_VERSION_METADATA?.tag?.trim() || null;
  return {
    ok: configuration.ok && versionId !== null && tag !== null,
    service: "langames",
    configuration: configuration.ok ? "ready" : "not_ready",
    version_id: versionId,
    tag,
    ...(configuration.ok ? {} : { errors: configuration.errors }),
  };
}
