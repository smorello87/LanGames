# AI-Powered Adaptive Language Learning Games

This suite adds AI-powered content generation to your language learning website, allowing instructors to create custom games for any language and difficulty level.

## What's New

### Core Features
1. **Multi-Language Support**: Generate content for Italian, Spanish, French, German, Portuguese, Japanese, Chinese, Korean, Russian, and Arabic
2. **Difficulty Levels**: Beginner, Intermediate, and Advanced content adaptation
3. **LLM Provider Choice**: Support for OpenAI, Open Router, and Open Web UI
4. **Content Export/Import**: Share generated content via JSON files
5. **Offline Play**: Students can use imported content without API access

### Files Added

#### JavaScript Modules (`/js/`)
- `llm-config.js` - API configuration and settings management
- `content-generator.js` - LLM API calls and content generation
- `game-content-loader.js` - Import/export and content loading

#### CSS (`/css/`)
- `adaptive-v1.css` - Styling for new UI components

#### HTML Pages (to be created)
- `llm-settings.html` - Configure LLM API settings
- `adaptive-hub.html` - Language/difficulty selection and content generation
- `wordle-adaptive.html` - Adaptive Wordle game
- `memory-adaptive.html` - Adaptive Memory game

## Quick Start Guide

### For Instructors

#### Step 1: Configure LLM Settings
1. Open `llm-settings.html`
2. Choose your LLM provider (OpenAI recommended for best results)
3. Enter your API credentials:
   - **OpenAI**: Get API key from https://platform.openai.com/api-keys
   - **Open Router**: Get API key from https://openrouter.ai/keys
   - **Open Web UI**: Use your self-hosted instance URL and key
4. Select a model (GPT-4 recommended for quality, GPT-3.5-turbo for cost)
5. Click "Test Connection" to verify
6. Click "Save Settings"

#### Step 2: Generate Content
1. Open `adaptive-hub.html`
2. Select target language (e.g., Spanish, French, Italian)
3. Select difficulty level (Beginner/Intermediate/Advanced)
4. Click "Generate Content"
5. Wait 5-10 minutes while content generates
6. Content is automatically saved to browser localStorage

#### Step 3: Export for Students
1. On `adaptive-hub.html`, click "Export Content"
2. Save the JSON file (e.g., `language-games-spanish-beginner-1234567890.json`)
3. Share this file with students

### For Students

#### Import and Play
1. Open `adaptive-hub.html`
2. Click "Import Content"
3. Select the JSON file from your instructor
4. Play games with custom content!

## Content Generated

When you generate content, the system creates:

### Wordle Game
- 15 five-letter words in the target language
- Appropriate difficulty vocabulary

### Memory Game
- 60 word pairs (12 pairs × 5 topics)
- Topics: Food, Daily Activities, Family, School, Work
- Target language ↔ English translations

### Verb Tenses
- 20 regular verbs with present tense conjugations
- Includes all grammatical persons

### Reflexive Verbs
- 15 reflexive verbs with conjugations
- Includes reflexive pronouns

## API Provider Details

### OpenAI
- **Endpoint**: `https://api.openai.com/v1/chat/completions`
- **Models**: GPT-4, GPT-4 Turbo, GPT-4o, GPT-3.5-turbo
- **Cost**: ~$0.05-$0.50 per content generation
- **Best For**: Highest quality content

### Open Router
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Models**: Multiple (OpenAI, Anthropic, Google, Meta)
- **Cost**: Varies by model
- **Best For**: Model flexibility and cost optimization

### Open Web UI
- **Endpoint**: Custom (your self-hosted instance)
- **Models**: Whatever you've configured
- **Cost**: Free (self-hosted)
- **Best For**: Privacy and no API costs

## Cost Estimates

Full content generation typically costs:
- **GPT-4**: $0.30-$0.50
- **GPT-3.5-turbo**: $0.05-$0.10
- **Open Router**: $0.10-$0.40 (varies by model)
- **Open Web UI**: Free (uses your hardware)

## Security Notes

- API keys are stored in browser localStorage only
- Keys never leave your browser except to call your configured endpoint
- Students don't need API keys if using imported content
- Always use HTTPS in production
- Don't share your API keys

## Troubleshooting

### "Connection failed" error
- Check your API key is correct
- Verify endpoint URL matches your provider
- Check internet connection
- For Open Web UI, ensure server is running

### "Content generation failed"
- Check API quota/billing
- Try a different model
- Verify language is supported by your chosen model
- Check browser console for detailed error messages

### Content not loading in games
- Ensure you've generated or imported content
- Check browser localStorage isn't full
- Try refreshing the page
- Re-import the JSON file

### Games still showing Italian content
- Verify content was generated/imported successfully
- Check the correct language/difficulty was selected
- Open browser DevTools → Application → Local Storage
- Look for `game-content` key

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 12+)
- **Mobile**: Fully responsive

## Storage Limits

- Content stored in localStorage (typically 5-10MB limit)
- One language/difficulty combination at a time
- Export and re-import to switch between content sets

## Future Enhancements

Possible additions:
- Multiple content sets simultaneously
- Audio pronunciation generation
- Image-based vocabulary games
- Crossword puzzle generator
- Custom topic selection
- Teacher dashboard
- Student progress tracking

## File Structure

```
impariamo/
├── css/
│   ├── styles-v2.css           # Existing main styles
│   ├── games-v2.css            # Existing game styles
│   └── adaptive-v1.css         # NEW: Adaptive features styles
├── js/
│   ├── llm-config.js           # NEW: LLM configuration
│   ├── content-generator.js    # NEW: Content generation
│   └── game-content-loader.js  # NEW: Import/export logic
├── llm-settings.html           # NEW: Settings page
├── adaptive-hub.html           # NEW: Main adaptive hub
├── wordle-adaptive.html        # NEW: Adaptive Wordle
├── memory-adaptive.html        # NEW: Adaptive Memory
└── ADAPTIVE-GAMES-README.md    # This file
```

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify API provider status
3. Review this README
4. Check your API quota/billing

## License

Same as main project: CC BY-NC-SA 4.0
