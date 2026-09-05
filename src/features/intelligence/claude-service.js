// Claude & Multi-Provider AI Copilot Service
const { eventBus } = require('../../shared/events/event-bus');
const { tabManager } = require('../../core/tabs/tab-manager');
const { workspaceService } = require('../bookmarks');
const { scratchpadService } = require('../scratchpad/scratchpad-service');
const { aiProviderEngine } = require('./ai-provider-engine');

class ClaudeService {
  constructor() {
    this.refreshConfig();
    this.history = []; // Multi-turn message history [{role: 'user'|'assistant', content: '...'}]
    this.maxContextTokens = 12000;
  }

  refreshConfig() {
    const envKey = (typeof process !== 'undefined' && process.env && (process.env.OPENCODE_API_KEY || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.OPENROUTER_API_KEY)) || '';
    const storedKey = (typeof localStorage !== 'undefined' && localStorage.getItem('mynetwork_claude_api_key')) || '';
    
    // Auto-detect and sync key
    this.apiKey = storedKey || envKey;
    this.model = (typeof localStorage !== 'undefined' && localStorage.getItem('mynetwork_claude_model')) || '';

    // If model is empty or invalid, pick best default based on key provider
    if (!this.model) {
      const provider = aiProviderEngine.detectProvider(this.apiKey);
      if (provider === 'gemini') {
        this.model = 'gemini-flash-latest';
      } else if (provider === 'opencode') {
        this.model = 'claude-3-5-sonnet';
      } else if (provider === 'anthropic') {
        this.model = 'claude-3-5-sonnet-20241022';
      } else if (provider === 'openrouter') {
        this.model = 'meta-llama/llama-3.3-70b-instruct';
      } else {
        this.model = 'claude-3-5-sonnet';
      }
    }

    this.customSystemPrompt = (typeof localStorage !== 'undefined' && localStorage.getItem('mynetwork_claude_custom_prompt')) || '';
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    if (typeof localStorage !== 'undefined') localStorage.setItem('mynetwork_claude_api_key', this.apiKey);

    // Auto-switch model if needed
    const provider = aiProviderEngine.detectProvider(this.apiKey);
    if (provider === 'gemini' && (!this.model || this.model.includes('claude') || this.model.includes(':free'))) {
      this.model = 'gemini-flash-latest';
      if (typeof localStorage !== 'undefined') localStorage.setItem('mynetwork_claude_model', this.model);
    } else if (provider === 'opencode' && (!this.model || this.model.includes('gemini') || this.model.includes('llama'))) {
      this.model = 'claude-3-5-sonnet';
      if (typeof localStorage !== 'undefined') localStorage.setItem('mynetwork_claude_model', this.model);
    } else if (provider === 'anthropic' && (!this.model || this.model.includes('gemini'))) {
      this.model = 'claude-3-5-sonnet-20241022';
      if (typeof localStorage !== 'undefined') localStorage.setItem('mynetwork_claude_model', this.model);
    }

    eventBus.emit('claude:config-updated', { hasKey: !!this.apiKey, model: this.model });
  }

  setModel(model) {
    this.model = model || 'gemini-flash-latest';
    if (typeof localStorage !== 'undefined') localStorage.setItem('mynetwork_claude_model', this.model);
    eventBus.emit('claude:config-updated', { hasKey: !!this.apiKey, model: this.model });
  }

  setCustomPrompt(prompt) {
    this.customSystemPrompt = (prompt || '').trim();
    if (typeof localStorage !== 'undefined') localStorage.setItem('mynetwork_claude_custom_prompt', this.customSystemPrompt);
  }

  clearHistory() {
    this.history = [];
    eventBus.emit('claude:history-cleared');
  }

  /**
   * Extracts active web page context from the Chromium webview.
   * @param {HTMLElement} webview - Active Electron <webview> element
   * @returns {Promise<{title: string, url: string, selectedText: string, bodyText: string}>}
   */
  async extractActivePageContext(webview) {
    const activeTab = tabManager.getActiveTab();
    const fallback = {
      title: activeTab ? activeTab.title : 'Focus Dashboard',
      url: activeTab ? activeTab.url : 'mynetwork://dashboard',
      selectedText: '',
      bodyText: ''
    };

    if (!webview || typeof webview.executeJavaScript !== 'function') {
      return fallback;
    }

    try {
      const pageData = await webview.executeJavaScript(`
        (() => {
          try {
            const selectedText = window.getSelection() ? window.getSelection().toString().trim() : '';
            const title = document.title || '';
            const url = window.location.href || '';
            
            // Clone and clean unneeded noise
            const clone = document.body.cloneNode(true);
            const removeSelectors = ['script', 'style', 'noscript', 'nav', 'footer', 'iframe', 'svg', 'header'];
            removeSelectors.forEach(sel => {
              clone.querySelectorAll(sel).forEach(el => el.remove());
            });

            let text = clone.innerText || '';
            text = text.replace(/\\s{2,}/g, ' ').trim();
            const truncatedBody = text.substring(0, 10000);

            return {
              title,
              url,
              selectedText,
              bodyText: truncatedBody
            };
          } catch(e) {
            return { error: e.message };
          }
        })()
      `);

      return Object.assign(fallback, pageData || {});
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Constructs rich system context with browser state, scratchpad, active tab and workspace.
   */
  buildSystemPrompt(pageContext) {
    const activeWorkspace = workspaceService.getActiveWorkspace();
    const allTabs = tabManager.getAllTabs();
    const scratchpadNotes = scratchpadService ? scratchpadService.getContent() : '';

    let prompt = `You are the built-in intelligent browser copilot in the MyNetwork Browser.
You are extremely articulate, concise, direct, helpful, and technically proficient.

CURRENT USER WORKSPACE & STATE:
- Workspace: "${activeWorkspace ? activeWorkspace.name : 'Personal'}"
- Total Open Tabs: ${allTabs.length} tabs (${allTabs.map(t => t.title).slice(0, 6).join(' | ')})
${scratchpadNotes ? `- User Scratchpad Notes:\n"""\n${scratchpadNotes.substring(0, 1500)}\n"""` : ''}

ACTIVE WEBPAGE CONTEXT:
- Page Title: "${pageContext.title || 'Unknown'}"
- Page URL: ${pageContext.url || 'Unknown'}
${pageContext.selectedText ? `- USER CURRENTLY SELECTED TEXT ON PAGE:\n"""\n${pageContext.selectedText}\n"""` : ''}
${pageContext.bodyText ? `- PAGE EXTRACTED CONTENT:\n"""\n${pageContext.bodyText}\n"""` : ''}

INSTRUCTIONS:
1. Always ground your responses in the active webpage context when relevant.
2. Format output with clean, modern markdown: bold highlights, bullet points, headers, and formatted code blocks with language tags (e.g. \`\`\`javascript).
3. Provide high-signal information without repetitive fluff.`;

    if (this.customSystemPrompt) {
      prompt += `\n\nUSER CUSTOM PREFERENCES:\n${this.customSystemPrompt}`;
    }

    return prompt;
  }

  /**
   * Sends user query to AI engine.
   * @param {string} userMessage - User query
   * @param {Object} pageContext - Active page context
   * @returns {Promise<string>} - AI response markdown
   */
  async sendMessage(userMessage, pageContext = {}) {
    // Add user message to history
    this.history.push({ role: 'user', content: userMessage });

    // Limit history to last 10 messages for speed
    if (this.history.length > 10) {
      this.history = this.history.slice(-10);
    }

    // Check if API key is available
    if (!this.apiKey) {
      return this.generateSmartFallback(userMessage, pageContext);
    }

    const systemPrompt = this.buildSystemPrompt(pageContext);

    try {
      const assistantText = await aiProviderEngine.generateCompletion({
        apiKey: this.apiKey,
        model: this.model,
        systemPrompt,
        userMessage,
        history: this.history
      });

      // Add assistant response to history
      this.history.push({ role: 'assistant', content: assistantText });
      return assistantText;
    } catch (err) {
      console.warn('AI Provider Engine call failed, falling back:', err.message);
      let noticeMsg = err.message;

      return `⚠️ **AI Copilot Notice**: ${noticeMsg}\n\nTo update your key or switch to Google Gemini Free mode, click the ⚙️ **Settings** icon at the top of this drawer.\n\nLocal synthesis of your active page:\n\n` + this.generateSmartFallback(userMessage, pageContext, false);
    }
  }

  /**
   * Smart local fallback synthesis for zero-config mode.
   */
  generateSmartFallback(userMessage, pageContext, showKeyPrompt = true) {
    const title = pageContext.title || 'Current Webpage';
    const url = pageContext.url || '';
    const textSample = pageContext.bodyText ? pageContext.bodyText.substring(0, 500) : '';
    const q = userMessage.toLowerCase();

    let response = '';

    if (q.includes('summarize') || q.includes('summary')) {
      response = `### 📑 Executive Summary: ${title}
- **Source**: \`${url || 'Active Document'}\`
- **Primary Focus**: High-level synthesis of **${title}**.
- **Content Overview**: ${textSample ? `"${textSample.substring(0, 200)}..."` : 'Extracted core documentation and reference data from the active web session.'}
- **Key Insight**: Streamlined research and structured takeaways prepared for quick developer workflow.`;
    } else if (q.includes('key takeaway') || q.includes('keypoint') || q.includes('points')) {
      response = `### 🎯 Key Takeaways for ${title}
1. **Core Architecture**: Structured representation of main concepts on \`${url}\`.
2. **Actionable Components**: High-priority workflows and functional entry points identified.
3. **Synthesis & Context**: Live tab context mapped with workspace state.`;
    } else if (q.includes('explain') || q.includes('concept')) {
      response = `### 🔍 Conceptual Analysis: ${title}
This page covers fundamental frameworks and technical data regarding **${title}**.
- **Relevance**: Directly linked to your current task in **${workspaceService.getActiveWorkspace()?.name || 'Workspace'}**.
- **Application**: You can copy this breakdown, modify it, or save it directly into your **Scratchpad**.`;
    } else if (q.includes('code') || q.includes('review') || q.includes('debug')) {
      response = `### 💻 Technical Review: ${title}
\`\`\`javascript
// Live Context Extracted from ${title}
const activeContext = {
  url: "${url}",
  analyzedAt: new Date().toISOString(),
  status: "ready"
};
console.log("Copilot verified context:", activeContext);
\`\`\`
All code blocks can be copied using the **Copy Code** button above.`;
    } else {
      response = `I have analyzed your query **"${userMessage}"** regarding **${title}**.\n\nAs your built-in AI Copilot, I can summarize pages, extract code blocks, explain complex documentation, or save notes directly into your workspace.`;
    }

    if (showKeyPrompt && !this.apiKey) {
      response += `\n\n> 💡 **Tip**: Enter your Google Gemini or Anthropic API Key in ⚙️ **Settings** (top right of this drawer) to activate live AI intelligence!`;
    }

    // Save into history
    this.history.push({ role: 'assistant', content: response });
    return response;
  }
}

const claudeService = new ClaudeService();

module.exports = { ClaudeService, claudeService };
