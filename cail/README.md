# LanGames on CAIL

The CUNY AI Lab build of LanGames. It serves the same `../public/` frontend as
the Kale and PHP deployments, but it is mounted by
[CAIL Doorway](https://github.com/CUNY-AI-Lab/cail-tools-admission/tree/main/apps/doorway)
at `https://tools.ailab.gc.cuny.edu/langames/`, and content is generated
through CAIL Gateway on the **signed-in person's own model allowance**. There
is no API key on this deployment.

It lives in its own package so the root project, which Kale Deploy builds on
every push to `main`, never needs the private `@cuny-ai-lab` registry.

## How a request flows

```text
browser ── /langames/llm-settings ─▶ Doorway ── CUNY Login + Admission ─▶ this Worker
browser ── POST /langames/api/generate ─▶ Doorway ─ mints cail:langames + cail:gateway legs ─▶ this Worker
this Worker ── CAIL Client, GATEWAY binding, the person's gateway leg ─▶ cail-model-api ─▶ Workers AI / Bedrock
```

The Worker verifies both legs with CAIL Identity: the app assertion for the
exact audience `cail:langames`, and a `cail:gateway` assertion for the same
subject. It forwards only the gateway leg, so Cloudflare AI Gateway charges the
call to that person's `person`/`person-plus`/`admin` budget. The Worker keeps
no ledger and makes exactly one attempt per call.

## Routes

| Path | Doorway access | Purpose |
| --- | --- | --- |
| `/langames/api/*` | authenticated, `cail:langames` + gateway leg | `session`, `quota`, `generate`, `store-content` |
| `/langames/llm-settings`, `/langames/llm-settings.html` | authenticated page (the tool's landing path) | Generate content; visiting signs you in |
| `/langames/api/get-content` | **public** (exact) | A student opening a `?id=` share link |
| `/langames`, `/langames/*` | **public** | Home and the five games |
| `/health/live`, `/health/ready` | not routed by Doorway | Probes; `LanGamesReadiness` RPC carries the reasons |

Students play from a teacher's share link without signing in; only generating
and storing content need a CAIL session. That split is the one policy choice
here that Doorway's maintainers should confirm.

`POST /langames/api/generate` takes `{ prompt, maxTokens, model? }`. The server
pins the system message, bounds the prompt (8000 characters) and the output
budget (8192 tokens), and accepts only the models in `src/models.ts`. The
browser builds the section prompts, exactly as it does for the other
deployments, so there is one set of prompts to maintain.

This page never stores or sends a provider key: the origin is shared with every
other CAIL tool, and the page's `connect-src 'self'` policy enforces it.

## Develop

Node 22 and npm. Installing needs a GitHub token with `read:packages`:

```bash
export NODE_AUTH_TOKEN=$(gh auth token)
npm install
npm run typecheck
npm test
```

`npm run dev` needs identity turned off and a personal CAIL API key
(<https://ailab.gc.cuny.edu/docs/api-keys/>) to make real model calls:

```bash
npx wrangler dev --var CAIL_REQUIRE_IDENTITY:false --var DEV_GATEWAY_KEY:<your key>
# then open http://localhost:8787/langames/
```

`validateConfig` refuses a `DEV_GATEWAY_KEY` when identity is required, so a
development key cannot ship to production.

## Release (receiver first)

1. Create the KV namespace and paste its id into `wrangler.jsonc`:
   `npx wrangler kv namespace create cail-langames-content`
2. `npx wrangler secret put CAIL_IDENTITY_JWKS` with Doorway's public JWKS
   (`https://tools.ailab.gc.cuny.edu/cail-sso/.well-known/jwks.json`).
3. `npm run deploy`, then confirm `LanGamesReadiness.getReadiness()` reports
   `ready` over a service binding.
4. Only then release the Doorway mount that binds `LANGAMES -> cail-langames`.
5. Verify the user action: CUNY Login at `/langames/llm-settings`, one real
   generation, the allowance moving on the Dashboard, and a share link opened
   in a signed-out browser.

## What the tests cover

`npm test` runs the real Hono app, real CAIL Identity verification against a
signing key, and the real CAIL Client. The Gateway binding, KV and the asset
binding are substituted. They do not prove a live Gateway call or the Doorway
mount; step 5 above does.
