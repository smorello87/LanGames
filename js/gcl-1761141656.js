// Game Content Loader
// Manages loading, saving, exporting, and importing game content

const GameContentLoader = {
  CONTENT_KEY: 'game-content',
  SESSION_KEY: 'current-session',

  // Save generated content to localStorage
  saveContent(content) {
    try {
      localStorage.setItem(this.CONTENT_KEY, JSON.stringify(content));
      return true;
    } catch (error) {
      console.error('Failed to save content:', error);
      return false;
    }
  },

  // Load content from localStorage
  loadContent() {
    try {
      const stored = localStorage.getItem(this.CONTENT_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Failed to load content:', error);
      return null;
    }
  },

  // Clear stored content
  clearContent() {
    localStorage.removeItem(this.CONTENT_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
  },

  // Save session info (language and difficulty selection)
  saveSession(language, difficulty) {
    try {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify({ language, difficulty }));
      return true;
    } catch (error) {
      console.error('Failed to save session:', error);
      return false;
    }
  },

  // Load session info
  loadSession() {
    try {
      const stored = sessionStorage.getItem(this.SESSION_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (error) {
      console.error('Failed to load session:', error);
      return false;
    }
  },

  // Export content as JSON file
  exportContent() {
    const content = this.loadContent();
    if (!content) {
      alert('No content to export. Please generate content first.');
      return;
    }

    const filename = `language-games-${content.language}-${content.difficulty}-${Date.now()}.json`;
    const dataStr = JSON.stringify(content, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Import content from JSON file
  importContent(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      if (!file.name.endsWith('.json')) {
        reject(new Error('Please select a JSON file'));
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = JSON.parse(e.target.result);

          // Validate content structure
          if (!content.language || !content.difficulty) {
            reject(new Error('Invalid content file: missing language or difficulty'));
            return;
          }

          // Save to localStorage
          if (this.saveContent(content)) {
            // Also save as current session
            this.saveSession(content.language, content.difficulty);
            resolve(content);
          } else {
            reject(new Error('Failed to save imported content'));
          }
        } catch (error) {
          reject(new Error('Invalid JSON file: ' + error.message));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  },

  // Get Wordle words
  getWordleWords() {
    const content = this.loadContent();
    if (!content || !content.wordle) {
      return null;
    }
    return content.wordle;
  },

  // Get Memory game content for specific topic
  getMemoryContent(topic) {
    const content = this.loadContent();
    if (!content || !content.memory || !content.memory[topic]) {
      return null;
    }
    return content.memory[topic];
  },

  // Get all Memory topics
  getAllMemoryTopics() {
    const content = this.loadContent();
    if (!content || !content.memory) {
      return null;
    }
    return content.memory;
  },

  // Get verb tenses
  getVerbTenses() {
    const content = this.loadContent();
    if (!content || !content.verbTenses) {
      return null;
    }
    return content.verbTenses;
  },

  // Get reflexive verbs
  getReflexiveVerbs() {
    const content = this.loadContent();
    if (!content || !content.reflexiveVerbs) {
      return null;
    }
    return content.reflexiveVerbs;
  },

  // Check if content exists
  hasContent() {
    const content = this.loadContent();
    return content !== null;
  },

  // Get content info (language and difficulty)
  getContentInfo() {
    const content = this.loadContent();
    if (!content) {
      return null;
    }
    return {
      language: content.language,
      difficulty: content.difficulty,
      timestamp: content.timestamp
    };
  },

  // URL-based sharing functionality with compression
  // Simple LZ-based compression for strings
  _compress(str) {
    try {
      // Use built-in browser compression if available
      const compressed = this._lzwCompress(str);
      return compressed;
    } catch (error) {
      console.error('Compression failed:', error);
      return str; // Return original if compression fails
    }
  },

  _decompress(str) {
    try {
      const decompressed = this._lzwDecompress(str);
      return decompressed;
    } catch (error) {
      console.error('Decompression failed:', error);
      return str; // Return as-is if decompression fails
    }
  },

  // LZW compression algorithm
  _lzwCompress(str) {
    const dict = {};
    const data = (str + '').split('');
    const out = [];
    let currChar;
    let phrase = data[0];
    let code = 256;

    for (let i = 1; i < data.length; i++) {
      currChar = data[i];
      if (dict[phrase + currChar] != null) {
        phrase += currChar;
      } else {
        out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
        dict[phrase + currChar] = code;
        code++;
        phrase = currChar;
      }
    }
    out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));

    // Convert array of codes to Uint16Array (codes can be > 255)
    return new Uint16Array(out);
  },

  _lzwDecompress(data) {
    const dict = {};
    let currChar = String.fromCharCode(data[0]);
    let oldPhrase = currChar;
    const out = [currChar];
    let code = 256;
    let phrase;

    for (let i = 1; i < data.length; i++) {
      const currCode = data[i];
      if (currCode < 256) {
        phrase = String.fromCharCode(data[i]);
      } else {
        phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
      }
      out.push(phrase);
      currChar = phrase.charAt(0);
      dict[code] = oldPhrase + currChar;
      code++;
      oldPhrase = phrase;
    }
    return out.join('');
  },

  // Encode content for URL sharing (uses lz-string compression if available)
  encodeContentForURL(content) {
    try {
      const jsonStr = JSON.stringify(content);

      // Try lz-string compression if available (50-70% smaller)
      if (typeof LZString !== 'undefined') {
        const compressed = LZString.compressToEncodedURIComponent(jsonStr);
        console.log('Compression stats:', {
          original: jsonStr.length,
          compressed: compressed.length,
          ratio: ((compressed.length / jsonStr.length) * 100).toFixed(1) + '%',
          method: 'lz-string'
        });
        // Prefix with 'z_' to identify compressed format
        return 'z_' + compressed;
      }

      // Fallback to URL-safe base64 (no compression)
      const base64 = btoa(unescape(encodeURIComponent(jsonStr)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      console.log('Encoding stats:', {
        original: jsonStr.length,
        base64: base64.length,
        ratio: ((base64.length / jsonStr.length) * 100).toFixed(1) + '%',
        method: 'base64'
      });

      return base64;
    } catch (error) {
      console.error('Failed to encode content:', error);
      return null;
    }
  },

  // Decode content from URL parameter (handles both lz-string and legacy base64)
  decodeContentFromURL(encodedStr) {
    try {
      // Check for lz-string compressed format (prefixed with 'z_')
      if (encodedStr.startsWith('z_')) {
        if (typeof LZString === 'undefined') {
          console.error('lz-string library not loaded, cannot decompress');
          return null;
        }
        const jsonStr = LZString.decompressFromEncodedURIComponent(encodedStr.slice(2));
        if (jsonStr) {
          return JSON.parse(jsonStr);
        }
        console.error('lz-string decompression returned null');
        return null;
      }

      // Legacy: URL-safe base64 decoding
      let base64 = encodedStr.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }

      // Decode from base64 and handle UTF-8
      const jsonStr = decodeURIComponent(escape(atob(base64)));

      // Parse JSON
      const content = JSON.parse(jsonStr);
      return content;
    } catch (error) {
      console.error('Failed to decode content from URL:', error);
      return null;
    }
  },

  // Generate shareable URL with encoded content
  generateShareURL(content) {
    try {
      const encoded = this.encodeContentForURL(content);
      if (!encoded) {
        return null;
      }

      // Get current page URL without parameters
      const baseURL = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/index.html');
      // Use fragment (#) instead of query parameter (?) to bypass server URL length limits
      const shareURL = `${baseURL}#content=${encoded}`;

      console.log('Generated URL:', shareURL.length, 'characters');

      return shareURL;
    } catch (error) {
      console.error('Failed to generate share URL:', error);
      return null;
    }
  },

  // Shorten URL using PHP proxy (bypasses CORS)
  async shortenURL(longURL) {
    try {
      console.log('Shortening URL via PHP proxy...');

      // Determine the correct proxy URL based on environment
      let proxyURL;
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Local development - use local proxy
        proxyURL = '/shorten-url.php';
      } else {
        // Production - use full URL to your server
        proxyURL = 'https://stefanomorello.com/langames/shorten-url.php';
      }

      const response = await fetch(proxyURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: longURL })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.shorturl) {
        console.log(`✅ URL shortened with ${data.service}:`, {
          original: data.original_length,
          shortened: data.shortened_length,
          saved: data.original_length - data.shortened_length
        });
        return data.shorturl;
      } else {
        throw new Error(data.error || 'Unknown error');
      }

    } catch (error) {
      console.error('URL shortening failed:', error.message);
      return null; // Return null if shortening fails, caller can use long URL
    }
  },

  // Helper to get correct server URL based on environment
  _getServerURL(filename) {
    // Auto-detect base URL from current page location
    const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
    return basePath + filename;
  },

  // Store content on server (primary sharing method - returns short ID)
  async storeContentOnServer(content) {
    try {
      const storeURL = this._getServerURL('store-content.php');
      console.log('Storing content on server...');

      const response = await fetch(storeURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.url) {
        console.log('Content stored successfully:', {
          id: data.id,
          expires: data.expires,
          url: data.url
        });
        return {
          url: data.url,
          id: data.id,
          expires: data.expires,
          expiresDate: data.expiresDate
        };
      }
      throw new Error(data.error || 'Unknown error');
    } catch (error) {
      console.warn('Server storage failed:', error.message);
      return null;
    }
  },

  // Load content from server by ID
  async loadContentFromServer(id) {
    try {
      const getURL = this._getServerURL('get-content.php') + '?id=' + encodeURIComponent(id);
      console.log('Loading content from server, ID:', id);

      const response = await fetch(getURL);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Server load failed:', error.error || `HTTP ${response.status}`);
        return null;
      }

      const content = await response.json();
      console.log('Content loaded from server:', content.language, content.difficulty);
      return content;
    } catch (error) {
      console.error('Server load failed:', error);
      return null;
    }
  },

  // Check for and load content from URL parameter or fragment
  loadContentFromURL() {
    try {
      let contentParam = null;

      // First try fragment (new method - bypasses server URL limits)
      if (window.location.hash) {
        const hash = window.location.hash.substring(1); // Remove the #
        const hashParams = new URLSearchParams(hash);
        contentParam = hashParams.get('content');
      }

      // Fallback to query parameter (old method for backwards compatibility)
      if (!contentParam) {
        const urlParams = new URLSearchParams(window.location.search);
        contentParam = urlParams.get('content');
      }

      if (!contentParam) {
        return null;
      }

      // Decode content from URL
      const content = this.decodeContentFromURL(contentParam);

      if (!content) {
        console.error('Failed to decode content from URL');
        return null;
      }

      // Validate content structure
      if (!content.language || !content.difficulty) {
        console.error('Invalid content structure in URL');
        return null;
      }

      // Save to localStorage for future use
      this.saveContent(content);
      this.saveSession(content.language, content.difficulty);

      console.log('Content loaded from URL:', content.language, content.difficulty);
      return content;
    } catch (error) {
      console.error('Error loading content from URL:', error);
      return null;
    }
  },

  // Initialize: Check URL for shared content on page load
  // Returns: true if content was loaded, false otherwise
  // Note: This is synchronous for URL-encoded content, but async for server-stored content
  initFromURL() {
    // First check for server-stored content (?id=xxx) - this is async
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id');

    if (contentId) {
      // Load from server asynchronously
      this.loadContentFromServer(contentId).then(content => {
        if (content) {
          this.saveContent(content);
          this.saveSession(content.language, content.difficulty);
          // Clean URL
          const url = new URL(window.location);
          url.searchParams.delete('id');
          window.history.replaceState({}, '', url);
          // Dispatch event so pages can react to loaded content
          window.dispatchEvent(new CustomEvent('contentLoaded', { detail: content }));
        }
      });
      return true; // Return true to indicate we're handling a share URL
    }

    // Fall back to URL-encoded content (#content=xxx or ?content=xxx)
    const urlContent = this.loadContentFromURL();
    if (urlContent) {
      // Clean URL by removing the content parameter and fragment
      const url = new URL(window.location);
      url.searchParams.delete('content');
      url.hash = ''; // Remove fragment
      window.history.replaceState({}, '', url);
      return true;
    }
    return false;
  },

  // Async version of initFromURL for pages that need to wait for content
  async initFromURLAsync() {
    // First check for server-stored content (?id=xxx)
    const urlParams = new URLSearchParams(window.location.search);
    const contentId = urlParams.get('id');

    if (contentId) {
      const content = await this.loadContentFromServer(contentId);
      if (content) {
        this.saveContent(content);
        this.saveSession(content.language, content.difficulty);
        // Clean URL
        const url = new URL(window.location);
        url.searchParams.delete('id');
        window.history.replaceState({}, '', url);
        return true;
      }
      return false;
    }

    // Fall back to URL-encoded content (#content=xxx or ?content=xxx)
    const urlContent = this.loadContentFromURL();
    if (urlContent) {
      const url = new URL(window.location);
      url.searchParams.delete('content');
      url.hash = '';
      window.history.replaceState({}, '', url);
      return true;
    }
    return false;
  }
};
