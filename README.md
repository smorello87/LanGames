# LanGames

**AI-Powered Multilingual Language Learning Platform**

LanGames is a static web application that generates custom educational content for language learning using Large Language Model (LLM) APIs. Unlike traditional language learning tools with hardcoded content, LanGames dynamically creates interactive games in 10 languages at customizable difficulty levels.

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

## 🌟 Features

- **10 Languages**: Italian, Spanish, French, German, Portuguese, Japanese, Chinese, Korean, Russian, Arabic
- **3 Difficulty Levels**: Beginner, Intermediate, Advanced
- **5 Interactive Games**:
  - 🔤 **Wordle** - 5-letter word guessing game
  - 🃏 **Memory Game** - Vocabulary matching across 5 topics
  - 🌸 **Flower** - Petal-based word guessing with positive reinforcement
  - ⚙️ **Verb Tenses Wheel** - Present tense conjugation practice
  - ⚙️ **Reflexive Verbs Wheel** - Reflexive verb conjugation practice
- **Multiple LLM Providers**: OpenAI, OpenRouter, Open Web UI (self-hosted)
- **URL Sharing**: Share content via short links - students don't need API keys!
- **Export/Import**: Share generated content via JSON files
- **Offline Play**: Students use imported content without API access
- **No Build Process**: Pure HTML/CSS/JavaScript - works anywhere

## 🚀 Quick Start

### For Instructors

1. **Configure API Settings**
   - Open `llm-settings.html` in your browser
   - Select LLM provider (OpenAI, OpenRouter, or Open Web UI)
   - Enter API credentials
   - Test connection and save

2. **Generate Content**
   - Select target language (e.g., Spanish, French)
   - Select difficulty level (Beginner/Intermediate/Advanced)
   - Click "Generate All Content"
   - Wait 5-10 minutes for generation

3. **Share with Students** (Two Options)

   **Option A: Share Link (Easiest)**
   - Click "🔗 Share Link" button
   - Copy the short URL (e.g., `yoursite.com/langames/?id=abc123`)
   - Send link to students - they click and play!

   **Option B: Export File**
   - Click "Export Content" button
   - Save JSON file (e.g., `language-games-spanish-beginner.json`)
   - Share file with students

### For Students

1. **Using a Share Link**
   - Click the link from your instructor
   - Content loads automatically
   - Start playing!

2. **Using an Exported File**
   - Open `llm-settings.html`
   - Click "Import Content"
   - Select JSON file from instructor

3. **Play Games**
   - Navigate using the top menu
   - Choose any of the 5 games
   - Practice with custom-generated content!

### Local Development

```bash
# Clone the repository
git clone https://github.com/smorello87/LanGames.git
cd LanGames

# Use PHP server (recommended - enables URL sharing)
php -S localhost:8000
# Navigate to http://localhost:8000

# Alternative: Python server (URL sharing won't work)
python3 -m http.server 8000
```

## 📋 Content Generated

Each content generation creates:

| Game | Content |
|------|---------|
| **Wordle** | 15 five-letter words |
| **Memory** | 60 word pairs across 5 topics (Food, Daily Activities, Family, School, Work) |
| **Flower** | 20 words for guessing game |
| **Verb Tenses** | 20 regular verbs with present tense conjugations |
| **Reflexive Verbs** | 15 reflexive verbs with conjugations |

## 🔧 Technology Stack

- **Frontend**: Pure HTML5, CSS3, Vanilla JavaScript (ES6 modules)
- **Storage**: Browser localStorage
- **AI Integration**: OpenAI/OpenRouter/Open Web UI APIs
- **Hosting**: Static files - any web server

## 💰 API Cost Estimates

Typical cost per full content generation:

- **GPT-3.5-turbo**: $0.05-$0.10
- **Claude (via OpenRouter)**: $0.15-$0.25
- **GPT-4**: $0.30-$0.50
- **Open Web UI (self-hosted)**: Free

## 📂 Project Structure

```
LanGames/
├── index.html                    # Landing page with features/FAQ
├── llm-settings.html             # API config + content generation
├── wordle-adaptive.html          # Wordle game
├── memory-adaptive.html          # Memory matching game
├── fiore-adaptive.html           # Flower word guessing game
├── tenses-adaptive.html          # Verb conjugation wheel (present)
├── reflexives-adaptive.html      # Reflexive verb wheel
├── store-content.php             # Server-side content storage API
├── get-content.php               # Content retrieval API
├── shorten-url.php               # URL shortening proxy
├── content/                      # Stored content (JSON files)
├── css/
│   ├── styles-v3.css            # Base styles, navigation, variables
│   ├── games-v3.css             # Game-specific styles
│   └── adaptive-v3.css          # LanGames UI components
├── js/
│   ├── llm-config.js            # API settings management
│   ├── content-generator.js     # LLM API integration
│   └── gcl-1761141656.js        # Game content loader
├── flower/                       # Flower game images (0-8.jpg)
├── docs/
│   └── README.md                # Detailed documentation
└── CLAUDE.md                    # Developer documentation
```

## 🎨 Design System

LanGames uses an ASR-inspired color palette:

- **Primary Blue**: `#003DA5`
- **Secondary Blue**: `#002D72`
- **Accent Teal**: `#0891B2`
- **Accent Red**: `#DC143C`

Fully responsive with breakpoints at 768px (tablet) and 600px (mobile). All interactive elements meet WCAG AAA standards (44px minimum touch targets).

## 🔒 Security & Privacy

- API keys stored in browser localStorage only
- Keys never transmitted except to configured LLM endpoint
- **API keys are NEVER included in share URLs** - only generated content
- Students don't need API keys (use shared links or imported content)
- Shared content stored on server expires after 365 days
- All game processing is client-side

## 🌐 Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS 12+)
- Mobile: ✅ Fully responsive

## 📖 Documentation

- [Quick Start Guide](docs/README.md) - Detailed setup instructions
- [CLAUDE.md](CLAUDE.md) - Developer documentation for Claude Code
- [Troubleshooting](#troubleshooting) - Common issues and solutions

## 🐛 Troubleshooting

### Connection Failed
- Verify API key is correct
- Check endpoint URL matches provider
- Ensure internet connection active
- For Open Web UI, confirm server running

### Content Not Loading
- Generate or import content first
- Check localStorage not full
- Verify JSON file format correct
- Check browser console for errors

### Game Errors
- Clear localStorage: `localStorage.clear()`
- Regenerate content
- Try different browser
- Check console for specific errors

## 🤝 Contributing

This project was developed as part of the CUNY AI Lab, coordinated by:
- [American Social History Project/Center for Media and Learning](https://ashp.cuny.edu)
- [Graduate Center Digital Initiatives](https://cuny.is/gcdi)
- [Mina Rees Library](https://library.gc.cuny.edu/)
- [Teaching and Learning Center](https://tlc.commons.gc.cuny.edu/)

Based on [Beatrice Carnelutti's Impariamo l'Italiano](https://beatricecarnelutti.com/impariamo).

## 📄 License

This project is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

You are free to:
- **Share** - Copy and redistribute the material
- **Adapt** - Remix, transform, and build upon the material

Under the following terms:
- **Attribution** - Give appropriate credit
- **NonCommercial** - Not for commercial use
- **ShareAlike** - Distribute under same license

## 🙏 Acknowledgments

- Original Italian games by Beatrice Carnelutti
- CUNY AI Lab for project coordination
- OpenAI, Anthropic, and open-source LLM community
- All contributors and testers

## 📧 Support

For questions or issues:
1. Check [docs/README.md](docs/README.md) for detailed guides
2. Review browser console for error messages
3. Verify API provider status and quotas
4. Open an issue on GitHub

---

**Made with ❤️ for language learners worldwide**
