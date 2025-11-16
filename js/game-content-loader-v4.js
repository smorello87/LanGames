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

  // Encode content to compressed Base64 for URL sharing
  encodeContentForURL(content) {
    try {
      const jsonStr = JSON.stringify(content);

      // Compress the JSON string (returns Uint16Array)
      const compressed = this._compress(jsonStr);

      // Pack Uint16Array into bytes efficiently
      // Each 16-bit code takes 2 bytes
      const bytes = new Uint8Array(compressed.length * 2);
      for (let i = 0; i < compressed.length; i++) {
        bytes[i * 2] = compressed[i] & 0xFF;        // Low byte
        bytes[i * 2 + 1] = (compressed[i] >> 8) & 0xFF; // High byte
      }

      // Convert bytes to binary string
      let binaryStr = '';
      for (let i = 0; i < bytes.length; i++) {
        binaryStr += String.fromCharCode(bytes[i]);
      }

      // Encode to base64 (URL-safe)
      const base64 = btoa(binaryStr)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      console.log('Compression stats:', {
        original: jsonStr.length,
        compressedCodes: compressed.length,
        compressedBytes: bytes.length,
        base64: base64.length,
        ratio: ((1 - base64.length / jsonStr.length) * 100).toFixed(1) + '%'
      });

      return base64;
    } catch (error) {
      console.error('Failed to encode content:', error);
      return null;
    }
  },

  // Decode content from compressed Base64 URL parameter
  decodeContentFromURL(base64Str) {
    try {
      // Restore standard base64
      let base64 = base64Str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }

      // Decode from base64 to binary string
      const binaryStr = atob(base64);

      // Convert binary string to Uint8Array
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Unpack bytes back to Uint16Array
      // Each code is stored as 2 bytes (little-endian)
      const codeCount = bytes.length / 2;
      const compressed = new Uint16Array(codeCount);
      for (let i = 0; i < codeCount; i++) {
        compressed[i] = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
      }

      // Decompress (takes Uint16Array, returns string)
      const jsonStr = this._decompress(compressed);

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
      const shareURL = `${baseURL}?content=${encoded}`;

      // Check URL length (most browsers support ~2000 chars, but we'll warn at 1800)
      if (shareURL.length > 1800) {
        console.warn('Generated URL is quite long:', shareURL.length, 'characters');
      }

      return shareURL;
    } catch (error) {
      console.error('Failed to generate share URL:', error);
      return null;
    }
  },

  // Shorten URL using free URL shortening API
  async shortenURL(longURL) {
    // Try multiple free services in order
    const services = [
      {
        name: 'ulvis.net',
        url: `https://ulvis.net/API/write/get?url=${encodeURIComponent(longURL)}`,
        parseResponse: async (response) => {
          const data = await response.json();
          if (data.success && data.data && data.data.url) {
            return data.data.url;
          }
          throw new Error('Invalid response format');
        }
      },
      {
        name: 'is.gd',
        url: `https://is.gd/create.php?format=json&url=${encodeURIComponent(longURL)}`,
        parseResponse: async (response) => {
          const data = await response.json();
          if (data.shorturl) {
            return data.shorturl;
          }
          throw new Error(data.errormessage || 'Invalid response format');
        }
      },
      {
        name: 'v.gd',
        url: `https://v.gd/create.php?format=json&url=${encodeURIComponent(longURL)}`,
        parseResponse: async (response) => {
          const data = await response.json();
          if (data.shorturl) {
            return data.shorturl;
          }
          throw new Error(data.errormessage || 'Invalid response format');
        }
      }
    ];

    // Try each service in order
    for (const service of services) {
      try {
        console.log(`Trying URL shortener: ${service.name}`);

        const response = await fetch(service.url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const shortURL = await service.parseResponse(response);

        // Validate response
        if (!shortURL || !shortURL.startsWith('http')) {
          throw new Error('Invalid URL returned');
        }

        console.log(`✅ URL shortened with ${service.name}:`, {
          original: longURL.length,
          shortened: shortURL.length,
          saved: longURL.length - shortURL.length
        });

        return shortURL;
      } catch (error) {
        console.warn(`${service.name} failed:`, error.message);
        // Continue to next service
      }
    }

    // All services failed
    console.error('All URL shortening services failed');
    return null; // Return null if shortening fails, caller can use long URL
  },

  // Check for and load content from URL parameter
  loadContentFromURL() {
    try {
      // Check for 'content' parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const contentParam = urlParams.get('content');

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
  initFromURL() {
    const urlContent = this.loadContentFromURL();
    if (urlContent) {
      // Clean URL by removing the content parameter
      const url = new URL(window.location);
      url.searchParams.delete('content');
      window.history.replaceState({}, '', url);
      return true;
    }
    return false;
  }
};
