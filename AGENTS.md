# LanGames

AI-powered multilingual language learning platform deployed on Kale Deploy (Cloudflare Workers).

## Architecture

- **Runtime**: Cloudflare Workers with Hono
- **Storage**: KV (`CACHE` binding) for shared content and rate limiting
- **Static assets**: Served from `public/` via Workers Assets
- **API routes**: `/api/health`, `/api/shorten-url`, `/api/store-content`, `/api/get-content`

## Development

```bash
npm install
npm run dev     # Start local dev server at http://localhost:8787
npm run check   # TypeScript type checking
```
