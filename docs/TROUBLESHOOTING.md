# Troubleshooting Guide

Common issues and solutions for the AI-powered language games system.

## Table of Contents

1. [Module Loading Errors](#module-loading-errors)
2. [API Connection Issues](#api-connection-issues)
3. [Content Generation Problems](#content-generation-problems)
4. [Import/Export Issues](#importexport-issues)
5. [Browser Compatibility](#browser-compatibility)
6. [Performance Issues](#performance-issues)

---

## Module Loading Errors

### Error: "System error: Required modules not loaded: GameContentLoader"

**Symptoms:**
- Red error message on page load
- "Module not loaded" in console
- Generate button doesn't work

**Cause:**
JavaScript modules not loading in correct order or being blocked

**Solutions:**

1. **Hard refresh the page:**
   - Windows/Linux: `Ctrl + Shift + R` or `Ctrl + F5`
   - Mac: `Cmd + Shift + R`

2. **Clear browser cache:**
   - Chrome: Settings → Privacy → Clear browsing data
   - Firefox: Options → Privacy → Clear Data
   - Safari: Develop → Empty Caches

3. **Check browser console:**
   - Press `F12` to open DevTools
   - Look for any loading errors
   - Check if JavaScript is enabled

4. **Disable browser extensions:**
   - Ad blockers or privacy extensions may block scripts
   - Try in incognito/private mode

5. **Use a different browser:**
   - Some browsers have stricter security policies
   - Chrome and Firefox work best

**Prevention:**
- Always use the latest browser version
- Don't interrupt page load
- Ensure stable internet connection

---

## API Connection Issues

### Error: "Connection failed: CORS or network error"

**Symptoms:**
- Test connection fails
- Red error on settings page
- Can't verify API key

**Cause:**
Network connectivity or API endpoint issues

**Solutions:**

1. **Check your API key:**
   - OpenRouter keys start with `sk-or-v1-`
   - No spaces before/after the key
   - Key hasn't expired

2. **Verify API endpoint:**
   - OpenRouter: `https://openrouter.ai/api/v1/chat/completions`
   - Open Web UI: `http://localhost:8080/api/chat/completions`
   - Must include `https://` or `http://`

3. **Check internet connection:**
   - Can you load other websites?
   - Try disabling VPN temporarily
   - Check firewall settings

4. **For Open Web UI users:**
   - Ensure Open Web UI is running
   - Check if API endpoint is accessible
   - Verify CORS is enabled in Open Web UI settings

### Error: "Authentication failed. Please check your API key"

**Cause:**
Invalid or expired API key

**Solutions:**

1. **Regenerate API key:**
   - Go to OpenRouter dashboard
   - Create a new key
   - Update in settings

2. **Check key format:**
   - Copy entire key including prefix
   - No extra characters or line breaks

3. **Verify account status:**
   - Check if you have credits (OpenRouter)
   - Ensure account is active

### Error: "Rate limit exceeded"

**Cause:**
Too many API requests in short time

**Solutions:**

1. **Wait before retrying:**
   - OpenRouter: Wait 1 minute
   - Try again after short delay

2. **Check usage dashboard:**
   - May have hit daily/monthly limit
   - Add credits if needed

---

## Content Generation Problems

### Error: "Content generation failed: Invalid JSON"

**Symptoms:**
- Generation starts but fails partway
- Progress bar stops
- Error shows "Invalid JSON" or "Unexpected token"

**Cause:**
AI model returned malformed JSON

**Solutions:**

1. **Try a different model:**
   - Switch from GPT-4 to Claude 3.5 Sonnet
   - Claude typically provides better-formatted responses
   - GPT-3.5-turbo may struggle with complex JSON

2. **Retry generation:**
   - Sometimes models have temporary issues
   - Try again 2-3 times

3. **Check console for details:**
   - F12 → Console tab
   - Look for the actual response
   - May indicate model-specific issue

### Generation Takes Forever

**Symptoms:**
- Progress bar stuck at one stage
- More than 10 minutes elapsed
- No errors shown

**Cause:**
Network timeout or API slowness

**Solutions:**

1. **Check console:**
   - Look for pending requests
   - Check for error messages

2. **Refresh and retry:**
   - Don't wait more than 10 minutes
   - Refresh page
   - Start generation again

3. **Try different time:**
   - API services may be busy
   - Off-peak hours usually faster

### Content Quality Issues

**Symptoms:**
- Words don't match difficulty level
- Incorrect translations
- Inappropriate vocabulary

**Cause:**
Model selection or prompt interpretation

**Solutions:**

1. **Use better models:**
   - Claude 3.5 Sonnet (best quality)
   - GPT-4 (good quality)
   - Avoid GPT-3.5 for complex languages

2. **Regenerate content:**
   - AI outputs vary each time
   - Try 2-3 times to get best results

3. **Manual review:**
   - Export JSON
   - Review vocabulary manually
   - Edit if needed
   - Re-import corrected version

---

## Import/Export Issues

### Can't Export Content

**Symptoms:**
- Export button doesn't work
- No file downloads
- Error message shown

**Cause:**
No content generated or browser blocking download

**Solutions:**

1. **Ensure content exists:**
   - Generate content first
   - Check "Current Content" section shows data

2. **Check browser permissions:**
   - Allow downloads in browser settings
   - Disable download blocking extensions

3. **Try different browser:**
   - Some browsers block automatic downloads
   - Chrome and Firefox work best

### Can't Import Content

**Symptoms:**
- Import doesn't load content
- "Invalid content file" error
- Games don't show imported data

**Cause:**
File format issue or corrupted JSON

**Solutions:**

1. **Verify file format:**
   - Must be `.json` file
   - File must contain valid JSON

2. **Check file contents:**
   - Open in text editor
   - Should start with `{`
   - Must have `language`, `difficulty`, `wordle`, `memory` fields

3. **Re-export from source:**
   - Have teacher regenerate export
   - Ensure file wasn't corrupted during transfer

---

## Browser Compatibility

### Supported Browsers

✅ **Fully Supported:**
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

⚠️ **Limited Support:**
- Older browser versions
- Mobile browsers (works but not optimized)

❌ **Not Supported:**
- Internet Explorer
- Very old browser versions

### Mobile Devices

**Current Status:**
- Mobile browsers work for playing games
- Content generation may be slow
- Import/export works
- API configuration supported

**Recommendations:**
- Generate content on desktop
- Export and share with mobile users
- Import on mobile to play games

---

## Performance Issues

### Page Loads Slowly

**Solutions:**

1. **Clear browser cache**
2. **Disable unnecessary extensions**
3. **Check internet speed**
4. **Close other tabs**

### Games Are Laggy

**Solutions:**

1. **Clear localStorage:**
   ```javascript
   // In browser console (F12)
   localStorage.clear();
   ```
   Note: This deletes saved content

2. **Restart browser**

3. **Check available memory:**
   - Close other applications
   - Restart computer if needed

---

## Error Reference

| Error Message | Likely Cause | Quick Fix |
|--------------|--------------|-----------|
| "Required modules not loaded" | Scripts not loaded | Hard refresh (Ctrl+Shift+R) |
| "Authentication failed" | Wrong API key | Check key in settings |
| "Rate limit exceeded" | Too many requests | Wait 1 minute, retry |
| "Invalid JSON" | Malformed API response | Try different model |
| "Network error" | Connection issue | Check internet, VPN |
| "Failed to save content" | localStorage full | Clear browser data |
| "No content available" | Nothing generated | Generate or import first |

---

## Getting Debug Information

When reporting issues or debugging:

1. **Open Browser Console:**
   - Press `F12`
   - Go to "Console" tab

2. **Look for error messages:**
   - Red text indicates errors
   - Copy full error message

3. **Check Network tab:**
   - See if API calls are being made
   - Check response status codes

4. **Check localStorage:**
   ```javascript
   console.log('Settings:', localStorage.getItem('llm-settings'));
   console.log('Content:', localStorage.getItem('game-content'));
   ```

5. **Test module loading:**
   ```javascript
   console.log('LLMConfig:', typeof LLMConfig);
   console.log('ContentGenerator:', typeof ContentGenerator);
   console.log('GameContentLoader:', typeof GameContentLoader);
   ```
   All should return "object", not "undefined"

---

## Still Having Issues?

1. **Review console logs** - Most issues show details in browser console
2. **Try different browser** - Eliminates browser-specific issues
3. **Check API provider status** - OpenRouter status page
4. **Verify account credits** - Ensure you have available credits
5. **Test with simpler configuration** - Italian + Beginner + Claude 3.5

---

## Prevention Checklist

Before generating content:

- ✅ Settings saved successfully
- ✅ Test connection passed
- ✅ Stable internet connection
- ✅ Browser console shows no errors
- ✅ Sufficient API credits available
- ✅ Using recommended model (Claude 3.5 Sonnet)

---

Need more help? Check the main [README.md](README.md) or [QUICK-START.md](QUICK-START.md) guide.
