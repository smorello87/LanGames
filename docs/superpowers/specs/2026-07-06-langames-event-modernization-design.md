# LanGames Event Modernization — Design

**Date:** 2026-07-06
**Goal:** Bring LanGames up to date for a live event presentation (full walkthrough: settings → generate → play → share). Fix slowness and fragility in content generation, refresh the stale model list, simplify the sharing flow, polish visuals, and remove dead code.

## Context

Two live deployments share a nearly identical frontend:

| Deployment | Backend | Source |
|---|---|---|
| https://stefanomorello.com/langames (primary, presented at event) | PHP on Apache shared hosting | `../LanGames-php/` (no git) |
| https://langames.cuny.qzz.io | Hono on Cloudflare Workers | this repo |

The only frontend differences are API endpoint URLs (`store-content.php` vs `/api/store-content`, etc.) and one entry in the model list.

## 1. Workflow & targets

- All edits happen in this git repo first (version control, auto-deploy on push).
- `git init` `../LanGames-php/` before touching it, so changes there are tracked.
- After repo work is verified, sync changed files to `../LanGames-php/`, adjusting only the endpoint URLs. The user uploads the PHP folder to shared hosting manually.
- Both deployments end up updated.

## 2. Generation speed & reliability (`js/content-generator.js`)

Current behavior: 8 LLM calls run sequentially (1 wordle + 5 memory topics + 1 verb tenses + 1 reflexives); any single API error or JSON-parse failure aborts the whole generation and discards all completed sections.

New behavior:

- All 8 prompts fire concurrently via `Promise.allSettled`. Generation time ≈ slowest call instead of the sum.
- One automatic retry per section on API error or parse failure.
- Partial-failure tolerance: sections that fail twice are recorded as failed; successful sections are still saved to `game-content`. The settings page lists failed sections with a "Retry this section" action that regenerates only those sections and merges the result.
- Client-side content repair (never trust prompt compliance):
  - Wordle: keep only words of exactly 5 letters (`[...word].length === 5`, handles combining characters via NFC normalization); require ≥ 8 valid words, else the section counts as failed.
  - Memory: drop pairs where the target word exceeds 12 chars or the English exceeds 14 chars, or where either side contains spaces; require ≥ 8 pairs per topic.
  - Verbs: require `infinitive`, `english`, non-empty `conjugations` per entry; drop malformed entries; require ≥ 10 (tenses) / ≥ 8 (reflexives).
- Progress UI reports real completion ("6/8 sections done") as each promise settles, not fake sequential percentages.

## 3. Model list refresh (`js/llm-config.js`)

- Replace the stale OpenRouter model list (`openai/gpt-4`, `anthropic/claude-3.5-sonnet`, `google/gemini-pro`, `meta-llama/llama-3-70b-instruct`, `google/gemini-3.1-flash-lite-preview`) with current model IDs, verified live against the OpenRouter models API at implementation time.
- Default: a fast, inexpensive, currently-available model suited to live generation.
- Open Web UI provider support unchanged.
- Same list in both codebases (removes the current PHP/Workers divergence).

## 4. Sharing simplification

- Primary path unchanged: server storage (`store-content.php` / KV `store-content`) returns a short `?id=` URL.
- Fallback unchanged in mechanism: Base64 `#content=` fragment URL — but now shown honestly as a long URL.
- **Removed:** the external URL-shortener chain (TinyURL, is.gd, v.gd, Clck.ru, da.gd):
  - Delete `shorten-url.php` (PHP version) and the `/api/shorten-url` route (Worker).
  - Delete `GameContentLoader.shortenURL()` and its call sites.
- Share modal simplifies from three states to two: progress → result (result shows either the short URL or the long fallback URL, with copy button and teacher instructions).

## 5. Visual refresh (within CSS v3, all 7 HTML pages)

Keep the ASR blue/teal identity and the existing CSS v3 file structure, z-index hierarchy, and game layouts. Modernize:

- Consistent type scale and spacing rhythm.
- Softer card shadows and radii; unified card treatment across landing, settings, and games.
- Button hover/focus transitions; visible focus states preserved (WCAG).
- Polished share and progress modals.
- Tidier landing-page hero.
- No structural/layout redesign, no changes to game canvas, tile, or card mechanics, no z-index changes.
- Contrast stays ≥ 4.5:1 (WCAG AA); touch targets stay ≥ 44px.

## 6. Cleanup

- Delete unused files: `js/game-content-loader.js`, `js/game-content-loader-v4.js` (repo), `test-url-length.js` (PHP folder).
- Delete dead LZW/LZString code paths in `js/gcl-1761141656.js` (LZString is never loaded on any page).
- Strip debug `console.log`s; keep `console.error` / `console.warn`.
- Fix rate-limit ordering in both backends: validate the request before incrementing the counter.
- Update both CLAUDE.md files to reflect reality: two live deployments, primary is stefanomorello.com/langames, shortener removed, current file list.

## 7. Verification

- `npm run check` (TypeScript) and `wrangler dev` smoke test of `/api/health`, `/api/store-content`, `/api/get-content`.
- PHP endpoints tested with `php -S localhost:8765` in `../LanGames-php/`.
- Browser walkthrough of the full event flow on both versions: configure settings → generate content → play each of the 5 games → create share link → open share link in a fresh browser profile and play without an API key.

## Out of scope

- No demo mode / bundled pre-generated content (user will pre-generate at home; localStorage persists).
- No framework adoption, no build step, no new pages or games.
- No changes to the LLM provider architecture (OpenRouter + Open Web UI stay as-is).
