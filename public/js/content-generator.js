// Content Generator using LLM APIs
// Generates educational content for all games

const ContentGenerator = {
  // --- Client-side content repair (never trust LLM prompt compliance) ---

  // Keep only real 5-letter words; trim, NFC-normalize, dedupe case-insensitively
  repairWordleWords(words) {
    if (!Array.isArray(words)) return [];
    const seen = new Set();
    const valid = [];
    for (const raw of words) {
      if (typeof raw !== 'string') continue;
      const word = raw.trim().normalize('NFC');
      if (/\s/.test(word)) continue;
      if ([...word].length !== 5) continue;
      const key = word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      valid.push(word);
    }
    return valid;
  },

  // Drop pairs that would overflow memory cards (word ≤ 12, english ≤ 14, single words only)
  repairMemoryPairs(pairs) {
    if (!Array.isArray(pairs)) return [];
    return pairs.filter(p =>
      p && typeof p.word === 'string' && typeof p.english === 'string' &&
      p.word.length > 0 && p.english.length > 0 &&
      !/\s/.test(p.word) && !/\s/.test(p.english) &&
      [...p.word].length <= 12 && [...p.english].length <= 14
    );
  },

  // Drop malformed verb entries
  repairVerbs(verbs) {
    if (!Array.isArray(verbs)) return [];
    return verbs.filter(v =>
      v && typeof v === 'object' &&
      typeof v.infinitive === 'string' && v.infinitive.length > 0 &&
      typeof v.english === 'string' && v.english.length > 0 &&
      v.conjugations && typeof v.conjugations === 'object' &&
      Object.keys(v.conjugations).length > 0
    );
  },

  MEMORY_TOPICS: {
    food: 'Food and Drink',
    daily: 'Daily Activities',
    family: 'Family Members',
    school: 'School and Education',
    work: 'Work and Career'
  },

  SECTION_KEYS: [
    'wordle', 'memory:food', 'memory:daily', 'memory:family',
    'memory:school', 'memory:work', 'verbTenses', 'reflexiveVerbs'
  ],

  sectionLabel(key) {
    if (key === 'wordle') return 'Wordle words';
    if (key === 'verbTenses') return 'Verb conjugations';
    if (key === 'reflexiveVerbs') return 'Reflexive verbs';
    if (key.startsWith('memory:')) return `Memory — ${this.MEMORY_TOPICS[key.slice(7)]}`;
    return key;
  },

  // Dispatch a single section to its generator
  async generateSection(key, language, difficulty, settings) {
    if (key === 'wordle') return this.generateWordleWords(language, difficulty, settings);
    if (key === 'verbTenses') return this.generateVerbTenses(language, difficulty, settings);
    if (key === 'reflexiveVerbs') return this.generateReflexiveVerbs(language, difficulty, settings);
    if (key.startsWith('memory:')) return this.generateMemoryTopic(key.slice(7), language, difficulty, settings);
    throw new Error(`Unknown section: ${key}`);
  },

  // Run sections concurrently; one retry each; report progress as sections settle
  async generateSections(keys, language, difficulty, progressCallback) {
    const settings = LLMConfig.getSettings();
    if (!settings) {
      throw new Error('LLM settings not configured. Please configure settings first.');
    }
    const validation = LLMConfig.validateSettings(settings);
    if (!validation.valid) {
      throw new Error(`Invalid settings: ${validation.error}`);
    }

    let done = 0;
    const report = () => {
      done++;
      if (progressCallback) {
        progressCallback(`${done} of ${keys.length} sections complete`, Math.ceil((done / keys.length) * 100));
      }
    };

    const settled = await Promise.allSettled(keys.map(async (key) => {
      try {
        const value = await this.generateSection(key, language, difficulty, settings);
        report();
        return { key, value };
      } catch (firstError) {
        console.warn(`Section ${key} failed, retrying once:`, firstError.message);
        try {
          const value = await this.generateSection(key, language, difficulty, settings);
          report();
          return { key, value };
        } catch (secondError) {
          report();
          throw Object.assign(new Error(secondError.message), { sectionKey: key });
        }
      }
    }));

    const sections = {};
    const failed = [];
    settled.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        sections[res.value.key] = res.value.value;
      } else {
        failed.push({ key: keys[i], error: res.reason.message });
      }
    });
    return { sections, failed };
  },

  // Merge a sections map into a content object
  applySections(content, sections) {
    for (const [key, value] of Object.entries(sections)) {
      if (key.startsWith('memory:')) {
        if (!content.memory || typeof content.memory !== 'object') content.memory = {};
        content.memory[key.slice(7)] = value;
      } else {
        content[key] = value;
      }
    }
  },

  // Generate all content for a language and difficulty.
  // Returns { content, failed }: content holds every successful section;
  // failed lists sections that failed twice (empty array = full success).
  async generateAllContent(language, difficulty, progressCallback) {
    const { sections, failed } = await this.generateSections(
      this.SECTION_KEYS, language, difficulty, progressCallback
    );
    const content = {
      language,
      difficulty,
      timestamp: new Date().toISOString(),
      wordle: null,
      memory: {},
      verbTenses: null,
      reflexiveVerbs: null
    };
    this.applySections(content, sections);
    return { content, failed };
  },

  // Generate Wordle words (15 words per difficulty)
  async generateWordleWords(language, difficulty, settings) {
    const prompt = `Generate exactly 15 words in ${language} suitable for a ${difficulty} difficulty word game.

CRITICAL REQUIREMENT: Every single word MUST be exactly 5 letters long when written in ${language}. Count the letters carefully.

Requirements:
- Each word must be EXACTLY 5 letters long - no more, no less
- For non-Latin alphabets (Cyrillic, Chinese, etc.), count characters in the native script
- Words should be common, appropriate vocabulary for ${difficulty} level learners
- No proper nouns, no slang, no abbreviations
- Include a mix of nouns, verbs, and adjectives
- For beginner: very basic vocabulary (house, water, book, etc.)
- For intermediate: common everyday words
- For advanced: less common but still useful words

VERIFY: Before returning, double-check that each word is exactly 5 letters long.

Return ONLY a JSON array of strings, like this:
["word1", "word2", "word3", ...]

No explanations, just the JSON array.`;

    const response = await this.callLLM(prompt, settings, 500);

    try {
      const words = JSON.parse(response);
      if (!Array.isArray(words) || words.length === 0) {
        throw new Error('Expected an array of words from the API');
      }
      const repaired = this.repairWordleWords(words);
      if (repaired.length < 8) {
        throw new Error(`Only ${repaired.length} valid 5-letter words returned (need at least 8)`);
      }
      return repaired;
    } catch (error) {
      console.error('[ContentGenerator] Failed to parse Wordle JSON:', error);
      console.error('[ContentGenerator] Full response:', response);
      throw new Error(`Failed to parse Wordle words: ${error.message}`);
    }
  },

  // Generate Memory game content for ONE topic (12 pairs requested, ≥8 valid required)
  async generateMemoryTopic(topic, language, difficulty, settings) {
    const topicName = this.MEMORY_TOPICS[topic];
    const prompt = `Generate exactly 12 word pairs for a memory matching game. The topic is "${topicName}".

Requirements:
- Target language: ${language}
- Difficulty level: ${difficulty}
- Each pair has one word in ${language} and its English translation
- CRITICAL: Words must be SHORT - maximum 12 characters for ${language} words, maximum 14 characters for English
- Use SINGLE WORDS only - no phrases with spaces (e.g., use "homework" not "home work", "breakfast" not "have breakfast")
- If a concept requires multiple words, choose a simpler single-word alternative
- Choose vocabulary appropriate for ${difficulty} level learners
- Words should be relevant to the "${topicName}" topic
- Prefer shorter, concise vocabulary that fits well on cards

Examples of good word pairs:
- {"${language.toLowerCase()}": "яблоко", "english": "apple"} ✓
- {"${language.toLowerCase()}": "работать", "english": "work"} ✓

Examples of BAD word pairs (too long):
- {"${language.toLowerCase()}": "собеседование", "english": "job interview"} ✗
- {"${language.toLowerCase()}": "домашнее задание", "english": "homework assignment"} ✗

Return ONLY a JSON array of objects in this exact format:
[
  {"${language.toLowerCase()}": "word1", "english": "translation1"},
  {"${language.toLowerCase()}": "word2", "english": "translation2"},
  ...
]

Return exactly 12 pairs. No explanations, just the JSON array.`;

    const response = await this.callLLM(prompt, settings, 1000);

    try {
      const parsed = JSON.parse(response);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Expected an array of word pairs');
      }
      const langKey = Object.keys(parsed[0]).find(k => k !== 'english');
      if (!langKey) {
        throw new Error('Word pairs missing language key');
      }
      const mapped = parsed
        .filter(item => item && item[langKey] && item.english)
        .map(item => ({ word: item[langKey], english: item.english }));
      const repaired = this.repairMemoryPairs(mapped);
      if (repaired.length < 8) {
        throw new Error(`Only ${repaired.length} valid pairs (need at least 8)`);
      }
      return repaired;
    } catch (error) {
      console.error(`[ContentGenerator] Failed to parse Memory ${topic} JSON:`, error);
      console.error('[ContentGenerator] Full response:', response);
      throw new Error(`Failed to parse Memory ${topic} content: ${error.message}`);
    }
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

    try {
      const verbs = JSON.parse(response);
      if (!Array.isArray(verbs) || verbs.length === 0) {
        throw new Error('Expected an array of verb objects');
      }
      const repaired = this.repairVerbs(verbs);
      if (repaired.length < 10) {
        throw new Error(`Only ${repaired.length} valid verbs returned (need at least 10)`);
      }
      return repaired;
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

IMPORTANT - Conjugation Format for Reflexive Verbs:
- Include the FULL conjugated form with both subject pronoun and reflexive pronoun
- This ensures clarity about which reflexive pronoun to use (mich/dich/sich in German, me/te/se in Spanish, etc.)
- Example for German: "ich": "ich wasche mich", "du": "du wäschst dich", "er_sie_es": "er/sie/es wäscht sich"
- Example for Spanish: "yo": "yo me lavo", "tú": "tú te lavas", "él_ella": "él/ella se lava"
- Example for Italian: "io": "io mi lavo", "tu": "tu ti lavi", "lui_lei": "lui/lei si lava"
- For combined pronouns (like "er/sie/es"), include them in the value: "er/sie/es wäscht sich"

Return ONLY a JSON array of objects in this exact format:
[
  {
    "infinitive": "reflexive_verb_infinitive",
    "english": "english_translation",
    "conjugations": {
      "io": "io mi lavo",
      "tu": "tu ti lavi",
      "lui_lei": "lui/lei si lava",
      "noi": "noi ci laviamo",
      "voi": "voi vi lavate",
      "loro": "loro si lavano"
    }
  },
  ...
]

Return exactly 15 verbs. Adapt the pronoun keys to ${language} if different from Italian. No explanations, just the JSON array.`;

    const response = await this.callLLM(prompt, settings, 5000);

    try {
      const verbs = JSON.parse(response);
      if (!Array.isArray(verbs) || verbs.length === 0) {
        throw new Error('Expected an array of reflexive verb objects');
      }
      const repaired = this.repairVerbs(verbs);
      if (repaired.length < 8) {
        throw new Error(`Only ${repaired.length} valid reflexive verbs returned (need at least 8)`);
      }
      return repaired;
    } catch (error) {
      console.error('[ContentGenerator] Failed to parse reflexive verbs JSON:', error);
      console.error('[ContentGenerator] Full response:', response);
      throw new Error(`Failed to parse reflexive verbs: ${error.message}`);
    }
  },

  // Call LLM API
  async callLLM(prompt, settings, maxTokens = 4000) {

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

      const response = await fetch(settings.endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });


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

      // Extract content from response (format varies by provider)
      let content;
      if (data.choices && data.choices[0] && data.choices[0].message) {
        content = data.choices[0].message.content;
      } else if (data.message && data.message.content) {
        content = data.message.content;
      } else {
        console.error('[ContentGenerator] Unexpected response format:', data);
        throw new Error('Unexpected API response format');
      }


      if (!content) {
        console.error('[ContentGenerator] Content is empty or null');
        throw new Error('API returned empty content');
      }

      // Clean up response - remove markdown code blocks if present
      content = content.trim();

      if (content.startsWith('```json')) {
        content = content.replace(/```json\n?/, '').replace(/```\s*$/, '');
      } else if (content.startsWith('```')) {
        content = content.replace(/```\n?/, '').replace(/```\s*$/, '');
      }

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
