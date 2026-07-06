import { Hono } from "hono";

type Bindings = {
  CACHE: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// Health check (required by Kale Deploy)
app.get("/api/health", (c) => {
  return c.json({ status: "ok", service: "langames" });
});

// Store content (replaces store-content.php) — uses KV
app.post("/api/store-content", async (c) => {
  const body = await c.req.text();
  if (body.length > 50000) {
    return c.json({ error: "Content too large (max 50KB)" }, 413);
  }

  let content: Record<string, unknown>;
  try {
    content = JSON.parse(body);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!content.language || !content.difficulty) {
    return c.json(
      { error: "Invalid content: missing language or difficulty" },
      400
    );
  }

  // Rate limiting via KV — only valid requests consume quota
  const clientIP = c.req.header("cf-connecting-ip") || "unknown";
  const rateLimitKey = `ratelimit:${clientIP}`;
  const rateData = await c.env.CACHE.get(rateLimitKey);
  const count = rateData ? parseInt(rateData, 10) : 0;

  if (count >= 10) {
    return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
  }

  await c.env.CACHE.put(rateLimitKey, String(count + 1), {
    expirationTtl: 3600,
  });

  // Generate unique ID
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }

  const contentKey = `content:${id}`;

  // Add metadata
  const stored = new Date().toISOString();
  const expiresDate = new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000
  ).toISOString();
  content._meta = { id, stored, expires: expiresDate };

  // Store in KV (expires in 1 year)
  await c.env.CACHE.put(contentKey, JSON.stringify(content), {
    expirationTtl: 365 * 24 * 60 * 60,
  });

  const baseURL = new URL(c.req.url);
  const shareURL = `${baseURL.origin}/index.html?id=${id}`;

  return c.json({
    success: true,
    id,
    url: shareURL,
    expires: "365 days",
    expiresDate: expiresDate.split("T")[0],
  });
});

// Get content by ID (replaces get-content.php)
app.get("/api/get-content", async (c) => {
  const id = c.req.query("id");

  if (!id) {
    return c.json({ error: "No ID provided" }, 400);
  }

  if (!/^[a-zA-Z0-9]{6,12}$/.test(id)) {
    return c.json({ error: "Invalid ID format" }, 400);
  }

  const contentKey = `content:${id}`;
  const data = await c.env.CACHE.get(contentKey);

  if (!data) {
    return c.json({ error: "Content not found or has expired" }, 404);
  }

  let content: Record<string, unknown>;
  try {
    content = JSON.parse(data);
  } catch {
    return c.json({ error: "Failed to read content" }, 500);
  }

  // Remove metadata before returning
  delete content._meta;

  return c.json(content);
});

export default app;
