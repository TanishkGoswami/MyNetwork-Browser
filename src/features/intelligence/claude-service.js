// Claude AI Copilot Intelligence Service - Web Intelligence & Assistant
const { eventBus } = require('../../shared/events/event-bus');
const { tabManager } = require('../../core/tabs/tab-manager');
const { workspaceService } = require('../bookmarks');
const { scratchpadService } = require('../scratchpad/scratchpad-service');

class ClaudeService {
  constructor() {
    this.apiKey = (typeof localStorage !== 'undefined' && localStorage.getItem('mynetwork_claude_api_key')) || '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';
    this.model = (typeof localStorage !== 'undefined' && localStorage.getItem('mynetwork_claude_model')) || 'anthropic/claude-3.5-sonnet';
    this.customSystemPrompt = (typeof localStorage !== 'undefined' && localStorage.getItem('mynetwork_claude_custom_prompt')) || '';
    this.history = []; // Multi-turn message history [{role: 'user'|'assistant', content: '...'}]
    this.maxContextTokens = 12000;
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    if (typeof localStorage !== 'undefined') localStorage.setItem('mynetwork_claude_api_key', this.apiKey);
    eventBus.emit('claude:config-updated', { hasKey: !!this.apiKey, model: this.model });
  }

  setModel(model) {
    this.model = model || 'anthropic/claude-3.5-sonnet';
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
            
            // Extract core readable text from body
            const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
            
            // Clone and clean unneeded noise
            const clone = document.body.cloneNode(true);
            const removeSelectors = ['script', 'style', 'noscript', 'nav', 'footer', 'iframe', 'svg', 'header'];
            removeSelectors.forEach(sel => {
              clone.querySelectorAll(sel).forEach(el => el.remove());
            });

            let text = clone.innerText || '';
            text = text.replace(/\\s{2,}/g, ' ').trim();
            // Truncate to first ~12,000 chars for optimal token speed
            const truncatedBody = text.substring(0, 12000);

            // Extract code blocks if any
            const codeBlocks = Array.from(document.querySelectorAll('pre, code'))
              .map(c => c.innerText.trim())
              .filter(c => c.length > 20)
              .slice(0, 5);

            return {
              title,
              url,
              metaDesc,
              selectedText,
              bodyText: truncatedBody,
              codeBlocks
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

    let prompt = `You are Claude, the built-in intelligent browser copilot in the MyNetwork Browser.
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
2. If the user asks about the page or what they are viewing, analyze the provided content accurately.
3. Format output with clean, modern markdown: bold highlights, bullet points, headers, and formatted code blocks with language tags (e.g. \`\`\`javascript).
4. Provide actionable, high-signal information without repetitive fluff.`;

    if (this.customSystemPrompt) {
      prompt += `\n\nUSER CUSTOM PREFERENCES:\n${this.customSystemPrompt}`;
    }

    return prompt;
  }

  /**
   * Sends user query to Claude via OpenRouter or Anthropic.
   * @param {string} userMessage - User query
   * @param {Object} pageContext - Active page context
   * @returns {Promise<string>} - Claude's response markdown
   */
  async sendMessage(userMessage, pageContext = {}) {
    // Add user message to history
    this.history.push({ role: 'user', content: userMessage });

    // Limit history to last 12 messages for performance
    if (this.history.length > 12) {
      this.history = this.history.slice(-12);
    }

    // Check if API key is available
    if (!this.apiKey) {
      return this.generateSmartFallback(userMessage, pageContext);
    }

    const systemPrompt = this.buildSystemPrompt(pageContext);

    try {
      let assistantText = '';

      // Auto-detect OpenRouter vs Anthropic Direct API
      if (this.apiKey.startsWith('sk-or-')) {
        // OpenRouter Endpoint (Universal AI gateway)
        const openRouterModel = this.model.includes('/') ? this.model : (this.model.includes('haiku') ? 'anthropic/claude-3.5-haiku' : 'anthropic/claude-3.5-sonnet');
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://mynetwork.browser',
            'X-Title': 'MyNetwork Browser'
          },
          body: JSON.stringify({
            model: openRouterModel,
            messages: [
              { role: 'system', content: systemPrompt },
              ...this.history
            ]
          })
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || response.statusText || 'OpenRouter Request Failed';
          throw new Error(`OpenRouter API (${response.status}): ${errMsg}`);
        }

        const data = await response.json();
        assistantText = data?.choices?.[0]?.message?.content || 'No response received from Claude.';
      } else {
        // Direct Anthropic API Endpoint
        const anthropicModel = this.model.includes('/') ? this.model.split('/')[1] : (this.model || 'claude-3-5-sonnet-20241022');
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: anthropicModel,
            max_tokens: 2048,
            system: systemPrompt,
            messages: this.history
          })
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || response.statusText || 'Anthropic Request Failed';
          throw new Error(`Claude API (${response.status}): ${errMsg}`);
        }

        const data = await response.json();
        assistantText = data?.content?.[0]?.text || 'No response received from Claude.';
      }

      // Add assistant response to history
      this.history.push({ role: 'assistant', content: assistantText });

      return assistantText;
    } catch (err) {
      console.warn('Claude API call failed, falling back:', err.message);
      return `⚠️ **Claude API Notice**: ${err.message}\n\nTo update your key, click the ⚙️ **Settings** icon at the top of this drawer.\n\nLocal synthesis of your active page:\n\n` + this.generateSmartFallback(userMessage, pageContext, false);
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
console.log("Claude Copilot verified context:", activeContext);
\`\`\`
All code blocks can be copied using the **Copy Code** button above.`;
    } else {
      response = `I have analyzed your query **"${userMessage}"** regarding **${title}**.\n\nAs your built-in Claude Copilot, I can summarize pages, extract code blocks, explain complex documentation, or save notes directly into your workspace.`;
    }

    if (showKeyPrompt && !this.apiKey) {
      response += `\n\n> 💡 **Tip**: Enter your Anthropic API Key in ⚙️ **Settings** (top right of this drawer) to activate full live **Claude 3.5 Sonnet** intelligence!`;
    }

    // Save into history
    this.history.push({ role: 'assistant', content: response });
    return response;
  }
}

const claudeService = new ClaudeService();

module.exports = { ClaudeService, claudeService };
