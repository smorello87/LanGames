// LLM Configuration Manager
// Handles storage and retrieval of LLM API settings

const LLMConfig = {
  // Storage keys
  STORAGE_KEY: 'llm-settings',

  // Default provider configurations
  defaults: {
    openrouter: {
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      models: ['google/gemini-3.1-flash-lite', 'google/gemini-3.5-flash', 'anthropic/claude-haiku-4.5', 'anthropic/claude-sonnet-5', 'openai/gpt-5.4-mini', 'openai/gpt-5.4', 'meta-llama/llama-3.3-70b-instruct']
    },
    openwebui: {
      endpoint: 'http://localhost:8080/api/chat/completions',
      models: ['custom-model-1', 'custom-model-2']
    }
  },

  // --- CAIL mode -----------------------------------------------------------
  // On the CUNY AI Lab deployment (tools.ailab.gc.cuny.edu/langames/) the
  // Worker generates content through CAIL Gateway on the signed-in person's
  // own allowance. There is no API key there, and none may be stored: that
  // origin is shared with every other CAIL tool. Everywhere else the probe
  // below gets a 404 and the page keeps its bring-your-own-key behavior.
  CAIL_MODEL_KEY: 'langames-cail-model',
  _cail: null,

  // Resolves to { cail: false } or { cail: true, models, defaultModel }.
  detectCail() {
    if (!this._cail) {
      this._cail = fetch('api/session', { headers: { Accept: 'application/json' } })
        .then(async (response) => {
          if (response.status === 401) {
            const body = await response.json().catch(() => ({}));
            if (this.handleLostSession(body)) return new Promise(() => {});
            return { cail: false };
          }
          if (!response.ok) return { cail: false };
          const body = await response.json().catch(() => null);
          if (!body || body.cail !== true || !Array.isArray(body.models)) return { cail: false };
          return { cail: true, models: body.models, defaultModel: body.defaultModel };
        })
        .catch(() => ({ cail: false }));
    }
    return this._cail;
  },

  // A lost CAIL session is recovered by a full-page navigation to the tool's
  // own launch path. Never fetch the login URL or retry the request.
  handleLostSession(body) {
    const error = body && body.error;
    const lost = error && (error.code === 'authentication_required' || error.code === 'session_invalid');
    if (!lost || typeof error.launch !== 'string' || !error.launch.startsWith('/launch/')) return false;
    window.location.assign(error.launch);
    return true;
  },

  getCailModel(info) {
    const ids = info.models.map(m => m.id);
    let stored = null;
    try { stored = localStorage.getItem(this.CAIL_MODEL_KEY); } catch (e) { /* storage unavailable */ }
    return ids.includes(stored) ? stored : info.defaultModel;
  },

  setCailModel(model) {
    try { localStorage.setItem(this.CAIL_MODEL_KEY, model); } catch (e) { /* storage unavailable */ }
  },

  async getCailQuota() {
    const response = await fetch('api/quota', { headers: { Accept: 'application/json' } });
    if (response.status === 401 && this.handleLostSession(await response.json().catch(() => ({})))) {
      return new Promise(() => {});
    }
    if (!response.ok) return null;
    return response.json().catch(() => null);
  },

  // Settings for the active mode: CAIL when detected, else the stored key.
  async getActiveSettings() {
    const info = await this.detectCail();
    if (info.cail) return { provider: 'cail', model: this.getCailModel(info) };
    return this.getSettings();
  },

  // Get current settings from localStorage
  getSettings() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse LLM settings:', e);
        return null;
      }
    }
    return null;
  },

  // Save settings to localStorage
  saveSettings(settings) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
      return true;
    } catch (e) {
      console.error('Failed to save LLM settings:', e);
      return false;
    }
  },

  // Validate settings
  validateSettings(settings) {
    if (!settings || !settings.provider) {
      return { valid: false, error: 'Provider is required' };
    }
    if (settings.provider === 'cail') {
      return settings.model ? { valid: true } : { valid: false, error: 'Model selection is required' };
    }
    if (!settings.endpoint) {
      return { valid: false, error: 'API endpoint is required' };
    }
    if (!settings.apiKey) {
      return { valid: false, error: 'API key is required' };
    }
    if (!settings.model) {
      return { valid: false, error: 'Model selection is required' };
    }
    return { valid: true };
  },

  // Test API connection
  async testConnection(settings) {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      // Different providers use different auth headers
      if (settings.provider === 'openrouter') {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'Impariamo Language Games';
      } else if (settings.provider === 'openwebui') {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
      }

      const requestBody = {
        model: settings.model,
        messages: [
          { role: 'user', content: 'Reply with just the word "success".' }
        ],
        max_tokens: 10
      };

      const response = await fetch(settings.endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[LLMConfig] API error response:', errorData);

        // Provide specific error messages
        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your API key.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else if (response.status === 403) {
          throw new Error('Access forbidden. Check your API key permissions.');
        } else {
          throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Connection successful! API is responding correctly.'
      };
    } catch (error) {
      console.error('[LLMConfig] Connection test failed:', error);

      // Check for CORS errors
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        return {
          success: false,
          message: 'Connection failed: CORS or network error. Check your network connection and API endpoint.'
        };
      }

      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  },

  // Get default endpoint for provider
  getDefaultEndpoint(provider) {
    return this.defaults[provider]?.endpoint || '';
  },

  // Get available models for provider
  getModels(provider) {
    return this.defaults[provider]?.models || [];
  },

  // Clear all settings
  clearSettings() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};
