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
│   └── game-content-loader.js   # localStorage import/export
├── flower/                       # Flower images (flower0.jpg - flower8.jpg)
└── docs/
    └── README.md                # Complete documentation
```

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

### No Fallback Content Rule
**CRITICAL**: All games check for generated content on load. If no content exists:
- Show alert: "No content available. Please go to Settings and generate content first."
- Redirect to `llm-settings.html`
- **NO hardcoded fallback data** in any game file

## Development Commands

```bash
# Open site locally
open llm-version/index.html

# Start local server (required for proper module loading)
python3 -m http.server 8000
# Navigate to http://localhost:8000/llm-version/

# Clear generated content (browser console)
localStorage.removeItem('game-content')

# Clear API settings (browser console)
localStorage.removeItem('llm-settings')

# Clear everything
localStorage.clear()
```

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
- Combined: `"él/ella": "habla"` or `"ellos/ellas": "hablan"`
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

  // Check for combined keys like "él/ella" or "ellos/ellas"
  for (const key of Object.keys(conjugations)) {
    const parts = key.split('/').map(p => p.trim().toLowerCase());
    if (parts.includes(pronoun.toLowerCase())) {
      return key;
    }
  }

  return null;
}
```

**Subject Pronouns**: Include both masculine and feminine forms in the subject array:
```javascript
// Spanish example
subjects = ["yo", "tú", "él", "ella", "nosotros", "vosotros", "ellos", "ellas"];
```

This ensures the game can select individual pronouns even when LLM returns combined keys.

### Navigation Structure

Navigation is consistent across all 7 HTML files:

```html
<nav>
  <div class="hamburger" onclick="toggleMenu()">☰</div>
  <div class="menu-items">
    <a href="index.html">Home</a>
    <a href="llm-settings.html">Settings</a>
    <div class="dropdown" onclick="toggleDropdown(event)">
      <a href="#">Games</a>
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
```

**Required JavaScript for Navigation:**
```javascript
function toggleMenu() {
  const menu = document.querySelector('nav .menu-items');
  menu.classList.toggle('show-menu');
}

function toggleDropdown(event) {
  // Only toggle on mobile (when hamburger is visible)
  if (window.innerWidth <= 600) {
    event.stopPropagation();
    const dropdown = event.currentTarget;
    dropdown.classList.toggle('active');
  }
}
```

**When updating navigation:**
- Update ALL 7 HTML files
- Maintain hamburger menu for mobile
- Keep dropdown z-index above game content
- Ensure both `toggleMenu()` and `toggleDropdown()` functions are present

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
- Desktop (>600px): Hover to expand dropdown
- Mobile (≤600px): Click to toggle dropdown via `toggleDropdown(event)`
- CSS uses `.dropdown.active .dropdown-content { max-height: 500px; }` for expansion
- Without `toggleDropdown()` function, mobile dropdowns won't work

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
**Cause**: LLM returns combined pronoun keys like "él/ella" but game looks for individual "ella"
**Fix**: Implement flexible `findConjugationKey()` function that splits on "/" and matches parts (see Verb Conjugation Data Structure section above)

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
