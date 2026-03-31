// LLM Configuration Manager
// Handles storage and retrieval of LLM API settings

const LLMConfig = {
  // Storage keys
  STORAGE_KEY: 'llm-settings',

  // Default provider configurations
  defaults: {
    openrouter: {
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      models: ['openai/gpt-4', 'anthropic/claude-3.5-sonnet', 'google/gemini-pro', 'meta-llama/llama-3-70b-instruct']
    },
    openwebui: {
      endpoint: 'http://localhost:8080/api/chat/completions',
      models: ['custom-model-1', 'custom-model-2']
    }
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
    console.log('[LLMConfig] Testing connection with settings:', {
      provider: settings.provider,
      endpoint: settings.endpoint,
      model: settings.model,
      apiKey: settings.apiKey ? '[SET]' : '[MISSING]'
    });

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

      console.log('[LLMConfig] Request headers:', Object.keys(headers));

      const requestBody = {
        model: settings.model,
        messages: [
          { role: 'user', content: 'Reply with just the word "success".' }
        ],
        max_tokens: 10
      };

      console.log('[LLMConfig] Sending test request...');

      const response = await fetch(settings.endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      console.log('[LLMConfig] Response status:', response.status, response.statusText);

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
      console.log('[LLMConfig] Test successful!', data);

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
