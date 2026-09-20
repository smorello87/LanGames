// Shared-content storage behind short ?id= links. Used by both Workers: the
// Kale deployment (src/index.ts) and the CAIL build (cail/src/app.ts).

export const MAX_CONTENT_BYTES = 50_000;
const CONTENT_TTL_SECONDS = 365 * 24 * 60 * 60;
const RATE_LIMIT_PER_HOUR = 10;
const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ID_PATTERN = /^[a-zA-Z0-9]{6,12}$/;

export type StoreResult =
  | { ok: true; id: string; expiresDate: string }
  | { ok: false; status: 400 | 413 | 429; error: string };

export type ReadResult =
  | { ok: true; content: Record<string, unknown> }
  | { ok: false; status: 400 | 404 | 500; error: string };

function newId(): string {
  // Rejection sampling keeps the alphabet unbiased: 248 is the largest
  // multiple of 62 that fits a byte.
  let id = "";
  while (id.length < 8) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < 248 && id.length < 8) id += ID_ALPHABET[byte % 62];
    }
  }
  return id;
}

/**
 * Validate and store one generated-content document. `rateKey` names whoever
 * is charged for the store: a client IP on the public deployment, a verified
 * subject on the CAIL build. Only a valid body consumes the limit.
 */
export async function storeContent(kv: KVNamespace, body: string, rateKey: string): Promise<StoreResult> {
  if (new TextEncoder().encode(body).byteLength > MAX_CONTENT_BYTES) {
    return { ok: false, status: 413, error: "Content too large (max 50KB)" };
  }

  let content: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    content = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
  if (!content.language || !content.difficulty) {
    return { ok: false, status: 400, error: "Invalid content: missing language or difficulty" };
  }

  const rateLimitKey = `ratelimit:${rateKey}`;
  const rateData = await kv.get(rateLimitKey);
  const count = rateData ? parseInt(rateData, 10) : 0;
  if (count >= RATE_LIMIT_PER_HOUR) {
    return { ok: false, status: 429, error: "Rate limit exceeded. Try again later." };
  }
  await kv.put(rateLimitKey, String(count + 1), { expirationTtl: 3600 });

  const id = newId();
  const expiresDate = new Date(Date.now() + CONTENT_TTL_SECONDS * 1000).toISOString();
  content._meta = { id, stored: new Date().toISOString(), expires: expiresDate };
  await kv.put(`content:${id}`, JSON.stringify(content), { expirationTtl: CONTENT_TTL_SECONDS });

  return { ok: true, id, expiresDate: expiresDate.split("T")[0]! };
}

export async function readContent(kv: KVNamespace, id: string | undefined): Promise<ReadResult> {
  if (!id) return { ok: false, status: 400, error: "No ID provided" };
  if (!ID_PATTERN.test(id)) return { ok: false, status: 400, error: "Invalid ID format" };

  const data = await kv.get(`content:${id}`);
  if (!data) return { ok: false, status: 404, error: "Content not found or has expired" };

  try {
    const content = JSON.parse(data) as Record<string, unknown>;
    delete content._meta;
    return { ok: true, content };
  } catch {
    return { ok: false, status: 500, error: "Failed to read content" };
  }
}
