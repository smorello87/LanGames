import { Hono } from "hono";

type Bindings = {
  CACHE: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// Health check (required by Kale Deploy)
app.get("/api/health", (c) => {
  return c.json({ status: "ok", service: "langames" });
});

// URL shortening proxy (replaces shorten-url.php)
app.post("/api/shorten-url", async (c) => {
  const body = await c.req.json<{ url?: string }>();
  const longURL = body.url;

  if (!longURL) {
    return c.json({ error: "No URL provided" }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(longURL);
  } catch {
    return c.json({ error: "Invalid URL format" }, 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return c.json({ error: "Only http and https URLs are allowed" }, 400);
  }

  const encoded = encodeURIComponent(longURL);
  const services = [
    {
      name: "TinyURL",
      url: `https://tinyurl.com/api-create.php?url=${encoded}`,
      validate: (text: string) =>
        text.includes("tinyurl.com") ? text : null,
    },
    {
      name: "is.gd",
      url: `https://is.gd/create.php?format=simple&url=${encoded}`,
      validate: (text: string) =>
        text.startsWith("http") ? text : null,
    },
    {
      name: "v.gd",
      url: `https://v.gd/create.php?format=simple&url=${encoded}`,
      validate: (text: string) =>
        text.startsWith("http") ? text : null,
    },
    {
      name: "Clck.ru",
      url: `https://clck.ru/--?url=${encoded}`,
      validate: (text: string) =>
        text.includes("clck.ru") ? text : null,
    },
    {
      name: "dagd",
      url: `https://da.gd/s?url=${encoded}`,
      validate: (text: string) =>
        text.startsWith("http") ? text.split("\n")[0] : null,
    },
  ];

  const errors: string[] = [];

  for (const service of services) {
    try {
      const resp = await fetch(service.url, {
        headers: {
          "User-Agent": "LanGames/1.0",
        },
        redirect: "manual",
      });

      if (resp.status !== 200) {
        errors.push(`${service.name}: HTTP ${resp.status}`);
        continue;
      }

      const text = (await resp.text()).trim();
      const shortURL = service.validate(text);

      if (shortURL) {
        return c.json({
          success: true,
          shorturl: shortURL,
          service: service.name,
          original_length: longURL.length,
          shortened_length: shortURL.length,
        });
      }

      errors.push(`${service.name}: Invalid response format`);
    } catch (e) {
      errors.push(
        `${service.name}: ${e instanceof Error ? e.message : "Unknown error"}`
      );
    }
  }

  return c.json(
    {
      success: false,
      error: "All URL shortening services failed",
      details: errors,
      fallback: "Use the long URL directly",
    },
    503
  );
});

// Store content (replaces store-content.php) — uses KV
app.post("/api/store-content", async (c) => {
  // Rate limiting via KV
  const clientIP = c.req.header("cf-connecting-ip") || "unknown";
  const rateLimitKey = `ratelimit:${clientIP}`;
  const rateData = await c.env.CACHE.get(rateLimitKey);
  const count = rateData ? parseInt(rateData, 10) : 0;

  if (count >= 10) {
    return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
  }

  // Increment rate limit (expires in 1 hour)
  await c.env.CACHE.put(rateLimitKey, String(count + 1), {
    expirationTtl: 3600,
  });

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
