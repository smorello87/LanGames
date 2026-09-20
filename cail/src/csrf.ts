import { canonicalOrigin, identityRequired, type Env } from "./env";

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  if (origin === canonicalOrigin(env)) return true;
  return !identityRequired(env) && LOOPBACK.test(origin);
}
