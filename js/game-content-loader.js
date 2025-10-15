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
  }
};
