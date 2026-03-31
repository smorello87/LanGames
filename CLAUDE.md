# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**LanGames** is an AI-powered multilingual language learning platform that generates custom educational content for 10 languages using LLM APIs. This is a standalone static web application with no build process or backend dependencies.

**Key Distinction**: This is the `llm-version/` folder which is completely independent from the parent `impariamo/` project. The parent project contains hardcoded Italian games, while LanGames generates dynamic content via AI for any supported language.

## Architecture

### Technology Stack
- **Frontend**: Pure HTML5, CSS3, Vanilla JavaScript (no frameworks)
- **Storage**: Browser localStorage for settings and generated content
- **AI Integration**: OpenRouter or Open Web UI APIs for content generation
- **Hosting**: Static files - works on any web server or locally

### File Structure

```
llm-version/
├── index.html                    # Landing page with features/FAQ
├── llm-settings.html             # API config + content generation (merged hub)
├── wordle-adaptive.html          # 5-letter word guessing game
├── memory-adaptive.html          # Vocabulary matching game
├── fiore-adaptive.html           # Flower word guessing game (petal-based learning)
├── tenses-adaptive.html          # Verb conjugation wheel (present tense)
├── reflexives-adaptive.html      # Reflexive verb conjugation wheel
├── css/
│   ├── styles-v3.css            # Base styles, navigation, z-index hierarchy
│   ├── games-v3.css             # Game-specific styles (cards, tiles, canvas)
│   └── adaptive-v3.css          # LanGames-specific styles (FAQ, selections)
├── js/
│   ├── llm-config.js            # API settings storage/validation
│   ├── content-generator.js     # LLM API calls and content generation
│   └── gcl-1761141656.js        # Game content loader (localStorage, URL sharing)
├── flower/                       # Flower images (flower0.jpg - flower8.jpg)
├── shorten-url.php               # PHP proxy for URL shortening (bypasses CORS)
├── tests/                        # Development test files (gitignored, not deployed)
└── docs/
    └── README.md                # Complete documentation
```

**Note**: The `tests/` folder contains development test files and is excluded from deployment via `.gitignore`.

### Design System

**Color Palette (ASR-inspired):**
- Primary Blue: `#003DA5`
- Secondary Blue: `#002D72`
- Dark Navy: `#001F4C`
- Accent Red: `#DC143C`
- Accent Teal: `#0891B2`, `#0E7490` (Navigation background)
- Light Gray: `#F8F9FA`
- Text: `#212529` (dark), `#6C757D` (muted)

**Critical CSS Variables:**
All these MUST be defined in styles-v3.css for games to work properly:
- `--color-green-light: #6AAA64` - Wordle correct letters
- `--color-green-dark: #538d4e` - Success messages
- `--color-red-dark: #b71c1c` - Memory card gradients, error messages
- `--accent-teal: #0891B2` - Test connection button (also in adaptive-v3.css)

**Z-Index Hierarchy (CRITICAL):**
```css
:root {
  --z-base: 1;              /* Game elements (canvas, cards) */
  --z-dropdown: 100;        /* Nav dropdowns */
  --z-mobile-menu: 150;     /* Navigation layer */
  --z-modal: 200;           /* Progress modals */
  --z-notification: 300;    /* Alerts */
}
```

**Important**: Navigation MUST always appear above game content (canvas elements). Games use `z-index: 1`, navigation uses `z-index: 150`.

## Core Workflow

### Content Generation Flow
1. User configures API settings in `llm-settings.html` (Section 1)
2. User selects language + difficulty (Section 2)
3. `ContentGenerator.generateAllContent()` makes 4 API calls:
   - 15 Wordle words (5-letter)
   - 60 Memory pairs (5 topics × 12 pairs)
   - 20 Regular verbs with conjugations
   - 15 Reflexive verbs with conjugations
4. Content saved to `localStorage` key `game-content`
5. Games load content via `GameContentLoader.loadContent()`

### localStorage Keys
- `llm-settings`: API configuration (provider, endpoint, key, model)
- `game-content`: Generated content (language, difficulty, all game data)

### URL-Based Content Sharing with Automatic Shortening
**For Teachers**: Share generated content with students via URL - no API key required for students!

**How it works:**
1. Teacher generates content in `llm-settings.html`
2. Click "🔗 Share Link" button
3. Modal shows progress bar while automatically shortening URL via server
4. Wait 2-3 seconds → Short URL appears (e.g., `https://is.gd/abc123`)
5. Copy and share the short link with students
6. Students click the link → content automatically loads into their browser
7. Students can play all 5 games without needing an API key!

**Technical Details:**
- Content is Base64-encoded: `#content=<base64-encoded-json>`
- **CRITICAL: Uses URL fragment (`#`) not query parameter (`?`)** to bypass Apache "Request-URI Too Long" errors
  - Fragments are NOT sent to server, only processed by browser JavaScript
  - This allows ~13k character URLs to work without server rejection
- Uses URL-safe Base64 encoding (replaces +/= with -_)
- Typical URL length: ~12,700 characters (9,500 JSON → base64 expansion ~133%)
- **Automatic URL Shortening**: PHP proxy on server bypasses CORS restrictions
  - JavaScript calls `shorten-url.php` on your server
  - PHP makes server-to-server API calls (no CORS)
  - Tries multiple free services: is.gd (primary), v.gd, Clck.ru, dagd
  - Final short URL is typically 20-30 characters
  - No deprecated APIs - all services are actively maintained (as of 2025)
- URL automatically parsed on page load via `GameContentLoader.initFromURLAsync()`
- Content is saved to student's localStorage for persistent access
- URL fragment is removed from browser history for clean URLs

**Files Updated:**
- **`shorten-url.php`** (NEW): PHP proxy for URL shortening, bypasses CORS
- `js/gcl-1761141656.js`: Updated `shortenURL()` to call PHP proxy instead of APIs directly
- `llm-settings.html`: Automatic shortening workflow in modal
- `index.html`: Checks for URL content on landing page
- All game files: Call `GameContentLoader.initFromURLAsync()` on page load
- `css/adaptive-v3.css`: Modal and button styles for share UI
- `css/styles-v3.css`: Added `--color-orange` variable

**Share Modal UI (Three-State Design):**
1. **Progress State**: Animated progress bar with gradient while shortening URL
2. **Success State**: Shows shortened URL with copy button and instructions
3. **Fallback State**: Shows long URL if shortening fails (service unavailable)

**Security Note:**
- API keys are NEVER included in share URLs - only generated content is shared
- Warning in UI advises users not to generate content on shared/public computers
- API configuration stays private in each user's browser localStorage
- PHP endpoints use origin-based CORS allowlist (not wildcard `*`)
- `store-content.php` has IP-based rate limiting (10 stores/hour)
- `shorten-url.php` blocks SSRF (private IPs, non-http schemes, no redirect following)
- Share URLs use hardcoded canonical base URL to prevent Host header injection
- All user-facing text uses `textContent` (not `innerHTML`) to prevent XSS
- API key prefix is NOT logged to browser console

**PHP Proxy Architecture:**
```
Browser → PHP Proxy → URL Shortener API
(CORS OK)  (No CORS)  (Returns short URL)
```

**Why This Works:**
- Browser can call PHP on same domain (no CORS)
- PHP can call external APIs server-to-server (no CORS)
- Uses cURL with 10-second timeout and fallback services
- Handles errors gracefully - falls back to long URL if all services fail

**Encoding Implementation:**
```javascript
// Simple Base64 encoding (no compression)
const base64 = btoa(unescape(encodeURIComponent(jsonStr)))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');
```

**Why Simple Base64 Encoding:**
- Previous LZW compression attempts failed due to JavaScript's UTF-16 string handling
- Simple Base64 is reliable and works with all Unicode (Cyrillic, CJK, Arabic)
- Server-side URL shortening reduces final URL to ~20-30 chars regardless of encoding

**Deployment Requirements:**
- PHP 7.4+ with `curl` and `json` extensions
- Upload `shorten-url.php` to server root alongside HTML files
- See `DEPLOYMENT.md` for complete instructions

**Alternative Methods:**
- **Export/Import**: Download JSON file for manual sharing (no URL length limits)
- **Direct localStorage**: For development/testing only

### No Fallback Content Rule
**CRITICAL**: All games check for generated content on load. If no content exists:
- Show alert: "No content available. Please go to Settings and generate content first."
- Redirect to `llm-settings.html`
- **NO hardcoded fallback data** in any game file

## Development Commands

```bash
# Start PHP development server (RECOMMENDED - supports URL shortening)
php -S localhost:8765
# Navigate to http://localhost:8765/

# Alternative: Python server (URL shortening won't work)
python3 -m http.server 8765
# Navigate to http://localhost:8765/

# Test URL shortening locally (requires PHP server)
curl -X POST http://localhost:8765/shorten-url.php \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'

# Clear generated content (browser console)
localStorage.removeItem('game-content')

# Clear API settings (browser console)
localStorage.removeItem('llm-settings')

# Clear everything
localStorage.clear()
```

**Important**:
- Use PHP server for full functionality including URL shortening
- Python server works but share link button will fall back to long URLs
- The JS automatically detects localhost and uses `/shorten-url.php` relative path

## Key Implementation Details

### CSS Version Management

**Current Version: v3**

All HTML files link to CSS v3:
```html
<link rel="stylesheet" href="css/styles-v3.css">
<link rel="stylesheet" href="css/games-v3.css">
<link rel="stylesheet" href="css/adaptive-v3.css">
```

**When updating CSS:**
1. Modify files in `llm-version/css/` (v3 files)
2. If making major changes, increment version (v3 → v4) and update ALL 7 HTML files
3. Test contrast ratios: Minimum 4.5:1 for WCAG AA compliance
4. Verify navigation z-index remains highest (150)

### Verb Conjugation Data Structure (CRITICAL)

**Problem**: LLMs may return conjugation keys in different formats:
- Combined with slash: `"él/ella": "habla"` or `"ellos/ellas": "hablan"`
- Combined with underscore: `"er_sie_es": "spielt"` or `"sie_Sie": "spielen"` (German)
- Individual: `"él": "habla"`, `"ella": "habla"` (separate keys)
- Capitalized vs lowercase: `"Yo"` vs `"yo"`

**Solution**: Use flexible key lookup in verb wheel games (tenses-adaptive.html, reflexives-adaptive.html):

```javascript
function findConjugationKey(pronoun, conjugations) {
  // Try exact match first
  if (conjugations[pronoun]) return pronoun;

  // Try capitalized version
  const capitalized = pronoun.charAt(0).toUpperCase() + pronoun.slice(1);
  if (conjugations[capitalized]) return capitalized;

  // Try lowercase version
  const lowercased = pronoun.toLowerCase();
  if (conjugations[lowercased]) return lowercased;

  // Check for combined keys like "él/ella", "ellos/ellas", or "er_sie_es", "sie_Sie"
  for (const key of Object.keys(conjugations)) {
    // Split on slash or underscore and check if pronoun matches any part
    const parts = key.split(/[/_]/).map(p => p.trim().toLowerCase());
    if (parts.includes(pronoun.toLowerCase())) {
      return key;
    }
  }

  return null;
}
```

**Subject Pronouns**: Must include language-specific pronouns for all 10 supported languages:
```javascript
// Examples for each language
if (lang === 'spanish') {
  subjects = ["yo", "tú", "él", "ella", "nosotros", "vosotros", "ellos", "ellas"];
} else if (lang === 'german') {
  subjects = ["ich", "du", "er", "sie", "es", "wir", "ihr"];
} else if (lang === 'russian') {
  subjects = ["я", "ты", "он", "она", "мы", "вы", "они"];
} else if (lang === 'japanese') {
  subjects = ["私", "あなた", "彼", "彼女", "私たち", "あなたたち", "彼ら"];
} else if (lang === 'chinese') {
  subjects = ["我", "你", "他", "她", "我们", "你们", "他们"];
} else if (lang === 'korean') {
  subjects = ["나", "너", "그", "그녀", "우리", "너희", "그들"];
} else if (lang === 'arabic') {
  subjects = ["أنا", "أنت", "هو", "هي", "نحن", "أنتم", "هم"];
}
// Italian, French, Portuguese also defined
```

This ensures the game displays correct pronouns for each language and can match against combined keys.

### Reflexive Verb Answer Validation (CRITICAL)

**Problem**: Reflexive verb conjugations include the subject pronoun in the answer value (e.g., `"ich": "ich wasche mich"`). This is correct and necessary to show which reflexive pronoun to use, but the game must handle validation properly.

**Solution**: Accept both forms - with and without the subject pronoun:

```javascript
const correctAnswer = conjugations[conjugationKey]; // e.g., "ich wasche mich"
const correctLower = correctAnswer.toLowerCase();

// Extract the verb part without the subject pronoun at the start
const subjectPattern = new RegExp(`^${currentSubject.toLowerCase()}\\s+`, 'i');
const verbPartOnly = correctLower.replace(subjectPattern, '').trim();

// Accept either:
// 1. Full answer with subject: "ich wasche mich"
// 2. Just the verb part: "wasche mich"
if (userInput === correctLower || userInput === verbPartOnly) {
  // Correct!
}
```

**Important**: Do NOT prepend the subject pronoun to the answer again, as this creates duplicates like "ich ich wasche mich".

### LLM Content Generation Prompts (CRITICAL)

**Wordle Words - Enforce Exact Length**:
```javascript
// MUST specify "EXACTLY 5 letters" multiple times
// For non-Latin alphabets, emphasize counting characters in native script
const prompt = `Generate exactly 15 words in ${language}...
CRITICAL REQUIREMENT: Every single word MUST be exactly 5 letters long when written in ${language}. Count the letters carefully.
...
VERIFY: Before returning, double-check that each word is exactly 5 letters long.`;
```

**Memory Game - Limit Word Length**:
```javascript
// Words must fit on cards - limit to 12 characters
const prompt = `Generate exactly 12 word pairs...
- CRITICAL: Words must be SHORT - maximum 12 characters for ${language} words, maximum 14 characters for English
- Use SINGLE WORDS only - no phrases with spaces
- If a concept requires multiple words, choose a simpler single-word alternative`;
```

**Reflexive Verbs - Include Full Conjugations**:
```javascript
// Conjugations MUST include the subject pronoun for clarity
const prompt = `Generate exactly 15 reflexive verbs...
IMPORTANT - Conjugation Format for Reflexive Verbs:
- Include the FULL conjugated form with both subject pronoun and reflexive pronoun
- This ensures clarity about which reflexive pronoun to use (mich/dich/sich in German, me/te/se in Spanish, etc.)
- Example for German: "ich": "ich wasche mich", "du": "du wäschst dich", "er_sie_es": "er/sie/es wäscht sich"`;
```

### Games Must Not Have Difficulty Selectors

**CRITICAL**: Games should NOT include difficulty selection dropdowns. Difficulty is selected once during content generation in `llm-settings.html`.

**Wrong (Wordle had this bug)**:
```html
<section id="levelSelection">
  <h2>Select Difficulty Level</h2>
  <select id="levelSelect">
    <option value="beginner">Beginner</option>
    ...
  </select>
</section>
```

**Correct**:
```html
<section id="startScreen">
  <h2>Wordle Game</h2>
  <p>Guess the 5-letter word in 6 tries!</p>
  <button onclick="startGame()">Start Game</button>
</section>
```

Games should display the selected language and difficulty from stored content in the session info area at the top, but NOT allow changing it.

### Navigation Structure

Navigation is consistent across all 7 HTML files. Includes skip-link, ARIA attributes, and keyboard accessibility:

```html
<a class="sr-only skip-link" href="#main-content">Skip to main content</a>
<!-- ... header ... -->
<nav aria-label="Main navigation">
  <button class="hamburger" onclick="toggleMenu()" aria-label="Open navigation menu" aria-expanded="false" aria-controls="main-menu"><span aria-hidden="true">☰</span></button>
  <div class="menu-items" id="main-menu">
    <a href="index.html">Home</a>
    <a href="llm-settings.html">Settings</a>
    <div class="dropdown" onclick="toggleDropdown(event)">
      <a href="#" role="button" aria-haspopup="true" aria-expanded="false" onclick="event.preventDefault()">Games</a>
      <div class="dropdown-content">
        <a href="wordle-adaptive.html">Wordle</a>
        <a href="memory-adaptive.html">Memory Game</a>
        <a href="fiore-adaptive.html">Flower</a>
        <a href="tenses-adaptive.html">Verb Tenses Wheel</a>
        <a href="reflexives-adaptive.html">Reflexive Verbs Wheel</a>
      </div>
    </div>
  </div>
</nav>
<!-- ... -->
<main id="main-content" class="container">
```

**Required JavaScript for Navigation:**
```javascript
function toggleMenu() {
  const menu = document.querySelector('nav .menu-items');
  const hamburger = document.querySelector('nav .hamburger');
  const isOpen = menu.classList.toggle('show-menu');
  hamburger.setAttribute('aria-expanded', isOpen);
  hamburger.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
}

function toggleDropdown(event) {
  event.stopPropagation();
  const dropdown = event.currentTarget;
  const isOpen = dropdown.classList.toggle('active');
  const trigger = dropdown.querySelector('a');
  if (trigger) trigger.setAttribute('aria-expanded', isOpen);
}
```

**When updating navigation:**
- Update ALL 7 HTML files
- Maintain hamburger `<button>` (not `<div>`) with ARIA attributes
- Keep dropdown z-index above game content
- Ensure both `toggleMenu()` and `toggleDropdown()` functions are present
- Dropdown toggles on all viewport widths (not mobile-only)

### Flower Game (fiore-adaptive.html)

**Important Notes:**
- Game name is "Flower" in navigation (not "Fiore")
- Uses petal-based learning paradigm (not "lives")
- Display shows: "Petals: X / 8" (progress indicator)
- Instructions: "Each wrong guess adds a petal to help the flower bloom!"
- Image path: `flower/flower0.jpg` to `flower/flower8.jpg` (local directory, not `../flower/`)
- Win message includes petal count: "Congratulations! You won with X petal(s)!"
- Lose message: "Game Over! The flower has fully bloomed. The word was: [answer]"

### Button Sizing (Export/Import Buttons)

**Problem**: Labels and buttons can have different sizes even with identical CSS.

**Solution**: Use explicit sizing with these properties:
```css
.btn-export,
.btn-import {
  height: 48px;              /* Fixed height, not min-height */
  width: fit-content;        /* Size to content */
  padding: 0 24px;           /* Horizontal only */
  margin: 0;                 /* Reset margin */
  box-sizing: border-box;    /* Include border in size */
  white-space: nowrap;       /* Prevent wrapping */
  line-height: 1;            /* Consistent line height */
  vertical-align: middle;    /* Align on same baseline */
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

When using `<label>` as button, move hidden `<input>` outside the label element to prevent layout issues.

### Password Toggle Positioning

Password input fields with toggle buttons require special CSS:

```css
.password-wrapper {
  position: relative;
}

.password-wrapper input {
  padding-right: 50px; /* Make room for toggle button */
}

.password-toggle {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  min-width: 44px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Mobile Responsive Design

**Breakpoints:**
- `768px` - Tablet (2-3 column grids)
- `600px` - Mobile (single column, full-width buttons)

**Touch Targets**: Minimum 44px for all interactive elements (WCAG AAA)

**Input Font Size**: 16px minimum to prevent iOS auto-zoom

**Mobile Dropdown Behavior:**
- Desktop (>600px): Hover OR click to expand dropdown
- Mobile (≤600px): Click to toggle dropdown via `toggleDropdown(event)`
- CSS uses `.dropdown.active .dropdown-content { max-height: 500px; }` for expansion
- Without `toggleDropdown()` function, mobile dropdowns won't work
- Dropdown trigger uses `role="button"` + `aria-haspopup` + `aria-expanded` for keyboard access

## Accessibility (WCAG 2.1 AA)

### Required Patterns for All Pages
- **Skip link**: Every page starts with `<a class="sr-only skip-link" href="#main-content">` (visible on focus)
- **Page landmark**: `<main id="main-content">` as skip target
- **Nav label**: `<nav aria-label="Main navigation">`
- **Hamburger button**: Must be `<button>` (not `<div>`) with `aria-expanded` and `aria-label`
- **Focus indicators**: Use `outline: 3px solid transparent` (not `outline: none`) so outlines appear in Windows High Contrast Mode. Forced-colors media query provides explicit fallback.

### Game-Specific Accessibility
- **Session info**: Use `textContent` (never `innerHTML`) to display language/difficulty from stored content
- **Feedback regions**: All game feedback divs must have `aria-live="polite" aria-atomic="true"`
- **Game inputs**: Must have `aria-label` (e.g., `aria-label="Enter your 5-letter guess"`)
- **Memory cards**: Use `role="button"`, `tabindex="0"`, `aria-label`, and keyboard handlers (Enter/Space)
- **Canvas wheels**: Use `role="img"` + `aria-label="Spinning verb wheel"`, with `aria-live` on result div
- **Flower image**: `alt` text must update dynamically in `updateImage()` to reflect petal count

### Modal Accessibility
- Progress and share modals require: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- FAQ buttons require: `aria-expanded` toggled by `toggleFAQ()`
- Password toggles: `aria-label` switches between "Show password"/"Hide password"

### Decorative Content
- Emoji in buttons must be wrapped in `<span aria-hidden="true">` to prevent screen reader confusion
- FAQ arrow spans use `aria-hidden="true"`

### LLM Response Validation (Security + Accessibility)
All `content-generator.js` parsers validate response structure before storing:
- Wordle: must be non-empty array of strings
- Memory: must be non-empty array with language key + english field per pair
- Verb tenses/reflexives: must be non-empty array with infinitive, english, conjugations per entry

This prevents malformed LLM output from breaking games with confusing error states.

## Common Issues and Solutions

### Wordle Tiles Showing White on White
**Cause**: Missing CSS variable `--color-green-light`
**Fix**: Add to styles-v3.css:
```css
--color-green-light: #6AAA64;
--color-green-dark: #538d4e;
--color-red-dark: #b71c1c;
```

### Memory Cards All White/No Back Design
**Cause**: Missing CSS variable `--color-red-dark`
**Fix**: Add to styles-v3.css (same as above)

### Verb Wheel "No Conjugation Found" Error
**Cause**: LLM returns combined pronoun keys like "él/ella" or "er_sie_es" but game looks for individual pronouns
**Fix**: Implement flexible `findConjugationKey()` function that splits on both "/" and "_" and matches parts (see Verb Conjugation Data Structure section above)

### Verb Wheel Shows Wrong Language Pronouns
**Cause**: Missing language mapping in pronoun selection - game defaults to Italian pronouns
**Fix**: Add language-specific pronoun arrays for all 10 supported languages in both `tenses-adaptive.html` and `reflexives-adaptive.html` (see Subject Pronouns section above)

### German Reflexive Verbs Show Pronoun Twice
**Cause**: Answer validation was prepending subject pronoun to an answer that already included it
**Fix**: Use regex to extract verb-only part and accept both full answer and verb-only answer (see Reflexive Verb Answer Validation section above)

### Wordle Words Not All 5 Letters (especially in Russian/Chinese)
**Cause**: LLM prompt not emphatic enough about exact length requirement for non-Latin alphabets
**Fix**: Update prompt to emphasize "EXACTLY 5 letters" and add verification step (see LLM Content Generation Prompts section)

### Memory Game Words Too Long, Don't Fit in Cards
**Cause**: No length restrictions in LLM prompt allowed 14+ character words and multi-word phrases
**Fix**: Add maximum 12 character limit and require single words only (see LLM Content Generation Prompts section)

### Wheel Result Disappears After Submitting Answer
**Cause**: Code hides input container immediately: `conjugationInput.style.display = "none"`
**Fix**: Comment out or remove that line to keep feedback visible

### Mobile Dropdown Not Working
**Cause**: Missing `toggleDropdown(event)` function or missing `onclick="toggleDropdown(event)"` attribute
**Fix**: Add both the onclick handler to `<div class="dropdown">` and the JavaScript function

### Navigation Disappearing Behind Games
**Cause**: Game canvas/cards have higher z-index than navigation
**Fix**: Ensure nav uses `z-index: var(--z-mobile-menu)` (150) and game elements use `z-index: var(--z-base)` (1)

### Password Toggle Button Outside Input
**Cause**: Input padding-right not set, or toggle button positioning incorrect
**Fix**: Add `padding-right: 50px` to password inputs and ensure toggle uses `right: 4px`

### Content Not Loading in Games
**Cause**: No generated content in localStorage
**Fix**: Games should redirect to settings with alert message (no fallback data)

### Module Not Defined Errors
**Cause**: Scripts loading before modules are available
**Fix**: Add `defer` attribute to all `<script>` tags that load modules

### Flower Images Not Loading
**Cause**: Incorrect image path (using `../flower/` instead of `flower/`)
**Fix**: Update paths to `flower/flower0.jpg` through `flower/flower8.jpg`

### Export/Import Buttons Different Sizes
**Cause**: Label and button elements have different default behaviors
**Fix**: Use fixed `height`, `width: fit-content`, and `vertical-align: middle` (see Button Sizing section)

### Share Link Not Working / Content Not Loading from URL
**Cause**: HTML files loading old `game-content-loader.js` instead of `gcl-1761141656.js`
**Fix**: Update all HTML files to reference `<script src="js/gcl-1761141656.js" defer></script>`

**Cause**: URL fragment not being parsed on page load
**Fix**: Ensure `await GameContentLoader.initFromURLAsync()` is called in async DOMContentLoaded handler before `loadCustomContent()`

**Cause**: URL too long (>13k chars) causing Apache "Request-URI Too Long" error
**Fix**: Update to use URL fragment (`#content=`) instead of query parameter (`?content=`). Fragments bypass server length limits.

**Cause**: URL encoding issues with special characters (Cyrillic, CJK, Arabic)
**Fix**: System uses `encodeURIComponent()` + Base64 which handles all Unicode correctly - if issues persist, check browser console for errors

**Cause**: URL shortening service fails (503 error)
**Fix**: System automatically falls back to long URL. PHP proxy tries multiple services (is.gd, v.gd, Clck.ru, dagd) - at least one should work.

### Share Link Modal Not Appearing
**Cause**: Modal CSS not loaded or display property not set correctly
**Fix**: Ensure `adaptive-v3.css` is loaded and modal has `display: flex` when open

### Copy Button Not Working
**Cause**: Browser security restrictions on clipboard access
**Fix**: Uses `navigator.clipboard.writeText()` (modern API). Falls back to manual selection if that fails - user can click input field and use Ctrl+C/Cmd+C

## Footer Attribution (REQUIRED)

All HTML files must include CUNY AI Lab attribution:

```html
<footer>
  <div class="footer-text">
    <p>
      Based on <a href="https://beatricecarnelutti.com/impariamo">Beatrice Carnelutti's Impariamo l'Italiano</a>
    </p>
    <p>
      This tool was developed as part of the CUNY AI Lab, a project coordinated by the
      <a href="https://ashp.cuny.edu" target="_blank" rel="noopener">American Social History Project/Center for Media and Learning</a>,
      <a href="https://cuny.is/gcdi" target="_blank" rel="noopener">Graduate Center Digital Initiatives</a>,
      the <a href="https://library.gc.cuny.edu/" target="_blank" rel="noopener">Mina Rees Library</a>,
      and the <a href="https://tlc.commons.gc.cuny.edu/" target="_blank" rel="noopener">Teaching and Learning Center</a>.
    </p>
  </div>
</footer>
```

## Supported Languages

Italian, Spanish, French, German, Portuguese, Japanese, Chinese, Korean, Russian, Arabic

**Adding new languages:**
1. Add to language selection in `llm-settings.html`
2. Update subject pronouns mapping in verb wheel game files
3. Test content generation with your API provider

## API Cost Estimates

- OpenRouter + GPT-3.5-turbo: ~$0.05-$0.10 per full content generation
- OpenRouter + Claude: ~$0.15-$0.25 per generation
- OpenRouter + GPT-4: ~$0.30-$0.50 per generation
- Open Web UI (self-hosted): Free

One generation creates content for all 5 games (15 words, 60 pairs, 35 verbs).
