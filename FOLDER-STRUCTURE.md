# ✅ LLM Version - Clean Folder Structure

## What Changed

All LLM-powered files are now in `/llm-version/` folder with **self-contained CSS**.

### Before (Problems)
```
impariamo/
├── css/styles-v2.css           ← Used by both original & LLM
├── adaptive-hub.html           ← Duplicate in main & llm-version
├── llm-settings.html           ← Duplicate
├── MANY-DOCS.md                ← Duplicate docs everywhere
```

### After (Clean!)
```
impariamo/
├── index.html                  ← Original game (untouched)
├── memory.html                 ← Original game (untouched)
├── wordle.html                 ← Original game (untouched)
├── css/
│   ├── styles-v2.css          ← Used by original games
│   └── games-v2.css           ← Used by original games
│
└── llm-version/                ← NEW: Self-contained LLM version
    ├── index.html              ← Landing page
    ├── llm-settings.html       ← Settings (OpenAI removed)
    ├── adaptive-hub.html       ← Content generator (FIXED modules)
    ├── wordle-adaptive.html    ← Adaptive Wordle
    ├── memory-adaptive.html    ← Adaptive Memory
    │
    ├── css/                    ← Self-contained CSS (copied)
    │   ├── styles-v2.css       ← Copy from parent
    │   ├── games-v2.css        ← Copy from parent
    │   └── adaptive-v1.css     ← LLM-specific styles
    │
    ├── js/                     ← LLM-specific JavaScript
    │   ├── llm-config.js       ← API configuration
    │   ├── content-generator.js ← Content generation
    │   └── game-content-loader.js ← Import/export
    │
    └── docs/                   ← All documentation
        ├── README.md
        ├── QUICK-START.md
        └── TROUBLESHOOTING.md
```

## CSS Strategy

### Original Games (Main Folder)
- Use `css/styles-v2.css` and `css/games-v2.css` from main folder
- No changes needed
- Work exactly as before

### LLM Version (llm-version/ Folder)
- Has **copies** of `styles-v2.css` and `games-v2.css` in `llm-version/css/`
- Plus `adaptive-v1.css` for LLM-specific styling
- All HTML files reference `css/` (local folder, not parent)
- **Self-contained** - can be deployed independently

## Why This Structure?

1. **No Conflicts**: Original games unchanged
2. **Self-Contained**: LLM version can be deployed separately
3. **Clear Separation**: Easy to understand which files belong where
4. **No Confusion**: Developers know exactly where to look

## File Ownership

### Main Folder Files (Original)
- `index.html` - Original landing
- `memory.html` - Original Memory game
- `wordle.html` - Original Wordle game
- `fiore.html`, `tenses.html`, `reflexives.html`, etc.
- `css/styles-v2.css` - Shared styles
- `css/games-v2.css` - Game styles

### llm-version/ Files (LLM-Powered)
- Everything in `llm-version/` folder
- Completely independent
- Can be moved/deployed separately

## Cleanup Required

Run this script to remove duplicates from main folder:
```bash
./cleanup-duplicates.sh
```

This removes:
- Duplicate HTML files (adaptive-hub.html, llm-settings.html, etc.)
- Duplicate documentation (ADAPTIVE-GAMES-README.md, etc.)
- Temporary files (generate-adaptive-files.sh, etc.)

## After Cleanup

Main folder will have only:
- Original game files
- Shared CSS
- llm-version/ subfolder

No duplicate or confusing files!

## Testing

### Test Original Games
```bash
open index.html           # Original landing
open memory.html          # Original memory game
open wordle.html          # Original Wordle
```

Should work exactly as before - no changes!

### Test LLM Version
```bash
open llm-version/index.html              # LLM landing page
open llm-version/llm-settings.html       # Configure API
open llm-version/adaptive-hub.html       # Generate content
```

All CSS should load from `llm-version/css/` - self-contained!

## Deployment

### Deploy Original Version Only
Upload everything EXCEPT `llm-version/` folder

### Deploy LLM Version Only  
Upload just the `llm-version/` folder to server

### Deploy Both
Upload everything - they won't conflict!

## Summary

✅ **CSS Fixed**: LLM version uses local copies in `llm-version/css/`
✅ **No Duplicates**: Run cleanup script to remove duplicates from main folder  
✅ **Self-Contained**: LLM version is independent
✅ **Clear Structure**: Easy to understand and maintain
✅ **Ready to Deploy**: Both versions work independently
