# Quick Start Guide

Get up and running with AI-powered language games in 5 simple steps!

## Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- API key from OpenRouter or Open Web UI
- Internet connection (for content generation only)

## Step 1: Get an API Key

### Option A: OpenRouter (Recommended)

1. Go to [https://openrouter.ai](https://openrouter.ai)
2. Sign up for a free account
3. Navigate to "Keys" section
4. Create a new API key
5. Copy the key (starts with `sk-or-v1-...`)

**Why OpenRouter?**
- Free credits to get started
- Access to multiple AI models (GPT-4, Claude, Gemini, etc.)
- No CORS issues (works directly from browsers)
- Pay-as-you-go pricing (very affordable)

### Option B: Open Web UI

If you have a local Open Web UI instance:

1. Open your Open Web UI installation
2. Go to Settings > API Keys
3. Generate a new API key
4. Copy the key

## Step 2: Configure Settings

1. Open `llm-version/llm-settings.html` in your browser
2. Select your provider (OpenRouter or Open Web UI)
3. Enter your API endpoint (pre-filled for OpenRouter)
4. Paste your API key
5. Select a model:
   - For OpenRouter: `anthropic/claude-3.5-sonnet` (recommended) or `openai/gpt-4`
   - For Open Web UI: Select from your available models
6. Click "Test Connection" to verify it works
7. Click "Save Settings"

## Step 3: Generate Content

1. After saving settings, you'll be redirected to the Adaptive Hub
2. Select your target language (Italian, Spanish, French, etc.)
3. Choose difficulty level (Beginner, Intermediate, Advanced)
4. Click "Generate Content"
5. Wait 2-5 minutes while AI creates your custom content
6. Content includes:
   - 15 Wordle words
   - 60 Memory game pairs (5 topics, 12 pairs each)
   - 20 Verb tense conjugations
   - 15 Reflexive verb conjugations

## Step 4: Play Games

After generation completes:

1. Click "Wordle" to play word guessing game
2. Click "Memory Game" to match vocabulary pairs
3. Content is stored in your browser - no need to regenerate

## Step 5: Export & Share (Optional)

### For Teachers:

1. Click "Export Content" button
2. Save the JSON file
3. Share with students via email, LMS, etc.

### For Students:

1. Click "Import Content" button
2. Select the JSON file from your teacher
3. Play games without needing an API key!

## Tips for Success

- **First time users:** Start with Italian/Beginner to test the system
- **Cost:** Each content generation costs $0.02-0.10 depending on model
- **Quality:** Claude 3.5 Sonnet provides the best educational content
- **Patience:** Don't refresh during generation - it takes a few minutes
- **Offline play:** Once content is loaded, games work offline

## Troubleshooting

**"Module not loaded" error?**
- Refresh the page (Ctrl+R or Cmd+R)
- Clear browser cache and try again

**"Connection failed" error?**
- Check your API key is correct
- Verify you have credits remaining (OpenRouter)
- Test connection in Settings page

**Content generation stuck?**
- Check browser console for errors (F12)
- Try a different model
- Ensure stable internet connection

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
- Generate content for multiple languages
- Create difficulty-specific content sets
- Share exported content with your classroom

## Support

- Check console logs (F12 → Console) for detailed error messages
- All processing happens in your browser - no data sent to our servers
- API keys stored locally and never shared

---

Ready to start? [Configure Settings](../llm-settings.html) → [Generate Content](../adaptive-hub.html) → Play!
