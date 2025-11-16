# Deployment Instructions for LanGames

## Files to Upload to stefanomorello.com/langames/

**Note:** The `tests/` folder contains development test files and should NOT be deployed to production. It's excluded in `.gitignore`.

### Required Files:
1. **PHP Proxy** (NEW - CRITICAL):
   - `shorten-url.php` - Server-side URL shortening proxy

2. **HTML Files**:
   - `index.html` - Landing page
   - `llm-settings.html` - Settings and content generation
   - `wordle-adaptive.html` - Wordle game
   - `memory-adaptive.html` - Memory game
   - `fiore-adaptive.html` - Flower game
   - `tenses-adaptive.html` - Verb tenses wheel
   - `reflexives-adaptive.html` - Reflexive verbs wheel

3. **JavaScript Files**:
   - `js/gcl-1761141656.js` - Game content loader (renamed from game-content-loader.js)
   - `js/llm-config.js` - API settings management
   - `js/content-generator.js` - LLM API integration

4. **CSS Files**:
   - `css/styles-v3.css` - Base styles
   - `css/games-v3.css` - Game-specific styles
   - `css/adaptive-v3.css` - LanGames-specific styles

5. **Images**:
   - `flower/flower0.jpg` through `flower/flower8.jpg` - Flower game images

## Deployment Steps

### Step 1: Upload Files via FTP/SFTP

Connect to your hosting and upload all files maintaining the directory structure:

```
stefanomorello.com/langames/
├── shorten-url.php          ⚠️ NEW FILE - MUST UPLOAD
├── index.html
├── llm-settings.html
├── wordle-adaptive.html
├── memory-adaptive.html
├── fiore-adaptive.html
├── tenses-adaptive.html
├── reflexives-adaptive.html
├── css/
│   ├── styles-v3.css
│   ├── games-v3.css
│   └── adaptive-v3.css
├── js/
│   ├── gcl-1761141656.js   ⚠️ UPDATED FILE
│   ├── llm-config.js
│   └── content-generator.js
└── flower/
    ├── flower0.jpg
    ├── flower1.jpg
    └── ... (through flower8.jpg)
```

### Step 2: Verify PHP Support

Ensure your hosting has:
- PHP 7.4 or higher
- `curl` extension enabled
- `json` extension enabled

Test by accessing: `https://stefanomorello.com/langames/shorten-url.php`

You should see a JSON error message (expected - it needs a URL parameter):
```json
{"error": "No URL provided"}
```

### Step 3: Test URL Shortening

1. Visit `https://stefanomorello.com/langames/llm-settings.html`
2. Generate content if you haven't already
3. Click "🔗 Generate Share Link"
4. Wait 2-3 seconds - you should see "✅ Short URL generated!"
5. The URL in the modal should be a TinyURL (e.g., `https://tinyurl.com/abc123`)

### Step 4: Test Share Link

1. Copy the shortened URL
2. Open in a private/incognito window
3. Content should load automatically
4. Navigate to any game - it should work without API key

## How It Works

### URL Shortening Flow:

```
Browser                    Your Server              TinyURL API
   |                           |                         |
   |-- Generate Share Link --> |                         |
   |                           |                         |
   |-- Call PHP Proxy -------> |                         |
   |    (fetch POST)           |                         |
   |                           |-- Request Short URL --> |
   |                           |    (cURL, no CORS)      |
   |                           |                         |
   |                           | <-- Return Short URL -- |
   |                           |                         |
   | <-- Return JSON --------- |                         |
   |    {shorturl: "..."}      |                         |
   |                           |                         |
```

**Why This Works:**
- Browser → PHP: No CORS (same domain)
- PHP → TinyURL: No CORS (server-to-server)
- Students get ~25 character URLs instead of ~13,000

## Troubleshooting

### Problem: "All URL shortening services failed"

**Check:**
1. PHP is installed: `php -v` (via SSH)
2. cURL extension: `php -m | grep curl`
3. PHP error logs: `/var/log/php-errors.log` or ask hosting support
4. Test manually:
   ```bash
   curl -X POST https://stefanomorello.com/langames/shorten-url.php \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com"}'
   ```

### Problem: Modal shows long URL forever

**Causes:**
- PHP proxy not accessible (404 error)
- PHP not processing the file (downloaded instead of executed)
- Firewall blocking outbound connections from server

**Solution:**
1. Check browser console for errors
2. Verify PHP file uploaded correctly
3. Contact hosting support if outbound connections are blocked

### Problem: "Failed to fetch" error

**Cause:** JavaScript can't reach the PHP proxy

**Solution:**
1. Verify file path in `js/gcl-1761141656.js` line 350:
   ```javascript
   proxyURL = 'https://stefanomorello.com/langames/shorten-url.php';
   ```
2. Check that domain and path match exactly

## Development vs Production

The JavaScript automatically detects the environment:

**Local Development** (localhost):
- Uses `/shorten-url.php` (relative path)
- Requires PHP server: `php -S localhost:8765`

**Production** (stefanomorello.com):
- Uses `https://stefanomorello.com/langames/shorten-url.php`
- Works automatically once deployed

## Security Notes

### The PHP proxy:
- ✅ Validates URLs before shortening
- ✅ Sets CORS headers only for your domain
- ✅ Has 10-second timeout to prevent hanging
- ✅ Tries multiple free services (is.gd, v.gd, Clck.ru)
- ✅ Returns detailed error messages for debugging

### No API Keys Required:
- is.gd, v.gd, and Clck.ru are free services (TinyURL's deprecated API removed)
- No registration or authentication needed
- Rate limits are reasonable for educational use
- is.gd is primary service (fast, reliable, well-maintained)

## Alternative: Manual Shortening

If the PHP proxy doesn't work (hosting restrictions), you can still use manual shortening:

1. Uncomment the manual workflow in `llm-settings.html` (lines 283-289)
2. Users click button → opens TinyURL website
3. One extra click to get shortened URL

This is the fallback solution if server-side shortening is blocked by hosting.

## Support

If deployment issues persist:
1. Check hosting PHP requirements
2. Test PHP proxy directly with curl
3. Review browser console errors
4. Check server error logs

The system works locally with PHP 8.3 - ensure production has similar environment.
