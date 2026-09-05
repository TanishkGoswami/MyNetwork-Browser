// Multi-Provider AI Intelligence Engine
// Native drivers for Google Gemini (Free), Anthropic Claude Direct, OpenRouter, and Local Fallback
const { aiTelemetryService } = require('./ai-telemetry-service');

class AiProviderEngine {
  constructor() {
    this.geminiDefaultModel = 'gemini-flash-latest';
    this.anthropicDefaultModel = 'claude-3-5-sonnet-20241022';
    this.openRouterDefaultModel = 'meta-llama/llama-3.3-70b-instruct';
  }

  /**
   * Automatically detects the AI provider based on key format and prefix.
   * @param {string} apiKey 
   * @returns {'gemini'|'anthropic'|'openrouter'|'opencode'|'unknown'}
   */
  detectProvider(apiKey) {
    if (!apiKey) return 'unknown';
    const key = apiKey.trim();
    if (key.startsWith('AQ.') || key.startsWith('AIza')) {
      return 'gemini';
    }
    if (key.startsWith('sk-ant-')) {
      return 'anthropic';
    }
    if (key.startsWith('sk-or-')) {
      return 'openrouter';
    }
    if (key.startsWith('sk-') && key.length > 30) {
      return 'opencode';
    }
    return 'unknown';
  }

  /**
   * Generates AI completion using the appropriate provider driver.
   */
  async generateCompletion({ apiKey, model, systemPrompt, userMessage, prompt, history = [] }) {
    const provider = this.detectProvider(apiKey);
    const query = (userMessage || prompt || '').trim();

    if (provider === 'gemini') {
      return this.callGeminiApi({ apiKey, model, systemPrompt, userMessage: query, history });
    } else if (provider === 'opencode') {
      return this.callOpenCodeApi({ apiKey, model, systemPrompt, userMessage: query, history });
    } else if (provider === 'anthropic') {
      return this.callAnthropicApi({ apiKey, model, systemPrompt, userMessage: query, history });
    } else if (provider === 'openrouter') {
      return this.callOpenRouterApi({ apiKey, model, systemPrompt, userMessage: query, history });
    } else {
      // If key format is unrecognized, try OpenCode first, fallback to OpenRouter & Anthropic
      if (apiKey.length > 20) {
        try {
          return await this.callOpenCodeApi({ apiKey, model, systemPrompt, userMessage: query, history });
        } catch (e) {
          try {
            return await this.callOpenRouterApi({ apiKey, model, systemPrompt, userMessage: query, history });
          } catch (e2) {
            return await this.callAnthropicApi({ apiKey, model, systemPrompt, userMessage: query, history });
          }
        }
      }
      throw new Error('No valid API key configured. Enter your OpenCode Zen, Google Gemini, Anthropic, or OpenRouter key in Settings.');
    }
  }

  /**
   * Google Gemini API Driver (100% Free via Google AI Studio Key)
   */
  async callGeminiApi({ apiKey, model, systemPrompt, userMessage, prompt, history = [] }) {
    const query = (userMessage || prompt || '').trim();
    if (!query) throw new Error('Query cannot be empty');

    let targetModel = 'gemini-flash-latest';
    if (model) {
      if (model.includes('pro')) targetModel = 'gemini-pro-latest';
      else if (model.includes('3.6')) targetModel = 'gemini-3.6-flash';
      else if (model.includes('3.7')) targetModel = 'gemini-3.7-flash';
      else if (model.includes('3.8')) targetModel = 'gemini-3.8-flash';
    }
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey.trim()}`;

    // Format history for Gemini
    const contents = [];

    // Append prior conversational turns
    if (Array.isArray(history)) {
      history.slice(-8).forEach(msg => {
        if (msg && msg.content) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: String(msg.content) }]
          });
        }
      });
    }

    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: query }]
    });

    const requestBody = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    if (systemPrompt && systemPrompt.trim()) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt.trim() }]
      };
    }

    const startTime = Date.now();
    let estimatedInputTokens = aiTelemetryService.estimateTokens(query) + (systemPrompt ? aiTelemetryService.estimateTokens(systemPrompt) : 0);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || response.statusText || 'Google Gemini API Request Failed';
        aiTelemetryService.recordEvent({
          provider: 'gemini',
          model: targetModel,
          inputTokens: estimatedInputTokens,
          outputTokens: 0,
          latencyMs,
          status: 'error',
          statusCode: response.status,
          promptSummary: query,
          errorMessage: errMsg
        });
        throw new Error(`Google Gemini API (${response.status}): ${errMsg}`);
      }

      const data = await response.json();
      const assistantText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!assistantText) {
        throw new Error('Empty response received from Google Gemini API.');
      }

      const usage = data.usageMetadata || {};
      const inTokens = usage.promptTokenCount || estimatedInputTokens;
      const outTokens = usage.candidatesTokenCount || aiTelemetryService.estimateTokens(assistantText);

      aiTelemetryService.recordEvent({
        provider: 'gemini',
        model: targetModel,
        inputTokens: inTokens,
        outputTokens: outTokens,
        totalTokens: usage.totalTokenCount || (inTokens + outTokens),
        latencyMs,
        status: 'success',
        statusCode: 200,
        promptSummary: query,
        responseSummary: assistantText
      });

      return assistantText;
    } catch (err) {
      if (!err.message.includes('Google Gemini API (')) {
        aiTelemetryService.recordEvent({
          provider: 'gemini',
          model: targetModel,
          inputTokens: estimatedInputTokens,
          outputTokens: 0,
          latencyMs: Date.now() - startTime,
          status: 'error',
          statusCode: 500,
          promptSummary: query,
          errorMessage: err.message
        });
      }
      throw err;
    }
  }

  /**
   * Anthropic Claude API Driver (Direct sk-ant-...)
   */
  async callAnthropicApi({ apiKey, model, systemPrompt, userMessage, history = [] }) {
    let anthropicModel = 'claude-3-5-sonnet-20241022';
    if (model) {
      if (model.includes('haiku')) anthropicModel = 'claude-3-5-haiku-20241022';
      else if (model.includes('opus')) anthropicModel = 'claude-3-opus-20240229';
      else if (model.includes('sonnet')) anthropicModel = 'claude-3-5-sonnet-20241022';
    }

    const messages = [];
    history.slice(-8).forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });
    messages.push({
      role: 'user',
      content: userMessage
    });

    const startTime = Date.now();
    let estimatedInputTokens = aiTelemetryService.estimateTokens(userMessage) + (systemPrompt ? aiTelemetryService.estimateTokens(systemPrompt) : 0);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.trim(),
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: anthropicModel,
          max_tokens: 2048,
          system: systemPrompt,
          messages
        })
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || response.statusText || 'Anthropic Request Failed';
        aiTelemetryService.recordEvent({
          provider: 'anthropic',
          model: anthropicModel,
          inputTokens: estimatedInputTokens,
          outputTokens: 0,
          latencyMs,
          status: 'error',
          statusCode: response.status,
          promptSummary: userMessage,
          errorMessage: errMsg
        });
        throw new Error(`Claude API (${response.status}): ${errMsg}`);
      }

      const data = await response.json();
      const assistantText = data?.content?.[0]?.text;
      if (!assistantText) {
        throw new Error('Empty response received from Claude API.');
      }

      const usage = data.usage || {};
      const inTokens = usage.input_tokens || estimatedInputTokens;
      const outTokens = usage.output_tokens || aiTelemetryService.estimateTokens(assistantText);

      aiTelemetryService.recordEvent({
        provider: 'anthropic',
        model: anthropicModel,
        inputTokens: inTokens,
        outputTokens: outTokens,
        totalTokens: inTokens + outTokens,
        latencyMs,
        status: 'success',
        statusCode: 200,
        promptSummary: userMessage,
        responseSummary: assistantText
      });

      return assistantText;
    } catch (err) {
      if (!err.message.includes('Claude API (')) {
        aiTelemetryService.recordEvent({
          provider: 'anthropic',
          model: anthropicModel,
          inputTokens: estimatedInputTokens,
          outputTokens: 0,
          latencyMs: Date.now() - startTime,
          status: 'error',
          statusCode: 500,
          promptSummary: userMessage,
          errorMessage: err.message
        });
      }
      throw err;
    }
  }

  /**
   * OpenRouter API Driver (sk-or-...)
   */
  async callOpenRouterApi({ apiKey, model, systemPrompt, userMessage, history = [] }) {
    let openRouterModel = model || 'meta-llama/llama-3.3-70b-instruct';
    if (!openRouterModel.includes('/')) {
      if (openRouterModel.includes('deepseek')) openRouterModel = 'deepseek/deepseek-r1';
      else if (openRouterModel.includes('coder')) openRouterModel = 'qwen/qwen-2.5-coder-32b-instruct';
      else if (openRouterModel.includes('llama')) openRouterModel = 'meta-llama/llama-3.3-70b-instruct';
      else openRouterModel = 'meta-llama/llama-3.3-70b-instruct';
    }

    const messages = [];
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt.trim() });
    }
    if (Array.isArray(history)) {
      history.slice(-8).forEach(m => {
        if (m && m.content) {
          messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content) });
        }
      });
    }
    messages.push({ role: 'user', content: userMessage });

    const startTime = Date.now();
    let estimatedInputTokens = aiTelemetryService.estimateTokens(userMessage) + (systemPrompt ? aiTelemetryService.estimateTokens(systemPrompt) : 0);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': 'https://mynetwork.browser',
          'X-Title': 'MyNetwork Browser Copilot'
        },
        body: JSON.stringify({
          model: openRouterModel,
          messages,
          max_tokens: 1500
        })
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || response.statusText || 'OpenRouter Request Failed';
        aiTelemetryService.recordEvent({
          provider: 'openrouter',
          model: openRouterModel,
          inputTokens: estimatedInputTokens,
          outputTokens: 0,
          latencyMs,
          status: 'error',
          statusCode: response.status,
          promptSummary: userMessage,
          errorMessage: errMsg
        });
        throw new Error(`OpenRouter API (${response.status}): ${errMsg}`);
      }

      const data = await response.json();
      const assistantText = data?.choices?.[0]?.message?.content;
      if (!assistantText) {
        throw new Error('Empty response received from OpenRouter API.');
      }

      const usage = data.usage || {};
      const inTokens = usage.prompt_tokens || estimatedInputTokens;
      const outTokens = usage.completion_tokens || aiTelemetryService.estimateTokens(assistantText);

      aiTelemetryService.recordEvent({
        provider: 'openrouter',
        model: openRouterModel,
        inputTokens: inTokens,
        outputTokens: outTokens,
        totalTokens: usage.total_tokens || (inTokens + outTokens),
        latencyMs,
        status: 'success',
        statusCode: 200,
        promptSummary: userMessage,
        responseSummary: assistantText
      });

      return assistantText;
    } catch (err) {
      if (!err.message.includes('OpenRouter API (')) {
        aiTelemetryService.recordEvent({
          provider: 'openrouter',
          model: openRouterModel,
          inputTokens: estimatedInputTokens,
          outputTokens: 0,
          latencyMs: Date.now() - startTime,
          status: 'error',
          statusCode: 500,
          promptSummary: userMessage,
          errorMessage: err.message
        });
      }
      throw err;
    }
  }

  /**
   * OpenCode Zen AI Driver (https://opencode.ai/zen/v1/chat/completions)
   */
  async callOpenCodeApi({ apiKey, model, systemPrompt, userMessage, history = [] }) {
    let openCodeModel = model || 'claude-3-5-sonnet';
    if (openCodeModel.includes('flash') || openCodeModel.includes('gemini')) {
      openCodeModel = 'claude-3-5-sonnet';
    }

    const messages = [];
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt.trim() });
    }
    if (Array.isArray(history)) {
      history.slice(-8).forEach(m => {
        if (m && m.content) {
          messages.push({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content) });
        }
      });
    }
    messages.push({ role: 'user', content: userMessage });

    const startTime = Date.now();
    const estimatedInputTokens = aiTelemetryService.estimateTokens(userMessage) + (systemPrompt ? aiTelemetryService.estimateTokens(systemPrompt) : 0);

    try {
      const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: openCodeModel,
          messages,
          max_tokens: 2048
        })
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || response.statusText || 'OpenCode Zen Request Failed';
        aiTelemetryService.recordEvent({
          provider: 'opencode',
          model: openCodeModel,
          inputTokens: estimatedInputTokens,
          outputTokens: 0,
          latencyMs,
          status: 'error',
          statusCode: response.status,
          promptSummary: userMessage,
          errorMessage: errMsg
        });
        throw new Error(`OpenCode Zen API (${response.status}): ${errMsg}`);
      }

      const data = await response.json();
      const assistantText = data?.choices?.[0]?.message?.content;
      if (!assistantText) {
        throw new Error('Empty response received from OpenCode Zen API.');
      }

      const usage = data.usage || {};
      const inTokens = usage.prompt_tokens || estimatedInputTokens;
      const outTokens = usage.completion_tokens || aiTelemetryService.estimateTokens(assistantText);

      aiTelemetryService.recordEvent({
        provider: 'opencode',
        model: openCodeModel,
        inputTokens: inTokens,
        outputTokens: outTokens,
        totalTokens: usage.total_tokens || (inTokens + outTokens),
        latencyMs,
        status: 'success',
        statusCode: 200,
        promptSummary: userMessage,
        responseSummary: assistantText
      });

      return assistantText;
    } catch (err) {
      if (!err.message.includes('OpenCode Zen API (')) {
        aiTelemetryService.recordEvent({
          provider: 'opencode',
          model: openCodeModel,
          inputTokens: estimatedInputTokens,
          outputTokens: 0,
          latencyMs: Date.now() - startTime,
          status: 'error',
          statusCode: 500,
          promptSummary: userMessage,
          errorMessage: err.message
        });
      }
      throw err;
    }
  }
}

const aiProviderEngine = new AiProviderEngine();

module.exports = { AiProviderEngine, aiProviderEngine };

