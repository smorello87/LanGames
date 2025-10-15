// Content Generator using LLM APIs
// Generates educational content for all games

const ContentGenerator = {
  // Generate all content for a language and difficulty
  async generateAllContent(language, difficulty, progressCallback) {
    const settings = LLMConfig.getSettings();
    if (!settings) {
      throw new Error('LLM settings not configured. Please configure settings first.');
    }

    const validation = LLMConfig.validateSettings(settings);
    if (!validation.valid) {
      throw new Error(`Invalid settings: ${validation.error}`);
    }

    const content = {
      language,
      difficulty,
      timestamp: new Date().toISOString(),
      wordle: null,
      memory: null,
      verbTenses: null,
      reflexiveVerbs: null
    };

    try {
      // Generate Wordle words
      if (progressCallback) progressCallback('Generating Wordle words...', 0);
      content.wordle = await this.generateWordleWords(language, difficulty, settings);

      // Generate Memory game content
      if (progressCallback) progressCallback('Generating Memory game pairs...', 25);
      content.memory = await this.generateMemoryContent(language, difficulty, settings);

      // Generate Verb Tenses
      if (progressCallback) progressCallback('Generating verb tenses...', 50);
      content.verbTenses = await this.generateVerbTenses(language, difficulty, settings);

      // Generate Reflexive Verbs
      if (progressCallback) progressCallback('Generating reflexive verbs...', 75);
      content.reflexiveVerbs = await this.generateReflexiveVerbs(language, difficulty, settings);

      if (progressCallback) progressCallback('Content generation complete!', 100);

      return content;
    } catch (error) {
      throw new Error(`Content generation failed: ${error.message}`);
    }
  },

  // Generate Wordle words (15 words per difficulty)
  async generateWordleWords(language, difficulty, settings) {
    const prompt = `Generate exactly 15 five-letter words in ${language} suitable for a ${difficulty} difficulty word game.

Requirements:
- All words must be exactly 5 letters long
- Words should be common, appropriate vocabulary for ${difficulty} level learners
- No proper nouns, no slang
- Include a mix of nouns, verbs, and adjectives
- For beginner: very basic vocabulary
- For intermediate: common everyday words
- For advanced: less common but still useful words

Return ONLY a JSON array of strings, like this:
["word1", "word2", "word3", ...]

No explanations, just the JSON array.`;

    const response = await this.callLLM(prompt, settings, 500);
    console.log('[ContentGenerator] Wordle response length:', response.length);
    console.log('[ContentGenerator] Wordle response preview:', response.substring(0, 200));

    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('[ContentGenerator] Failed to parse Wordle JSON:', error);
      console.error('[ContentGenerator] Full response:', response);
      throw new Error(`Failed to parse Wordle words: ${error.message}`);
    }
  },

  // Generate Memory game content (12 pairs for each of 5 topics)
  async generateMemoryContent(language, difficulty, settings) {
    const topics = ['food', 'daily', 'family', 'school', 'work'];
    const topicNames = {
      food: 'Food and Drink',
      daily: 'Daily Activities',
      family: 'Family Members',
      school: 'School and Education',
      work: 'Work and Career'
    };

    const memoryContent = {};

    for (const topic of topics) {
      const prompt = `Generate exactly 12 word pairs for a memory matching game. The topic is "${topicNames[topic]}".

Requirements:
- Target language: ${language}
- Difficulty level: ${difficulty}
- Each pair has one word in ${language} and its English translation
- Choose vocabulary appropriate for ${difficulty} level learners
- Words should be relevant to the "${topicNames[topic]}" topic

Return ONLY a JSON array of objects in this exact format:
[
  {"${language.toLowerCase()}": "word1", "english": "translation1"},
  {"${language.toLowerCase()}": "word2", "english": "translation2"},
  ...
]

Return exactly 12 pairs. No explanations, just the JSON array.`;

      const response = await this.callLLM(prompt, settings, 1000);
      console.log(`[ContentGenerator] Memory ${topic} response length:`, response.length);
      console.log(`[ContentGenerator] Memory ${topic} response preview:`, response.substring(0, 200));

      try {
        const parsed = JSON.parse(response);

        // Normalize the key name to match expected format (e.g., "italian" for Italian)
        const langKey = Object.keys(parsed[0]).find(k => k !== 'english');
        memoryContent[topic] = parsed.map(item => ({
          word: item[langKey],
          english: item.english
        }));
      } catch (error) {
        console.error(`[ContentGenerator] Failed to parse Memory ${topic} JSON:`, error);
        console.error('[ContentGenerator] Full response:', response);
        throw new Error(`Failed to parse Memory ${topic} content: ${error.message}`);
      }
    }

    return memoryContent;
  },

  // Generate verb tenses (20 regular verbs)
  async generateVerbTenses(language, difficulty, settings) {
    const prompt = `Generate exactly 20 regular verbs in ${language} with their conjugations in present tense.

Requirements:
- Target language: ${language}
- Difficulty level: ${difficulty}
- Choose common regular verbs appropriate for ${difficulty} learners
- Include the infinitive form and English translation
- Include present tense conjugations for all persons (I, you, he/she, we, you-plural, they)

Return ONLY a JSON array of objects in this exact format:
[
  {
    "infinitive": "verb_infinitive",
    "english": "english_translation",
    "conjugations": {
      "io": "I_form",
      "tu": "you_form",
      "lui_lei": "he_she_form",
      "noi": "we_form",
      "voi": "you_plural_form",
      "loro": "they_form"
    }
  },
  ...
]

Return exactly 20 verbs. Adapt the pronoun keys to ${language} if different from Italian. No explanations, just the JSON array.`;

    const response = await this.callLLM(prompt, settings, 6000);
    console.log('[ContentGenerator] Verb tenses response length:', response.length);
    console.log('[ContentGenerator] Verb tenses response preview:', response.substring(0, 200));

    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('[ContentGenerator] Failed to parse verb tenses JSON:', error);
      console.error('[ContentGenerator] Full response:', response);
      throw new Error(`Failed to parse verb tenses: ${error.message}`);
    }
  },

  // Generate reflexive verbs (15 reflexive verbs)
  async generateReflexiveVerbs(language, difficulty, settings) {
    const prompt = `Generate exactly 15 reflexive verbs in ${language} with their conjugations.

Requirements:
- Target language: ${language}
- Difficulty level: ${difficulty}
- Choose common reflexive verbs appropriate for ${difficulty} learners
- Include the infinitive form and English translation
- Include present tense conjugations for all persons with reflexive pronouns

Return ONLY a JSON array of objects in this exact format:
[
  {
    "infinitive": "reflexive_verb_infinitive",
    "english": "english_translation",
    "conjugations": {
      "io": "pronoun + verb_form",
      "tu": "pronoun + verb_form",
      "lui_lei": "pronoun + verb_form",
      "noi": "pronoun + verb_form",
      "voi": "pronoun + verb_form",
      "loro": "pronoun + verb_form"
    }
  },
  ...
]

Return exactly 15 verbs. Adapt the pronoun keys to ${language} if different from Italian. No explanations, just the JSON array.`;

    const response = await this.callLLM(prompt, settings, 5000);
    console.log('[ContentGenerator] Reflexive verbs response length:', response.length);
    console.log('[ContentGenerator] Reflexive verbs response preview:', response.substring(0, 200));

    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('[ContentGenerator] Failed to parse reflexive verbs JSON:', error);
      console.error('[ContentGenerator] Full response:', response);
      throw new Error(`Failed to parse reflexive verbs: ${error.message}`);
    }
  },

  // Call LLM API
  async callLLM(prompt, settings, maxTokens = 4000) {
    console.log('[ContentGenerator] Making API call to:', settings.provider, settings.model);
    console.log('[ContentGenerator] Max tokens:', maxTokens);

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
        {
          role: 'system',
          content: 'You are a language education expert. Generate educational content exactly as requested. Always return valid JSON with no additional text or formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: maxTokens
    };

    try {
      console.log('[ContentGenerator] Sending request...');

      const response = await fetch(settings.endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });

      console.log('[ContentGenerator] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[ContentGenerator] API error:', errorData);

        // Provide specific error messages
        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your API key in settings.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait and try again.');
        } else if (response.status === 403) {
          throw new Error('Access forbidden. Check your API key permissions.');
        } else if (response.status === 400) {
          throw new Error(`Bad request: ${errorData.error?.message || 'Invalid request parameters'}`);
        } else {
          throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('[ContentGenerator] Response received');
      console.log('[ContentGenerator] Response data structure:', Object.keys(data));

      // Extract content from response (format varies by provider)
      let content;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        content = data.choices[0].message.content;
        console.log('[ContentGenerator] Using choices[0].message.content path');
      } else if (data.message && data.message.content) {
        content = data.message.content;
        console.log('[ContentGenerator] Using message.content path');
      } else {
        console.error('[ContentGenerator] Unexpected response format:', data);
        throw new Error('Unexpected API response format');
      }

      console.log('[ContentGenerator] Raw content length:', content ? content.length : 0);
      console.log('[ContentGenerator] Raw content type:', typeof content);

      if (!content) {
        console.error('[ContentGenerator] Content is empty or null');
        throw new Error('API returned empty content');
      }

      // Clean up response - remove markdown code blocks if present
      content = content.trim();
      console.log('[ContentGenerator] Content after trim:', content.length);

      if (content.startsWith('```json')) {
        content = content.replace(/```json\n?/, '').replace(/```\s*$/, '');
        console.log('[ContentGenerator] Removed ```json markers');
      } else if (content.startsWith('```')) {
        content = content.replace(/```\n?/, '').replace(/```\s*$/, '');
        console.log('[ContentGenerator] Removed ``` markers');
      }

      console.log('[ContentGenerator] Content extracted successfully, final length:', content.trim().length);
      return content.trim();

    } catch (error) {
      console.error('[ContentGenerator] API call failed:', error);

      // Check for CORS errors
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        throw new Error(
          'Network error: Unable to connect to API. Check your network connection and API endpoint.'
        );
      }

      throw new Error(`API call failed: ${error.message}`);
    }
  }
};
