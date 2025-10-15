# LLM Version - File Reference

Quick reference for all files in the LLM-powered language learning system.

## Directory Structure

```
llm-version/
├── index.html              # Landing page - START HERE
├── llm-settings.html       # Configure API keys and models
├── adaptive-hub.html       # Generate and manage content
├── wordle-adaptive.html    # Play Wordle with generated content
├── memory-adaptive.html    # Play Memory game with generated content
├── css/
│   └── adaptive-v1.css     # LLM-specific styles
├── js/
│   ├── llm-config.js       # API settings management
│   ├── content-generator.js # LLM content generation
│   └── game-content-loader.js # Content storage and loading
└── docs/
    ├── README.md           # Full documentation
    ├── QUICK-START.md      # 5-minute setup guide
    ├── TROUBLESHOOTING.md  # Common issues and solutions
    └── FILE-REFERENCE.md   # This file
```

## HTML Pages

### index.html
**Purpose:** Landing page and introduction
**URL:** `/llm-version/index.html` or `/llm-version/`
**Contains:**
- Feature overview
- Supported languages (10 languages)
- How it works walkthrough
- FAQ section
- CTA buttons to settings and content generation

**Use when:** First-time visitors need to understand what this is

---

### llm-settings.html
**Purpose:** Configure LLM provider and API key
**URL:** `/llm-version/llm-settings.html`
**Contains:**
- Provider tabs (OpenRouter, Open Web UI)
- API endpoint configuration
- API key input (password protected)
- Model selection dropdown
- Test Connection button
- Save/Cancel buttons

**Use when:** Setting up for first time or changing API provider

**Form Fields:**
- OpenRouter endpoint: `https://openrouter.ai/api/v1/chat/completions`
- OpenRouter key: `sk-or-v1-...`
- Model: `anthropic/claude-3.5-sonnet` (recommended)

**Navigation:**
- Saves to `localStorage` with key `llm-settings`
- Redirects to `adaptive-hub.html` after save
- Cancel returns to `adaptive-hub.html`

---

### adaptive-hub.html
**Purpose:** Main content generation and management hub
**URL:** `/llm-version/adaptive-hub.html`
**Contains:**
- Language selection (10 languages)
- Difficulty selection (Beginner, Intermediate, Advanced)
- Generate Content button
- Progress modal during generation
- Current content display
- Export/Import buttons
- Game links (Wordle, Memory)

**Use when:** Generating new content or managing existing content

**Features:**
- Verifies modules are loaded (with defer fix)
- Checks for API settings
- Shows generation progress
- Stores content in `localStorage` with key `game-content`
- Exports as JSON file
- Imports JSON files from teachers

**Generation Time:** 2-5 minutes for full content set

---

### wordle-adaptive.html
**Purpose:** Play Wordle with generated content
**URL:** `/llm-version/wordle-adaptive.html`
**Contains:**
- 5-letter word guessing game
- 6 attempts to guess
- Color-coded feedback (green/yellow/gray)
- Uses generated words from localStorage

**Content Structure:**
```json
{
  "wordle": [
    "word1",
    "word2",
    ...
    "word15"
  ]
}
```

**Note:** May need path updates if moved

---

### memory-adaptive.html
**Purpose:** Play Memory matching game with generated content
**URL:** `/llm-version/memory-adaptive.html`
**Contains:**
- Topic selection (food, daily, family, school, work)
- Card matching game
- Target language + English pairs
- Flip cards to find matches

**Content Structure:**
```json
{
  "memory": {
    "food": [
      { "word": "parola", "english": "translation" },
      ...
    ],
    "daily": [...],
    "family": [...],
    "school": [...],
    "work": [...]
  }
}
```

**Note:** May need path updates if moved

---

## JavaScript Modules

### js/llm-config.js
**Purpose:** Manage API settings and test connections
**Size:** ~5KB
**Global Object:** `LLMConfig`

**Key Methods:**
```javascript
LLMConfig.getSettings()           // Get stored settings
LLMConfig.saveSettings(obj)       // Save to localStorage
LLMConfig.validateSettings(obj)   // Check if valid
LLMConfig.testConnection(obj)     // Test API call
LLMConfig.getDefaultEndpoint(provider)  // Get default URL
LLMConfig.getModels(provider)     // Get available models
```

**Storage Key:** `llm-settings`

**Settings Object:**
```json
{
  "provider": "openrouter",
  "endpoint": "https://openrouter.ai/api/v1/chat/completions",
  "apiKey": "sk-or-v1-...",
  "model": "anthropic/claude-3.5-sonnet"
}
```

---

### js/content-generator.js
**Purpose:** Generate educational content using LLM APIs
**Size:** ~10KB
**Global Object:** `ContentGenerator`

**Key Methods:**
```javascript
ContentGenerator.generateAllContent(language, difficulty, progressCallback)
ContentGenerator.generateWordleWords(language, difficulty, settings)
ContentGenerator.generateMemoryContent(language, difficulty, settings)
ContentGenerator.generateVerbTenses(language, difficulty, settings)
ContentGenerator.generateReflexiveVerbs(language, difficulty, settings)
```

**Progress Callback:**
```javascript
function updateProgress(message, percent) {
  console.log(`${percent}% - ${message}`);
}
```

**Generation Sequence:**
1. Wordle words (0-25%)
2. Memory pairs (25-50%)
3. Verb tenses (50-75%)
4. Reflexive verbs (75-100%)

---

### js/game-content-loader.js
**Purpose:** Load, save, export, and import game content
**Size:** ~5KB
**Global Object:** `GameContentLoader`

**Key Methods:**
```javascript
GameContentLoader.saveContent(obj)           // Save to localStorage
GameContentLoader.loadContent()              // Load from localStorage
GameContentLoader.clearContent()             // Delete stored content
GameContentLoader.exportContent()            // Download as JSON
GameContentLoader.importContent(file)        // Load from JSON file
GameContentLoader.getWordleWords()           // Get Wordle data
GameContentLoader.getMemoryContent(topic)    // Get Memory data for topic
GameContentLoader.getAllMemoryTopics()       // Get all Memory data
GameContentLoader.getContentInfo()           // Get language, difficulty, timestamp
GameContentLoader.hasContent()               // Check if content exists
```

**Storage Key:** `game-content`

**Content Object:**
```json
{
  "language": "Italian",
  "difficulty": "beginner",
  "timestamp": "2025-10-15T10:30:00.000Z",
  "wordle": [...],
  "memory": {...},
  "verbTenses": [...],
  "reflexiveVerbs": [...]
}
```

---

## CSS Files

### css/adaptive-v1.css
**Purpose:** Styles specific to LLM adaptive games
**Size:** ~11KB
**Version:** v1

**Key Classes:**
```css
.selection-screen       # Language/difficulty selection
.selection-card         # Individual option cards
.selection-card.selected # Active selection
.continue-button        # Generate content button
.modal-overlay          # Progress modal
.progress-bar           # Generation progress indicator
.content-actions        # Export/import buttons
.provider-tabs          # Settings provider tabs
.provider-panel         # Settings provider panels
.alert                  # Success/error messages
```

**Color Scheme:**
- Italian Green: `#008C45`
- Italian Red: `#CE2B37`
- White: `#ffffff`

**Shared Styles:**
Relies on `../css/styles-v2.css` for:
- Header/footer
- Navigation
- Typography
- Spacing variables

---

## Documentation Files

### docs/README.md
**Purpose:** Complete documentation
**Size:** ~7KB
**Contents:**
- Full feature list
- Architecture overview
- Setup instructions
- Usage examples
- API reference

**Target Audience:** Developers and power users

---

### docs/QUICK-START.md
**Purpose:** Fast setup guide
**Size:** ~4KB
**Contents:**
- 5-step setup
- API key instructions
- Configuration walkthrough
- Export/import workflow
- Tips and troubleshooting basics

**Target Audience:** Teachers and first-time users

---

### docs/TROUBLESHOOTING.md
**Purpose:** Problem solving guide
**Size:** ~9KB
**Contents:**
- Module loading errors
- API connection issues
- Content generation problems
- Import/export issues
- Browser compatibility
- Performance issues
- Error reference table
- Debug commands

**Target Audience:** Users experiencing issues

---

### docs/FILE-REFERENCE.md
**Purpose:** Quick reference (this file)
**Size:** ~5KB
**Contents:**
- Directory structure
- File descriptions
- Key classes/methods
- Data structures

**Target Audience:** Developers and maintainers

---

## External Dependencies

### Shared CSS (from parent directory)
```html
<link rel="stylesheet" href="../css/styles-v2.css">
<link rel="stylesheet" href="../css/games-v2.css">  # For games only
```

Located at: `/Users/veritas44/Downloads/github/impariamo/css/`

### Google Analytics
```javascript
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-QJL9EQGT3Y"></script>
```

Tracking ID: `G-QJL9EQGT3Y`

### API Endpoints

**OpenRouter:**
```
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer sk-or-v1-...
  Content-Type: application/json
  HTTP-Referer: <origin>
  X-Title: Impariamo Language Games
```

**Open Web UI:**
```
POST http://localhost:8080/api/chat/completions
Headers:
  Authorization: Bearer <key>
  Content-Type: application/json
```

---

## localStorage Keys

| Key | Purpose | Data Type | Max Size |
|-----|---------|-----------|----------|
| `llm-settings` | API configuration | JSON object | ~500 bytes |
| `game-content` | Generated content | JSON object | ~50-100 KB |

**Clearing Data:**
```javascript
// Clear settings only
localStorage.removeItem('llm-settings');

// Clear content only
localStorage.removeItem('game-content');

// Clear everything
localStorage.clear();
```

---

## Navigation Map

```
index.html
├── → llm-settings.html
│   └── → adaptive-hub.html (after save)
└── → adaptive-hub.html
    ├── → llm-settings.html (via nav)
    ├── → wordle-adaptive.html (after generation)
    └── → memory-adaptive.html (after generation)

wordle-adaptive.html → Back to adaptive-hub.html
memory-adaptive.html → Back to adaptive-hub.html
```

---

## File Permissions

All files should be readable by web server:
```bash
chmod 644 *.html
chmod 644 css/*.css
chmod 644 js/*.js
chmod 644 docs/*.md
```

---

## Quick Links

| Page | Purpose | Direct URL |
|------|---------|------------|
| Landing | Overview | `/llm-version/` |
| Settings | Configure | `/llm-version/llm-settings.html` |
| Hub | Generate | `/llm-version/adaptive-hub.html` |
| Wordle | Play | `/llm-version/wordle-adaptive.html` |
| Memory | Play | `/llm-version/memory-adaptive.html` |
| Docs | Help | `/llm-version/docs/README.md` |

---

**Last Updated:** October 15, 2025
**Version:** 1.0
**Location:** `/Users/veritas44/Downloads/github/impariamo/llm-version/`
