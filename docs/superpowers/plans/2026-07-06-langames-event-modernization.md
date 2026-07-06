# LanGames Event Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LanGames fast, reliable, and polished for a live event walkthrough: parallel content generation with retry/partial-failure tolerance, current model list, simplified sharing (no external shorteners), visual refresh, dead-code removal — applied to both the Cloudflare Workers repo and the PHP shared-hosting copy.

**Architecture:** Frontend is vanilla JS served as static assets; two backends expose the same 2 content APIs (Hono Worker in `src/index.ts`; PHP files in `../LanGames-php/`). All work happens in this git repo first, then syncs to `../LanGames-php/` with mechanical endpoint adjustments.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step), Hono on Cloudflare Workers (TypeScript), PHP 8 for shared hosting, Node ≥ 18 for smoke tests.

## Global Constraints

- No frameworks, no build step, no new dependencies (spec: "No framework adoption, no build step").
- `tests/` is gitignored by design — test files run locally, never committed, never deployed.
- WCAG 2.1 AA: contrast ≥ 4.5:1, touch targets ≥ 44px, visible focus states, `textContent` (never `innerHTML`) for user-facing dynamic text.
- Z-index hierarchy unchanged: nav 150, games 1, modals 200, notifications 300.
- Keep the ASR blue/teal identity (`--primary-blue: #003DA5`, `--accent-teal: #0891B2`); no layout restructuring of games.
- Keep `console.error` / `console.warn`; remove `console.log`.
- LZString CDN stays on all pages (used by `#content=` fragment fallback).
- Repo work is committed per task; nothing is pushed to `origin main` until Task 13 (push auto-deploys the Cloudflare version).
- Working directory: `/Users/veritas44/Downloads/github/LanGames` (repo). PHP copy: `/Users/veritas44/Downloads/github/LanGames-php`.

---

### Task 1: Version-control the PHP folder (safety baseline)

**Files:**
- Create: `../LanGames-php/.git` (git init — no source changes)

**Interfaces:**
- Produces: a git baseline commit in `../LanGames-php/` so every later sync change is diffable and revertable.

- [ ] **Step 1: Init and baseline-commit**

```bash
cd /Users/veritas44/Downloads/github/LanGames-php
git init
git add -A
git commit -m "Baseline: PHP version as currently deployed to stefanomorello.com/langames

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: Verify**

Run: `cd /Users/veritas44/Downloads/github/LanGames-php && git log --oneline`
Expected: exactly one commit; `git status` reports a clean tree (`.DS_Store` may appear — add a `.gitignore` entry for it if the existing `.gitignore` lacks one, amend the commit).

---

### Task 2: Content repair functions (client-side validation) + node smoke tests

**Files:**
- Modify: `public/js/content-generator.js` (add three methods to the `ContentGenerator` object)
- Test: `tests/content-repair.test.mjs` (local only; `tests/` is gitignored)

**Interfaces:**
- Produces (used by Task 3):
  - `ContentGenerator.repairWordleWords(words: unknown) → string[]` — trimmed, NFC-normalized, exactly-5-letter, space-free, case-insensitively deduped words.
  - `ContentGenerator.repairMemoryPairs(pairs: Array<{word, english}>) → Array<{word, english}>` — drops pairs where word > 12 code points, english > 14 code points, or either contains whitespace.
  - `ContentGenerator.repairVerbs(verbs: unknown) → Array<{infinitive, english, conjugations}>` — drops entries missing `infinitive`/`english` strings or a non-empty `conjugations` object.

- [ ] **Step 1: Write the failing test**

Create `tests/content-repair.test.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import assert from 'node:assert';

// content-generator.js is a browser global-style script; evaluate it and grab the object.
const src = readFileSync(new URL('../public/js/content-generator.js', import.meta.url), 'utf8');
const ContentGenerator = new Function(`${src}; return ContentGenerator;`)();

// --- repairWordleWords ---
assert.deepStrictEqual(
  ContentGenerator.repairWordleWords(['mondo ', 'perché', 'più', 'Mondo', 'terra', 42, 'due tre']),
  ['mondo', 'terra'],
  'keeps only 5-letter, space-free, deduped strings'
);
// NFC normalization: 'cafe' + combining acute = 5 code points raw, 4 after NFC → dropped
assert.deepStrictEqual(ContentGenerator.repairWordleWords(['café']), []);
// Cyrillic 5-letter word passes
assert.deepStrictEqual(ContentGenerator.repairWordleWords(['земля']), ['земля']);
assert.deepStrictEqual(ContentGenerator.repairWordleWords('not-an-array'), []);

// --- repairMemoryPairs ---
assert.deepStrictEqual(
  ContentGenerator.repairMemoryPairs([
    { word: 'mela', english: 'apple' },
    { word: 'interessantissimo', english: 'interesting' },   // word > 12 → drop
    { word: 'gelato', english: 'chocolate ice cream' },      // english has spaces & > 14 → drop
    { word: 'pane', english: 'bread' },
    { word: '', english: 'empty' },                          // empty → drop
  ]),
  [{ word: 'mela', english: 'apple' }, { word: 'pane', english: 'bread' }]
);

// --- repairVerbs ---
assert.deepStrictEqual(
  ContentGenerator.repairVerbs([
    { infinitive: 'parlare', english: 'to speak', conjugations: { io: 'parlo' } },
    { infinitive: 'mancare', english: 'to miss', conjugations: {} },   // empty conjugations → drop
    { infinitive: 'rotto', conjugations: { io: 'x' } },                // missing english → drop
    'garbage',
  ]),
  [{ infinitive: 'parlare', english: 'to speak', conjugations: { io: 'parlo' } }]
);

console.log('content-repair tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/veritas44/Downloads/github/LanGames && node tests/content-repair.test.mjs`
Expected: FAIL with `TypeError: ContentGenerator.repairWordleWords is not a function`

- [ ] **Step 3: Implement the three repair methods**

In `public/js/content-generator.js`, add inside the `ContentGenerator` object, right after the opening `const ContentGenerator = {` line:

```javascript
  // --- Client-side content repair (never trust LLM prompt compliance) ---

  // Keep only real 5-letter words; trim, NFC-normalize, dedupe case-insensitively
  repairWordleWords(words) {
    if (!Array.isArray(words)) return [];
    const seen = new Set();
    const valid = [];
    for (const raw of words) {
      if (typeof raw !== 'string') continue;
      const word = raw.trim().normalize('NFC');
      if (/\s/.test(word)) continue;
      if ([...word].length !== 5) continue;
      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      valid.push(word);
    }
    return valid;
  },

  // Drop pairs that would overflow memory cards (word ≤ 12, english ≤ 14, single words only)
  repairMemoryPairs(pairs) {
    if (!Array.isArray(pairs)) return [];
    return pairs.filter(p =>
      p && typeof p.word === 'string' && typeof p.english === 'string' &&
      p.word.length > 0 && p.english.length > 0 &&
      !/\s/.test(p.word) && !/\s/.test(p.english) &&
      [...p.word].length <= 12 && [...p.english].length <= 14
    );
  },

  // Drop malformed verb entries
  repairVerbs(verbs) {
    if (!Array.isArray(verbs)) return [];
    return verbs.filter(v =>
      v && typeof v === 'object' &&
      typeof v.infinitive === 'string' && v.infinitive.length > 0 &&
      typeof v.english === 'string' && v.english.length > 0 &&
      v.conjugations && typeof v.conjugations === 'object' &&
      Object.keys(v.conjugations).length > 0
    );
  },
```

Note the test expects `repairMemoryPairs` to drop `{ word: 'gelato', english: 'chocolate ice cream' }` — the space test handles that.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/content-repair.test.mjs`
Expected: `content-repair tests passed`

- [ ] **Step 5: Commit**

```bash
git add public/js/content-generator.js
git commit -m "Add client-side content repair validators to ContentGenerator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Parallel generation with retry and partial-failure tolerance

**Files:**
- Modify: `public/js/content-generator.js` (replace `generateAllContent`, split `generateMemoryContent` into per-topic, wire repair into each generator, add section registry)
- Test: `tests/generate-sections.test.mjs` (local only)

**Interfaces:**
- Consumes: `repairWordleWords` / `repairMemoryPairs` / `repairVerbs` from Task 2.
- Produces (used by Task 4):
  - `ContentGenerator.SECTION_KEYS: string[]` — `['wordle','memory:food','memory:daily','memory:family','memory:school','memory:work','verbTenses','reflexiveVerbs']`
  - `ContentGenerator.sectionLabel(key: string) → string` — human label, e.g. `'Memory — Food and Drink'`
  - `ContentGenerator.generateSections(keys, language, difficulty, progressCallback) → Promise<{sections: Record<key, data>, failed: Array<{key, error}>}>` — runs the given sections concurrently, one retry each. `progressCallback(message: string, percent: number)` fires after each section settles.
  - `ContentGenerator.generateAllContent(language, difficulty, progressCallback) → Promise<{content, failed}>` — **BREAKING CHANGE from old signature** (used to return `content` directly): now returns `{content, failed}` where `content` is the storable object (`{language, difficulty, timestamp, wordle, memory, verbTenses, reflexiveVerbs}`) and `failed` is the failed-section array. Task 4 updates the caller.
  - `ContentGenerator.applySections(content, sections) → void` — merges a sections map into a content object (`memory:X` keys go into `content.memory.X`).

- [ ] **Step 1: Write the failing test**

Create `tests/generate-sections.test.mjs`:

```javascript
import { readFileSync } from 'node:fs';
import assert from 'node:assert';

const src = readFileSync(new URL('../public/js/content-generator.js', import.meta.url), 'utf8');
const ContentGenerator = new Function(`${src}; return ContentGenerator;`)();

// generateSections reads LLMConfig from global scope — shim it for node
globalThis.LLMConfig = {
  getSettings: () => ({ provider: 'openrouter', endpoint: 'http://test', apiKey: 'k', model: 'm' }),
  validateSettings: () => ({ valid: true }),
};

// Section registry
assert.deepStrictEqual(ContentGenerator.SECTION_KEYS, [
  'wordle', 'memory:food', 'memory:daily', 'memory:family',
  'memory:school', 'memory:work', 'verbTenses', 'reflexiveVerbs',
]);
assert.strictEqual(ContentGenerator.sectionLabel('memory:food'), 'Memory — Food and Drink');
assert.strictEqual(ContentGenerator.sectionLabel('wordle'), 'Wordle words');

// applySections merges memory:* into content.memory
const content = { language: 'Italian', memory: { food: ['old'] } };
ContentGenerator.applySections(content, {
  'memory:daily': [{ word: 'bere', english: 'drink' }],
  wordle: ['mondo'],
});
assert.deepStrictEqual(content.memory.food, ['old']);
assert.deepStrictEqual(content.memory.daily, [{ word: 'bere', english: 'drink' }]);
assert.deepStrictEqual(content.wordle, ['mondo']);

// generateSections: concurrency, retry-once, partial failure.
// Stub generateSection: 'wordle' succeeds; 'verbTenses' fails once then succeeds (retry works);
// 'memory:food' always fails (lands in failed).
let verbAttempts = 0;
const calls = [];
ContentGenerator.generateSection = async (key) => {
  calls.push(key);
  if (key === 'wordle') return ['mondo', 'terra'];
  if (key === 'verbTenses') {
    verbAttempts++;
    if (verbAttempts === 1) throw new Error('flaky');
    return [{ infinitive: 'parlare', english: 'to speak', conjugations: { io: 'parlo' } }];
  }
  throw new Error('always fails');
};
const progress = [];
const result = await ContentGenerator.generateSections(
  ['wordle', 'verbTenses', 'memory:food'], 'Italian', 'beginner',
  (msg, pct) => progress.push(pct)
);
assert.deepStrictEqual(result.sections.wordle, ['mondo', 'terra']);
assert.strictEqual(result.sections.verbTenses.length, 1);
assert.strictEqual(result.failed.length, 1);
assert.strictEqual(result.failed[0].key, 'memory:food');
assert.strictEqual(verbAttempts, 2, 'verbTenses retried once');
assert.strictEqual(calls.filter(k => k === 'memory:food').length, 2, 'failed section retried once then gave up');
assert.deepStrictEqual(progress, [34, 67, 100], 'progress fires per settled section');

console.log('generate-sections tests passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/generate-sections.test.mjs`
Expected: FAIL with `AssertionError` on `SECTION_KEYS` (undefined).

- [ ] **Step 3: Implement the section engine**

In `public/js/content-generator.js`:

**3a.** Replace the entire existing `generateAllContent` method with:

```javascript
  MEMORY_TOPICS: {
    food: 'Food and Drink',
    daily: 'Daily Activities',
    family: 'Family Members',
    school: 'School and Education',
    work: 'Work and Career'
  },

  SECTION_KEYS: [
    'wordle', 'memory:food', 'memory:daily', 'memory:family',
    'memory:school', 'memory:work', 'verbTenses', 'reflexiveVerbs'
  ],

  sectionLabel(key) {
    if (key === 'wordle') return 'Wordle words';
    if (key === 'verbTenses') return 'Verb conjugations';
    if (key === 'reflexiveVerbs') return 'Reflexive verbs';
    if (key.startsWith('memory:')) return `Memory — ${this.MEMORY_TOPICS[key.slice(7)]}`;
    return key;
  },

  // Dispatch a single section to its generator
  async generateSection(key, language, difficulty, settings) {
    if (key === 'wordle') return this.generateWordleWords(language, difficulty, settings);
    if (key === 'verbTenses') return this.generateVerbTenses(language, difficulty, settings);
    if (key === 'reflexiveVerbs') return this.generateReflexiveVerbs(language, difficulty, settings);
    if (key.startsWith('memory:')) return this.generateMemoryTopic(key.slice(7), language, difficulty, settings);
    throw new Error(`Unknown section: ${key}`);
  },

  // Run sections concurrently; one retry each; report progress as sections settle
  async generateSections(keys, language, difficulty, progressCallback) {
    const settings = LLMConfig.getSettings();
    if (!settings) {
      throw new Error('LLM settings not configured. Please configure settings first.');
    }
    const validation = LLMConfig.validateSettings(settings);
    if (!validation.valid) {
      throw new Error(`Invalid settings: ${validation.error}`);
    }

    let done = 0;
    const report = () => {
      done++;
      if (progressCallback) {
        progressCallback(`${done} of ${keys.length} sections complete`, Math.ceil((done / keys.length) * 100));
      }
    };

    const settled = await Promise.allSettled(keys.map(async (key) => {
      try {
        const value = await this.generateSection(key, language, difficulty, settings);
        report();
        return { key, value };
      } catch (firstError) {
        console.warn(`Section ${key} failed, retrying once:`, firstError.message);
        try {
          const value = await this.generateSection(key, language, difficulty, settings);
          report();
          return { key, value };
        } catch (secondError) {
          report();
          throw Object.assign(new Error(secondError.message), { sectionKey: key });
        }
      }
    }));

    const sections = {};
    const failed = [];
    settled.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        sections[res.value.key] = res.value.value;
      } else {
        failed.push({ key: keys[i], error: res.reason.message });
      }
    });
    return { sections, failed };
  },

  // Merge a sections map into a content object
  applySections(content, sections) {
    for (const [key, value] of Object.entries(sections)) {
      if (key.startsWith('memory:')) {
        if (!content.memory || typeof content.memory !== 'object') content.memory = {};
        content.memory[key.slice(7)] = value;
      } else {
        content[key] = value;
      }
    }
  },

  // Generate all content for a language and difficulty.
  // Returns { content, failed }: content holds every successful section;
  // failed lists sections that failed twice (empty array = full success).
  async generateAllContent(language, difficulty, progressCallback) {
    const { sections, failed } = await this.generateSections(
      this.SECTION_KEYS, language, difficulty, progressCallback
    );
    const content = {
      language,
      difficulty,
      timestamp: new Date().toISOString(),
      wordle: null,
      memory: {},
      verbTenses: null,
      reflexiveVerbs: null
    };
    this.applySections(content, sections);
    return { content, failed };
  },
```

**3b.** Replace the entire `generateMemoryContent` method (the one that loops over 5 topics) with a single-topic version. Keep the existing prompt text exactly, but parameterized by topic; apply repair; enforce a minimum:

```javascript
  // Generate Memory game content for ONE topic (12 pairs requested, ≥8 valid required)
  async generateMemoryTopic(topic, language, difficulty, settings) {
    const topicName = this.MEMORY_TOPICS[topic];
    const prompt = `Generate exactly 12 word pairs for a memory matching game. The topic is "${topicName}".

Requirements:
- Target language: ${language}
- Difficulty level: ${difficulty}
- Each pair has one word in ${language} and its English translation
- CRITICAL: Words must be SHORT - maximum 12 characters for ${language} words, maximum 14 characters for English
- Use SINGLE WORDS only - no phrases with spaces (e.g., use "homework" not "home work", "breakfast" not "have breakfast")
- If a concept requires multiple words, choose a simpler single-word alternative
- Choose vocabulary appropriate for ${difficulty} level learners
- Words should be relevant to the "${topicName}" topic
- Prefer shorter, concise vocabulary that fits well on cards

Return ONLY a JSON array of objects in this exact format:
[
  {"${language.toLowerCase()}": "word1", "english": "translation1"},
  {"${language.toLowerCase()}": "word2", "english": "translation2"},
  ...
]

Return exactly 12 pairs. No explanations, just the JSON array.`;

    const response = await this.callLLM(prompt, settings, 1000);
    const parsed = JSON.parse(response);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`Memory ${topic}: expected an array of word pairs`);
    }
    const langKey = Object.keys(parsed[0]).find(k => k !== 'english');
    if (!langKey) {
      throw new Error(`Memory ${topic}: word pairs missing language key`);
    }
    const mapped = parsed
      .filter(item => item && item[langKey] && item.english)
      .map(item => ({ word: item[langKey], english: item.english }));
    const repaired = this.repairMemoryPairs(mapped);
    if (repaired.length < 8) {
      throw new Error(`Memory ${topic}: only ${repaired.length} valid pairs (need at least 8)`);
    }
    return repaired;
  },
```

**3c.** In `generateWordleWords`, replace the body of the `try` block after `const words = JSON.parse(response);` — keep the array/string checks, then add repair + threshold before `return`:

```javascript
      const words = JSON.parse(response);
      if (!Array.isArray(words) || words.length === 0) {
        throw new Error('Expected an array of words from the API');
      }
      const repaired = this.repairWordleWords(words);
      if (repaired.length < 8) {
        throw new Error(`Only ${repaired.length} valid 5-letter words returned (need at least 8)`);
      }
      return repaired;
```

**3d.** In `generateVerbTenses`, replace the per-verb validation loop with repair + threshold:

```javascript
      const verbs = JSON.parse(response);
      if (!Array.isArray(verbs) || verbs.length === 0) {
        throw new Error('Expected an array of verb objects');
      }
      const repaired = this.repairVerbs(verbs);
      if (repaired.length < 10) {
        throw new Error(`Only ${repaired.length} valid verbs returned (need at least 10)`);
      }
      return repaired;
```

**3e.** Same in `generateReflexiveVerbs` with a threshold of 8:

```javascript
      const verbs = JSON.parse(response);
      if (!Array.isArray(verbs) || verbs.length === 0) {
        throw new Error('Expected an array of reflexive verb objects');
      }
      const repaired = this.repairVerbs(verbs);
      if (repaired.length < 8) {
        throw new Error(`Only ${repaired.length} valid reflexive verbs returned (need at least 8)`);
      }
      return repaired;
```

**3f.** While in this file, delete every `console.log(...)` line (there are ~25, all prefixed `[ContentGenerator]`). Keep `console.error` and `console.warn`.

- [ ] **Step 4: Run both tests to verify they pass**

Run: `node tests/content-repair.test.mjs && node tests/generate-sections.test.mjs`
Expected: both print `... tests passed`

- [ ] **Step 5: Commit**

```bash
git add public/js/content-generator.js
git commit -m "Generate content sections in parallel with retry and partial-failure tolerance

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Settings page — real progress, partial-failure retry UI, updated copy

**Files:**
- Modify: `public/llm-settings.html`

**Interfaces:**
- Consumes: `generateAllContent → {content, failed}`, `generateSections`, `sectionLabel`, `applySections` from Task 3; `GameContentLoader.saveContent/loadContent` (unchanged).
- Produces: page-level functions `generateContent()` (rewritten) and `retryFailedSections()` (new); hidden `#partialFailureBox` element.

- [ ] **Step 1: Add the partial-failure box to the HTML**

In `public/llm-settings.html`, directly after the Generate button block (the `<div style="text-align: center;">` containing `#generateBtn` — around line 206-213), add:

```html
      <!-- Partial failure notice -->
      <div id="partialFailureBox" class="alert alert-warning" style="display: none; margin-top: var(--spacing-lg);">
        <p id="partialFailureText" style="margin: 0 0 var(--spacing-sm) 0;"></p>
        <button type="button" class="btn-primary" onclick="retryFailedSections()">Retry failed sections</button>
      </div>
```

- [ ] **Step 2: Rewrite `generateContent()` and add `retryFailedSections()`**

In the same file's inline `<script defer>`, add a state variable next to the existing ones (`let selectedLanguage = null;` etc.):

```javascript
    let failedSections = [];
```

Replace the whole `generateContent()` function with:

```javascript
    async function generateContent() {
      if (!verifyModules()) return;

      const settings = LLMConfig.getSettings();
      if (!settings) {
        showAlert('error', 'Please configure your API settings first (Section 1 above).');
        return;
      }

      if (!selectedLanguage || !selectedDifficulty) {
        showAlert('error', 'Please select both language and difficulty level.');
        return;
      }

      const confirmed = confirm(
        `Generate new content for ${selectedLanguage} (${selectedDifficulty} level)?\n\n` +
        `This usually takes under a minute and uses API credits.\n` +
        `Any existing content will be replaced.`
      );

      if (!confirmed) return;

      const modal = document.getElementById('progressModal');
      modal.classList.add('active');
      updateProgress('Contacting the AI model…', 0);

      try {
        const { content, failed } = await ContentGenerator.generateAllContent(
          selectedLanguage,
          selectedDifficulty,
          updateProgress
        );

        modal.classList.remove('active');

        if (failed.length === ContentGenerator.SECTION_KEYS.length) {
          showAlert('error', `Content generation failed: ${failed[0].error}`);
          return;
        }

        if (!GameContentLoader.saveContent(content)) {
          throw new Error('Failed to save content to localStorage');
        }

        if (failed.length > 0) {
          showPartialFailure(failed);
        } else {
          hidePartialFailure();
          showAlert('success', 'Content generated successfully! Choose a game from the navigation menu.');
        }
        checkExistingContent();

      } catch (error) {
        modal.classList.remove('active');
        showAlert('error', `Content generation failed: ${error.message || 'Unknown error occurred'}`);
      }
    }

    function updateProgress(message, percent) {
      document.getElementById('progressFill').style.width = percent + '%';
      document.getElementById('progressText').textContent = message;
    }

    function showPartialFailure(failed) {
      failedSections = failed.map(f => f.key);
      const labels = failed.map(f => ContentGenerator.sectionLabel(f.key)).join(', ');
      document.getElementById('partialFailureText').textContent =
        `Generated ${ContentGenerator.SECTION_KEYS.length - failed.length} of ${ContentGenerator.SECTION_KEYS.length} sections. ` +
        `Could not generate: ${labels}. The other games are ready to play.`;
      document.getElementById('partialFailureBox').style.display = 'block';
    }

    function hidePartialFailure() {
      failedSections = [];
      document.getElementById('partialFailureBox').style.display = 'none';
    }

    async function retryFailedSections() {
      if (!verifyModules() || failedSections.length === 0) return;

      const content = GameContentLoader.loadContent();
      if (!content) {
        showAlert('error', 'No stored content found. Please generate content first.');
        return;
      }

      const modal = document.getElementById('progressModal');
      modal.classList.add('active');
      updateProgress('Retrying failed sections…', 0);

      try {
        const { sections, failed } = await ContentGenerator.generateSections(
          failedSections, content.language, content.difficulty, updateProgress
        );

        ContentGenerator.applySections(content, sections);
        if (!GameContentLoader.saveContent(content)) {
          throw new Error('Failed to save content to localStorage');
        }

        modal.classList.remove('active');

        if (failed.length > 0) {
          showPartialFailure(failed);
          showAlert('warning', 'Some sections still failed. You can retry again.');
        } else {
          hidePartialFailure();
          showAlert('success', 'All sections generated! Choose a game from the navigation menu.');
        }
        checkExistingContent();
      } catch (error) {
        modal.classList.remove('active');
        showAlert('error', `Retry failed: ${error.message}`);
      }
    }
```

Note: the old inline `const updateProgress = (message, percent) => {...}` inside `generateContent` is superseded by the top-level `updateProgress` above — make sure it is not defined twice.

- [ ] **Step 3: Update stale copy**

Same file:
- Line ~210: change `This will take 2-5 minutes and use API credits.` → `This usually takes under a minute and uses API credits.`
- Progress modal `<p>` (~line 220): `Please wait while we create your custom learning materials...` → `Your custom learning materials are being created — all game sections generate at once.`

- [ ] **Step 4: Check `showAlert` supports the `warning` type**

`showAlert` sets `alert.className = 'alert alert-${type}'`. Verify `.alert-warning` exists in CSS: `grep -n "alert-warning" public/css/*.css`. It exists (used by the Security Notice). Nothing to change; this step is verification only.

- [ ] **Step 5: Smoke-test the page**

```bash
cd /Users/veritas44/Downloads/github/LanGames && npx wrangler dev --port 8787 &
sleep 6
curl -s http://localhost:8787/llm-settings.html | grep -c "partialFailureBox"
kill %1
```
Expected: `3` (the div's `id=`, plus `showPartialFailure` and `hidePartialFailure` lookups). Then open `http://localhost:8787/llm-settings.html` in a browser and confirm zero console errors on load.

- [ ] **Step 6: Commit**

```bash
git add public/llm-settings.html
git commit -m "Settings page: real progress, partial-failure retry UI, updated copy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Model list refresh

**Files:**
- Modify: `public/js/llm-config.js:12` (models array)
- Modify: `public/llm-settings.html:102-109` (the `#openrouter-model` `<select>` options)

**Interfaces:**
- Produces: the canonical model list, verified live against OpenRouter on 2026-07-06:
  `google/gemini-3.1-flash-lite` (default), `google/gemini-3.5-flash`, `anthropic/claude-haiku-4.5`, `anthropic/claude-sonnet-5`, `openai/gpt-5.4-mini`, `openai/gpt-5.4`, `meta-llama/llama-3.3-70b-instruct`.

- [ ] **Step 1: Re-verify the model IDs still exist (they were checked 2026-07-06)**

```bash
curl -s "https://openrouter.ai/api/v1/models" | python3 -c "
import json,sys
ids={m['id'] for m in json.load(sys.stdin)['data']}
want=['google/gemini-3.1-flash-lite','google/gemini-3.5-flash','anthropic/claude-haiku-4.5','anthropic/claude-sonnet-5','openai/gpt-5.4-mini','openai/gpt-5.4','meta-llama/llama-3.3-70b-instruct']
missing=[w for w in want if w not in ids]
print('MISSING:', missing) if missing else print('all model ids valid')
"
```
Expected: `all model ids valid`. If any is missing, substitute the closest current equivalent from the API output and use it consistently in both files below.

- [ ] **Step 2: Update `llm-config.js`**

Replace line 12 (`models: ['google/gemini-3.1-flash-lite-preview', 'openai/gpt-4', ...]`) with:

```javascript
      models: ['google/gemini-3.1-flash-lite', 'google/gemini-3.5-flash', 'anthropic/claude-haiku-4.5', 'anthropic/claude-sonnet-5', 'openai/gpt-5.4-mini', 'openai/gpt-5.4', 'meta-llama/llama-3.3-70b-instruct']
```

- [ ] **Step 3: Update the settings page `<select>`**

Replace the `#openrouter-model` options (keeping the empty placeholder option) with:

```html
          <select id="openrouter-model">
            <option value="">Select a model...</option>
            <option value="google/gemini-3.1-flash-lite" selected>Google Gemini 3.1 Flash Lite (fast — recommended)</option>
            <option value="google/gemini-3.5-flash">Google Gemini 3.5 Flash</option>
            <option value="anthropic/claude-haiku-4.5">Anthropic Claude Haiku 4.5 (fast)</option>
            <option value="anthropic/claude-sonnet-5">Anthropic Claude Sonnet 5</option>
            <option value="openai/gpt-5.4-mini">OpenAI GPT-5.4 Mini (fast)</option>
            <option value="openai/gpt-5.4">OpenAI GPT-5.4</option>
            <option value="meta-llama/llama-3.3-70b-instruct">Meta Llama 3.3 70B</option>
          </select>
```

- [ ] **Step 4: Verify no stale IDs remain**

Run: `grep -rn "gpt-4\|claude-3.5\|gemini-pro\|llama-3-70b\|flash-lite-preview" public/ src/`
Expected: no matches (the API cost section of CLAUDE.md is handled in Task 10).

- [ ] **Step 5: Commit**

```bash
git add public/js/llm-config.js public/llm-settings.html
git commit -m "Refresh OpenRouter model list to current IDs (verified 2026-07-06)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Sharing — two-state modal, remove shortener client code and dead LZW

**Files:**
- Modify: `public/llm-settings.html` (share modal HTML + `generateShareLink()`)
- Modify: `public/js/gcl-1761141656.js` (delete `shortenURL`, `_compress`, `_decompress`, `_lzwCompress`, `_lzwDecompress`; strip `console.log`s)

**Interfaces:**
- Consumes: `GameContentLoader.storeContentOnServer(content) → {url, id, expires, expiresDate} | null` and `GameContentLoader.generateShareURL(content) → string | null` (both unchanged).
- Produces: `GameContentLoader` no longer has `shortenURL`; the share modal has exactly two states: `#shareProgressState` and `#shareSuccessState` (with new `<p id="shareResultNote">`).

- [ ] **Step 1: Delete dead code from `gcl-1761141656.js`**

Delete these five methods entirely (lines ~196-267 and ~364-401 in the current file): `_compress`, `_decompress`, `_lzwCompress`, `_lzwDecompress`, `shortenURL`. Also delete the comment block above `_compress` (`// URL-based sharing functionality with compression` / `// Simple LZ-based compression for strings`). Then delete every `console.log(...)` statement in the file (keep `console.error`/`console.warn`).

Verify: `grep -n "lzw\|shortenURL\|console.log" public/js/gcl-1761141656.js` → no matches.

- [ ] **Step 2: Simplify the share modal HTML**

In `public/llm-settings.html`, delete the whole `#shareFallbackState` div (lines ~304-321). In `#shareSuccessState`, replace the first `<p>` with:

```html
            <p id="shareResultNote" style="margin-bottom: var(--spacing-lg); color: var(--text-muted); text-align: center;">
              Share this link with your students. When they click it, the content will automatically load!
            </p>
```

- [ ] **Step 3: Rewrite `generateShareLink()` and remove the fallback copy handler**

Replace `generateShareLink()` with:

```javascript
    async function generateShareLink() {
      if (!verifyModules()) return;

      try {
        const content = GameContentLoader.loadContent();
        if (!content) {
          showAlert('error', 'No content available. Please generate content first.');
          return;
        }

        // Show modal in progress state
        document.getElementById('shareLinkModal').style.display = 'flex';
        document.getElementById('shareProgressState').style.display = 'block';
        document.getElementById('shareSuccessState').style.display = 'none';
        document.getElementById('shareExpiresInfo').textContent = '';

        // Primary: server storage → short URL
        const serverResult = await GameContentLoader.storeContentOnServer(content);

        if (serverResult && serverResult.url) {
          showShareResult(serverResult.url,
            'Share this link with your students. When they click it, the content will automatically load!',
            serverResult.expiresDate ? `Link expires: ${serverResult.expiresDate}` : `Link expires in ${serverResult.expires}`);
          return;
        }

        // Fallback: content encoded in the URL fragment (long, but self-contained)
        const shareURL = GameContentLoader.generateShareURL(content);
        if (!shareURL) {
          showAlert('error', 'Failed to generate share link. Please try exporting as a file instead.');
          closeShareModal();
          return;
        }
        showShareResult(shareURL,
          'The server is unavailable, so this link carries the content itself. It is long, but works exactly the same way.',
          'Link does not expire');

      } catch (error) {
        showAlert('error', `Failed to generate share link: ${error.message}`);
        closeShareModal();
      }
    }

    function showShareResult(url, note, expiresText) {
      document.getElementById('shareURLInput').value = url;
      document.getElementById('shareResultNote').textContent = note;
      document.getElementById('shareExpiresInfo').textContent = expiresText;
      document.getElementById('shareProgressState').style.display = 'none';
      document.getElementById('shareSuccessState').style.display = 'block';
    }
```

Then: delete the `copyShareLinkFallback()` function; in `closeShareModal()` delete the `shareFallbackState` line.

- [ ] **Step 4: Update teacher info copy**

In the "For Teachers" info box (~line 256-263), replace the two `<li>` items with:

```html
          <li><strong>Share Link (Recommended):</strong> Generate a short link that students can click to instantly load your content — easiest method!</li>
          <li><strong>Export File:</strong> Download a JSON file for students to import manually (works offline)</li>
```

- [ ] **Step 5: Verify and commit**

Run: `grep -n "shareFallbackState\|copyShareLinkFallback\|shortenURL" public/llm-settings.html public/js/gcl-1761141656.js`
Expected: no matches.

```bash
git add public/llm-settings.html public/js/gcl-1761141656.js
git commit -m "Simplify sharing: server storage + fragment fallback, drop external shorteners client-side

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Worker backend — remove `/api/shorten-url`, fix rate-limit ordering

**Files:**
- Modify: `src/index.ts` (delete lines 14-114 shorten-url route; reorder store-content validation)

**Interfaces:**
- Consumes: nothing new.
- Produces: Worker exposes exactly `/api/health`, `/api/store-content`, `/api/get-content`. In `/api/store-content`, invalid requests (bad JSON, too large, missing fields) do NOT consume rate-limit quota.

- [ ] **Step 1: Delete the shorten-url route**

Remove the whole `app.post("/api/shorten-url", ...)` block (`src/index.ts:14-114`, from the `// URL shortening proxy` comment through its closing `});`).

- [ ] **Step 2: Reorder store-content: validate first, then rate-limit**

Restructure `app.post("/api/store-content", ...)` so the body read + size check + JSON parse + field validation happen BEFORE the rate-limit read/increment. The rate-limit check (read + 429) and increment move together, after validation:

```typescript
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
```

(The ID generation, `_meta`, KV put, and response below stay exactly as they are.)

- [ ] **Step 3: Type-check and smoke-test**

```bash
npm run check
npx wrangler dev --port 8787 &
sleep 6
curl -s http://localhost:8787/api/health
curl -s -X POST http://localhost:8787/api/shorten-url -H 'Content-Type: application/json' -d '{"url":"https://example.com"}' -o /dev/null -w '%{http_code}\n'
curl -s -X POST http://localhost:8787/api/store-content -H 'Content-Type: application/json' -d '{"language":"Italian","difficulty":"beginner","wordle":["mondo"]}'
kill %1
```
Expected: health returns `{"status":"ok",...}`; shorten-url returns `404`; store-content returns `{"success":true,"id":"...","url":".../index.html?id=..."}`. Then `curl "http://localhost:8787/api/get-content?id=<that id>"` returns the content (run before killing wrangler).

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "Remove /api/shorten-url; validate store-content requests before consuming rate limit

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Dead-file cleanup + remaining console.log strip

**Files:**
- Delete: `public/js/game-content-loader.js`, `public/js/game-content-loader-v4.js`
- Delete: `public/css/styles-v2.css`, `public/css/games-v2.css`, `public/css/adaptive-v1.css`, `public/css/adaptive-v2.css`
- Modify: `public/js/llm-config.js` (strip `console.log`s)

**Interfaces:** none new; verification-heavy task.

- [ ] **Step 1: Prove the files are unreferenced**

```bash
grep -rn "game-content-loader" public/*.html src/
grep -rn "styles-v2\|games-v2\|adaptive-v1\|adaptive-v2" public/*.html
```
Expected: no matches for both. If a match appears, STOP and fix the reference to point at the current file (`gcl-1761141656.js` / v3 CSS) before deleting.

- [ ] **Step 2: Delete**

```bash
git rm public/js/game-content-loader.js public/js/game-content-loader-v4.js \
       public/css/styles-v2.css public/css/games-v2.css public/css/adaptive-v1.css public/css/adaptive-v2.css
```

- [ ] **Step 3: Strip `console.log` from `llm-config.js`**

Delete all `console.log(...)` lines (there are ~8, prefixed `[LLMConfig]`). Keep `console.error`.
Verify: `grep -rn "console.log" public/js/` → no matches in any JS file.

- [ ] **Step 4: Confirm pages still load**

```bash
npx wrangler dev --port 8787 &
sleep 6
for p in index llm-settings wordle-adaptive memory-adaptive fiore-adaptive tenses-adaptive reflexives-adaptive; do
  curl -s -o /dev/null -w "$p: %{http_code}\n" http://localhost:8787/$p.html
done
kill %1
```
Expected: all `200`. Open two pages in a browser and check the console for 404s on assets.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Remove dead loaders, unused v1/v2 CSS, and debug logging

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Visual refresh (CSS v3, all pages)

**Files:**
- Modify: `public/css/styles-v3.css` (design tokens, buttons, cards, hero)
- Modify: `public/css/adaptive-v3.css` (modals, selection cards, share UI)
- Modify: `public/index.html` (hero gradient uses legacy Italian green — switch to brand blue/teal)

**Interfaces:**
- Consumes: existing CSS custom properties (`--primary-blue`, `--accent-teal`, `--spacing-*`).
- Produces: new tokens `--radius-sm/md/lg`, `--shadow-sm/md/lg`, `--transition-base` available to all pages.

- [ ] **Step 1: Add design tokens**

In `public/css/styles-v3.css`, inside `:root` (after the existing color variables, ~line 55):

```css
  /* Modernization tokens (2026 refresh) */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 3px rgba(0, 31, 76, 0.08), 0 1px 2px rgba(0, 31, 76, 0.06);
  --shadow-md: 0 4px 12px rgba(0, 31, 76, 0.10), 0 2px 4px rgba(0, 31, 76, 0.06);
  --shadow-lg: 0 12px 32px rgba(0, 31, 76, 0.16), 0 4px 8px rgba(0, 31, 76, 0.08);
  --transition-base: 160ms ease;
```

- [ ] **Step 2: Body typography and buttons (`styles-v3.css`)**

- On the `body` rule: set `line-height: 1.6;` (if a smaller value is present, replace it).
- Find the shared button rules (`.btn-primary`, `.btn-secondary`, `.btn-test`, `.continue-button`, `.btn-export`, `.btn-import`, `.btn-share`, `.btn-copy` — they may be defined across styles-v3 and adaptive-v3). To each button family add, without removing existing properties:

```css
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-base), box-shadow var(--transition-base), transform var(--transition-base);
```

and a hover elevation (adapt the selector list to the actual rule structure in the file):

```css
.btn-primary:hover:not(:disabled),
.btn-secondary:hover:not(:disabled),
.btn-test:hover:not(:disabled),
.continue-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
```

Do NOT touch `:focus` rules — the existing `outline: 3px solid transparent` pattern must stay.

- [ ] **Step 3: Cards and modals (`adaptive-v3.css`)**

- `.selection-card`, `.feature-card`, `.settings-section`, `.content-info-box`: set `border-radius: var(--radius-md); box-shadow: var(--shadow-sm);` and on hover for interactive cards (`.selection-card:hover`) `box-shadow: var(--shadow-md); transform: translateY(-2px); transition: box-shadow var(--transition-base), transform var(--transition-base);`
- `.modal-content` (both modal systems — `.modal-overlay .modal-content` and `#shareLinkModal .modal-content`): `border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);`
- Modal overlays (`.modal-overlay`, `.modal`): add `backdrop-filter: blur(3px);` and an entry animation:

```css
@media (prefers-reduced-motion: no-preference) {
  .modal-overlay.active .modal-content,
  .modal[style*="flex"] .modal-content {
    animation: modal-in 180ms ease-out;
  }
  @keyframes modal-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to { opacity: 1; transform: none; }
  }
}
```

(If the `[style*="flex"]` selector proves brittle, add a `.open` class toggle in `generateShareLink`/`closeShareModal` instead and key the animation on `.modal.open .modal-content`.)

- [ ] **Step 4: Hero on the landing page**

`public/index.html` has an inline `<style>` where `.hero-section` uses `linear-gradient(135deg, var(--color-italian-green) 0%, #006a36 100%)` — legacy Italian branding. Replace with the ASR identity:

```css
    .hero-section {
      background: linear-gradient(135deg, var(--primary-blue) 0%, var(--dark-navy) 60%, #063a52 100%);
      color: white;
      padding: var(--spacing-xxl) var(--spacing-lg);
      border-radius: var(--radius-lg);
      margin-bottom: var(--spacing-xxl);
      text-align: center;
      box-shadow: var(--shadow-md);
    }
```

Check the rest of `index.html`'s inline styles for other `--color-italian-green` uses and switch them to `var(--accent-teal)` or `var(--primary-blue)` as appropriate (buttons/accents → teal, headings → primary blue). Do not remove the `--color-italian-*` variables from CSS (games may reference them).

- [ ] **Step 5: Visual verification (browser)**

Start `npx wrangler dev --port 8787` and view all 7 pages at desktop (1280px) and mobile (375px) widths. Checklist:
- Navigation renders above content on every page; dropdown works.
- Landing hero is blue/navy, readable (white on `#003DA5` is 8.2:1 — passes AA).
- Settings page: cards elevate on hover; modals animate in; no layout shifts.
- Each game page loads with no visual regressions in tiles/cards/canvas (games use `games-v3.css`, untouched).
Take screenshots if the browser tooling is available; otherwise report what was checked.

- [ ] **Step 6: Commit**

```bash
git add public/css/styles-v3.css public/css/adaptive-v3.css public/index.html public/llm-settings.html
git commit -m "Visual refresh: design tokens, card/modal elevation, motion, brand-blue hero

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Update repo CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (repo root — note: it has pre-existing uncommitted changes; incorporate them rather than reverting)

- [ ] **Step 1: Update the stale sections**

- Deployment: state BOTH live deployments — primary `https://stefanomorello.com/langames` (PHP on shared hosting, source `../LanGames-php/`, manual upload) and `https://langames.cuny.qzz.io` (this repo, auto-deploy on push to `main`).
- API routes table: remove the `/api/shorten-url` row; note the shortener was removed in July 2026.
- File structure: remove `game-content-loader*.js` and v1/v2 CSS entries; reflect current tree (`ls public/js public/css` to confirm).
- Share flow section: two paths only (server storage → short URL; fragment fallback → long URL). Remove the three-state modal description (now two states).
- Content generation flow: "4 API calls" → "8 concurrent API calls (1 wordle + 5 memory topics + 2 verb sets) via Promise.allSettled with one retry each and partial-failure recovery".
- Model list: replace API cost estimates section's stale model names with the Task 5 list.
- `generateAllContent` return shape: document `{content, failed}`.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md: dual deployments, parallel generation, simplified sharing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Full repo verification

**Files:** none (verification only)

- [ ] **Step 1: Static checks**

```bash
npm run check
node tests/content-repair.test.mjs && node tests/generate-sections.test.mjs
grep -rn "console.log" public/js/ ; echo "exit=$?"   # expect exit=1 (no matches)
grep -rn "shorten" public/ src/ --include='*.ts' --include='*.js' --include='*.html'   # expect no functional references
```

- [ ] **Step 2: API integration test against wrangler dev**

```bash
npx wrangler dev --port 8787 &
sleep 6
ID=$(curl -s -X POST http://localhost:8787/api/store-content -H 'Content-Type: application/json' \
  -d '{"language":"Italian","difficulty":"beginner","wordle":["mondo","terra"]}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
curl -s "http://localhost:8787/api/get-content?id=$ID" | python3 -m json.tool
curl -s -X POST http://localhost:8787/api/store-content -d 'not json' -o /dev/null -w '%{http_code}\n'   # expect 400
kill %1
```
Expected: round-trip returns the stored content without `_meta`; invalid JSON → 400.

- [ ] **Step 3: Browser walkthrough (HUMAN-ASSISTED — needs the user's OpenRouter API key)**

With `wrangler dev` running, ask the user to (or drive the browser if tooling is connected):
1. Open `http://localhost:8787/llm-settings.html`, enter API key, Test Connection → success.
2. Generate content (Italian / beginner) → progress counts up "N of 8 sections", completes in well under a minute.
3. Play each of the 5 games briefly — content loads, no console errors.
4. Share Link → short `?id=` URL appears with expiry date; open it in a private window → content loads, games playable without API key.
5. If any section fails → partial-failure box appears and "Retry failed sections" works.

Do not mark this plan complete until this step is confirmed.

---

### Task 12: Sync everything to `../LanGames-php/`

**Files (all in `/Users/veritas44/Downloads/github/LanGames-php/`):**
- Overwrite from repo `public/`: all 7 `*.html`, `js/llm-config.js`, `js/content-generator.js`, `js/gcl-1761141656.js`, `css/styles-v3.css`, `css/adaptive-v3.css`, `css/games-v3.css`
- Modify after copy: `js/gcl-1761141656.js` (PHP endpoints)
- Modify: `store-content.php` (rate-limit ordering)
- Delete: `shorten-url.php`, `test-url-length.js`, `css/styles-v2.css`, `css/games-v2.css`, `css/adaptive-v1.css`, `css/adaptive-v2.css`
- Modify: `CLAUDE.md` (PHP folder's own copy)

**Interfaces:**
- Consumes: all completed repo work.
- Produces: a deployable PHP folder, committed in its own git repo.

- [ ] **Step 1: Copy shared frontend files**

```bash
cd /Users/veritas44/Downloads/github/LanGames
cp public/*.html ../LanGames-php/
cp public/js/llm-config.js public/js/content-generator.js public/js/gcl-1761141656.js ../LanGames-php/js/
cp public/css/styles-v3.css public/css/adaptive-v3.css public/css/games-v3.css ../LanGames-php/css/
```

- [ ] **Step 2: Re-apply PHP endpoints in the copied `gcl-1761141656.js`**

The repo copy calls Worker routes. In `../LanGames-php/js/gcl-1761141656.js`, restore the PHP path helper and endpoints. Add back this helper method (place it right before `storeContentOnServer`):

```javascript
  // Helper to get correct server URL based on environment
  _getServerURL(filename) {
    // Auto-detect base URL from current page location
    const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
    return basePath + filename;
  },
```

Then in `storeContentOnServer` change `const storeURL = '/api/store-content';` → `const storeURL = this._getServerURL('store-content.php');`
and in `loadContentFromServer` change `const getURL = '/api/get-content?id=' + ...;` → `const getURL = this._getServerURL('get-content.php') + '?id=' + encodeURIComponent(id);`

Verify: `grep -n "api/store-content\|api/get-content\|api/shorten-url" ../LanGames-php/js/gcl-1761141656.js` → no matches.

- [ ] **Step 3: Delete removed files in the PHP folder**

```bash
cd /Users/veritas44/Downloads/github/LanGames-php
git rm shorten-url.php test-url-length.js js/game-content-loader.js js/game-content-loader-v4.js \
       css/styles-v2.css css/games-v2.css css/adaptive-v1.css css/adaptive-v2.css 2>/dev/null || true
ls js/ css/   # confirm what remains matches the repo's public/js + public/css (plus PHP files)
```
(If `js/game-content-loader*.js` don't exist in the PHP folder, the `|| true` covers it — check `ls` output.)

- [ ] **Step 4: Fix rate-limit ordering in `store-content.php`**

Reorder the top of the script to: CORS headers → OPTIONS handling → method check (405) → read input → size check (413) → JSON parse (400) → field validation (400) → content dir setup → rate-limit check + increment → ID generation → save. Concretely: move the two blocks (`// Simple rate limiting by IP ...` through `file_put_contents($rateLimitFile, ...)`) so they sit AFTER the `// Validate required fields` block, and move the `// Only accept POST requests` block up so it runs before reading input. The rate-limit code itself is unchanged — only its position moves.

- [ ] **Step 5: Verify the PHP endpoints locally**

```bash
cd /Users/veritas44/Downloads/github/LanGames-php
php -S localhost:8765 &
sleep 2
ID=$(curl -s -X POST http://localhost:8765/store-content.php -H 'Content-Type: application/json' \
  -d '{"language":"Italian","difficulty":"beginner","wordle":["mondo"]}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
curl -s "http://localhost:8765/get-content.php?id=$ID" | python3 -m json.tool
curl -s -X POST http://localhost:8765/store-content.php -d 'not json' -o /dev/null -w '%{http_code}\n'   # expect 400
kill %1
rm -rf content/   # clean up test artifacts created locally (the deployed server has its own content/)
```
Expected: store→get round-trip works; invalid JSON → 400 without consuming rate limit. Note: `store-content.php` hardcodes the share URL base to `https://stefanomorello.com/langames` except for localhost:8765 — the test uses port 8765 deliberately.

Also open `http://localhost:8765/llm-settings.html` in a browser: no console errors, share modal opens.

- [ ] **Step 6: Update the PHP folder's CLAUDE.md and docs**

Apply the same content edits as Task 10 to `../LanGames-php/CLAUDE.md` (it is a separate file with PHP-specific sections — update the share flow, model list, generation flow, and remove shorten-url references). Also update `UPLOAD-INSTRUCTIONS.md` if it lists `shorten-url.php` among files to upload.

- [ ] **Step 7: Commit the PHP repo**

```bash
cd /Users/veritas44/Downloads/github/LanGames-php
git add -A
git commit -m "Event modernization: parallel generation, current models, simplified sharing, visual refresh

Synced from LanGames repo (Cloudflare version) with PHP endpoint adaptations.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Ship

**Files:** none (operations)

- [ ] **Step 1: Push the repo (deploys Cloudflare version)**

Confirm with the user first, then:

```bash
cd /Users/veritas44/Downloads/github/LanGames
git push origin main
sleep 90
curl -s https://langames.cuny.qzz.io/api/health
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://langames.cuny.qzz.io/api/shorten-url   # expect 404 after deploy
```

- [ ] **Step 2: User uploads the PHP folder**

Tell the user exactly what changed for the shared-hosting upload:
- Upload (overwrite): all `*.html`, `js/llm-config.js`, `js/content-generator.js`, `js/gcl-1761141656.js`, `css/styles-v3.css`, `css/adaptive-v3.css`, `css/games-v3.css`, `store-content.php`
- Delete on server: `shorten-url.php`, `test-url-length.js`, `css/styles-v2.css`, `css/games-v2.css`, `css/adaptive-v1.css`, `css/adaptive-v2.css`
- Do NOT touch the server's `content/` directory (holds students' shared content).

- [ ] **Step 3: Post-deploy smoke test on the live site**

After the user uploads:

```bash
curl -s https://stefanomorello.com/langames/js/gcl-1761141656.js | grep -c "shortenURL"   # expect 0
curl -s https://stefanomorello.com/langames/llm-settings.html | grep -c "gemini-3.1-flash-lite\"" # expect ≥1
```

Then the user repeats the Task 11 Step 3 walkthrough once against the live site before the event.
