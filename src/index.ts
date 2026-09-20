import { Hono } from "hono";
import { readContent, storeContent } from "./content-store";

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
  const clientIP = c.req.header("cf-connecting-ip") || "unknown";
  const result = await storeContent(c.env.CACHE, await c.req.text(), clientIP);
  if (!result.ok) return c.json({ error: result.error }, result.status);

  const shareURL = `${new URL(c.req.url).origin}/index.html?id=${result.id}`;
  return c.json({
    success: true,
    id: result.id,
    url: shareURL,
    expires: "365 days",
    expiresDate: result.expiresDate,
  });
});

// Get content by ID (replaces get-content.php)
app.get("/api/get-content", async (c) => {
  const result = await readContent(c.env.CACHE, c.req.query("id"));
  if (!result.ok) return c.json({ error: result.error }, result.status);
  return c.json(result.content);
});

export default app;
