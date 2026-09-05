// AI Copilot Drawer & Settings Controller
const { eventBus } = require('../../shared/events/event-bus');
const { tabManager } = require('../../core/tabs/tab-manager');
const { scratchpadService } = require('../scratchpad/scratchpad-service');
const { claudeService } = require('./claude-service');
const { aiProviderEngine } = require('./ai-provider-engine');
const { aiTelemetryService } = require('./ai-telemetry-service');

class AiDrawerController {
  constructor(shell) {
    this.shell = shell;
    this.dom = {};
    this.init();
  }

  init() {
    this.cacheDom();
    this.bindEvents();
    this.updateConfigUi();
    this.updateContextBadge();
    this.updateTokenBadge();
  }

  cacheDom() {
    this.dom = {
      aiDrawer: document.getElementById('ai-drawer'),
      aiMessages: document.getElementById('ai-messages-container'),
      aiInput: document.getElementById('ai-user-input'),
      btnSendAi: document.getElementById('btn-send-ai'),
      btnCloseAi: document.getElementById('btn-close-ai'),
      aiDrawerTokenPill: document.getElementById('ai-drawer-token-pill'),
      btnDrawerOpenAnalytics: document.getElementById('btn-drawer-open-analytics'),
      btnModalOpenAnalytics: document.getElementById('btn-modal-open-analytics'),
      claudeContextBar: document.getElementById('claude-context-bar'),
      claudeContextLabel: document.getElementById('claude-context-label'),
      claudeModelBadge: document.getElementById('claude-model-badge'),
      btnClaudeClear: document.getElementById('btn-claude-clear'),
      btnClaudeSettings: document.getElementById('btn-claude-settings'),
      modalClaudeSettings: document.getElementById('modal-claude-settings'),
      btnCloseClaudeModal: document.getElementById('btn-close-claude-modal'),
      claudeInputApiKey: document.getElementById('claude-input-api-key'),
      btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
      linkGetClaudeKey: document.getElementById('link-get-claude-key'),
      claudeSelectModel: document.getElementById('claude-select-model'),
      claudeInputPrompt: document.getElementById('claude-input-prompt'),
      btnClaudeClearKey: document.getElementById('btn-claude-clear-key'),
      btnClaudeSaveSettings: document.getElementById('btn-claude-save-settings')
    };
  }

  bindEvents() {
    // Open Dedicated Analytics Page
    if (this.dom.btnDrawerOpenAnalytics) {
      this.dom.btnDrawerOpenAnalytics.addEventListener('click', () => {
        this.shell.navigateCurrentTab('mynetwork://ai-analytics');
      });
    }

    if (this.dom.btnModalOpenAnalytics) {
      this.dom.btnModalOpenAnalytics.addEventListener('click', () => {
        if (this.dom.modalClaudeSettings) this.dom.modalClaudeSettings.close();
        this.shell.navigateCurrentTab('mynetwork://ai-analytics');
      });
    }

    // Open Settings Modal
    if (this.dom.btnClaudeSettings) {
      this.dom.btnClaudeSettings.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    // Close Settings Modal
    if (this.dom.btnCloseClaudeModal) {
      this.dom.btnCloseClaudeModal.addEventListener('click', () => {
        if (this.dom.modalClaudeSettings) this.dom.modalClaudeSettings.close();
      });
    }

    // Toggle API Key Visibility
    if (this.dom.btnToggleKeyVisibility) {
      this.dom.btnToggleKeyVisibility.addEventListener('click', () => {
        if (this.dom.claudeInputApiKey) {
          const isPass = this.dom.claudeInputApiKey.type === 'password';
          this.dom.claudeInputApiKey.type = isPass ? 'text' : 'password';
        }
      });
    }

    // Save Settings
    if (this.dom.btnClaudeSaveSettings) {
      this.dom.btnClaudeSaveSettings.addEventListener('click', () => {
        const key = this.dom.claudeInputApiKey ? this.dom.claudeInputApiKey.value.trim() : '';
        const model = this.dom.claudeSelectModel ? this.dom.claudeSelectModel.value : 'gemini-flash-latest';
        const prompt = this.dom.claudeInputPrompt ? this.dom.claudeInputPrompt.value.trim() : '';

        claudeService.setApiKey(key);
        claudeService.setModel(model);
        claudeService.setCustomPrompt(prompt);

        this.updateConfigUi();
        this.shell.showToast('AI Copilot settings saved.');
        if (this.dom.modalClaudeSettings) this.dom.modalClaudeSettings.close();
      });
    }

    // Clear Key
    if (this.dom.btnClaudeClearKey) {
      this.dom.btnClaudeClearKey.addEventListener('click', () => {
        claudeService.setApiKey('');
        if (this.dom.claudeInputApiKey) this.dom.claudeInputApiKey.value = '';
        this.updateConfigUi();
        this.shell.showToast('AI Key cleared.');
      });
    }

    // Clear Conversation History
    if (this.dom.btnClaudeClear) {
      this.dom.btnClaudeClear.addEventListener('click', () => {
        claudeService.clearHistory();
        if (this.dom.aiMessages) {
          this.dom.aiMessages.innerHTML = `
            <div class="ai-msg bot">
              <p>Conversation cleared. Hello! I am your built-in <strong>AI Copilot</strong>. Ask me anything about your active page or workspace!</p>
            </div>
          `;
        }
        this.shell.showToast('Conversation reset.');
      });
    }

    // Send Message
    if (this.dom.btnSendAi) {
      this.dom.btnSendAi.addEventListener('click', () => this.handleAiSubmit());
    }

    if (this.dom.aiInput) {
      this.dom.aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleAiSubmit();
        }
      });
    }

    // Close Drawer
    if (this.dom.btnCloseAi) {
      this.dom.btnCloseAi.addEventListener('click', () => {
        const { browserContext } = require('../../core/context/browser-context');
        browserContext.toggleAiDrawer(false);
      });
    }

    // Quick Action Chips
    document.querySelectorAll('.ai-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.getAttribute('data-action');
        if (action) this.handleQuickAction(action);
      });
    });

    // Event Bus updates
    eventBus.on('claude:config-updated', () => this.updateConfigUi());
    eventBus.on('tabs:activated', () => this.updateContextBadge());
    eventBus.on('tab:loaded', () => this.updateContextBadge());
    eventBus.on('ai:telemetry-updated', () => this.updateTokenBadge());
  }

  updateTokenBadge() {
    if (this.dom.aiDrawerTokenPill) {
      const stats = aiTelemetryService.getSummaryStats('all');
      const count = stats.totalTokens;
      this.dom.aiDrawerTokenPill.textContent = count > 1000 ? `⚡ ${(count / 1000).toFixed(1)}k tk` : `⚡ ${count} tk`;
    }
  }

  openSettingsModal() {
    if (!this.dom.modalClaudeSettings) return;

    if (this.dom.claudeInputApiKey) {
      this.dom.claudeInputApiKey.value = claudeService.apiKey || '';
    }

    if (this.dom.claudeSelectModel) {
      this.dom.claudeSelectModel.value = claudeService.model || 'gemini-flash-latest';
      if (!this.dom.claudeSelectModel.value) {
        this.dom.claudeSelectModel.value = 'gemini-flash-latest';
      }
    }

    if (this.dom.claudeInputPrompt) {
      this.dom.claudeInputPrompt.value = claudeService.customSystemPrompt || '';
    }

    this.dom.modalClaudeSettings.showModal();
  }

  updateConfigUi() {
    if (this.dom.claudeModelBadge) {
      if (claudeService.apiKey) {
        const provider = aiProviderEngine.detectProvider(claudeService.apiKey);
        let name = 'AI Active';
        if (provider === 'gemini') name = 'Gemini 2.0 Flash • Free';
        else if (provider === 'opencode') name = 'OpenCode Zen • Claude 3.5';
        else if (provider === 'anthropic') name = 'Claude 3.5 Sonnet';
        else if (provider === 'openrouter') name = 'OpenRouter AI';
        
        this.dom.claudeModelBadge.textContent = name;
        this.dom.claudeModelBadge.style.color = '#10b981';
      } else {
        this.dom.claudeModelBadge.textContent = 'Local Mode (No Key)';
        this.dom.claudeModelBadge.style.color = '#8e8e93';
      }
    }
  }

  updateContextBadge() {
    const activeTab = tabManager.getActiveTab();
    if (!this.dom.claudeContextLabel) return;

    if (!activeTab || activeTab.url === 'mynetwork://newtab' || activeTab.url.startsWith('mynetwork://')) {
      this.dom.claudeContextLabel.textContent = 'Page Context: Focus Dashboard';
    } else {
      let domain = '';
      try {
        domain = new URL(activeTab.url).hostname.replace(/^www\./, '');
      } catch (e) {
        domain = activeTab.url;
      }
      this.dom.claudeContextLabel.textContent = `Page Context: ${activeTab.title || 'Web Page'} (${domain})`;
    }
  }

  async getActiveWebview() {
    const activeTabId = tabManager.activeTabId;
    if (!activeTabId) return null;
    return this.shell.engineAdapter?.webviewMap?.get(activeTabId) || null;
  }

  async handleAiSubmit() {
    const text = this.dom.aiInput ? this.dom.aiInput.value.trim() : '';
    if (!text) return;

    this.appendMessage('user', text);
    if (this.dom.aiInput) this.dom.aiInput.value = '';

    const typingId = this.showTypingIndicator();

    try {
      const webview = await this.getActiveWebview();
      const pageContext = await claudeService.extractActivePageContext(webview);
      const response = await claudeService.sendMessage(text, pageContext);
      this.removeTypingIndicator(typingId);
      this.appendMessage('bot', response);
    } catch (err) {
      this.removeTypingIndicator(typingId);
      this.appendMessage('bot', `⚠️ Error connecting to AI: ${err.message}`);
    }
  }

  async handleQuickAction(action) {
    const activeTab = tabManager.getActiveTab();
    const title = activeTab ? activeTab.title : 'Current Page';
    const webview = await this.getActiveWebview();
    const pageContext = await claudeService.extractActivePageContext(webview);

    if (action === 'summarize') {
      this.appendMessage('user', `Summarize this page: "${title}"`);
      const typingId = this.showTypingIndicator();
      const res = await claudeService.sendMessage(`Please generate a structured, executive summary of this page (${title}). Include Core Purpose, Key Highlights, and Conclusions.`, pageContext);
      this.removeTypingIndicator(typingId);
      this.appendMessage('bot', res);
    } else if (action === 'keypoints') {
      this.appendMessage('user', `Key Takeaways for "${title}"`);
      const typingId = this.showTypingIndicator();
      const res = await claudeService.sendMessage(`Extract the top 5 most actionable key takeaways, facts, and insights from this webpage (${title}).`, pageContext);
      this.removeTypingIndicator(typingId);
      this.appendMessage('bot', res);
    } else if (action === 'codereview') {
      this.appendMessage('user', `Code Review / Technical Analysis`);
      const typingId = this.showTypingIndicator();
      const res = await claudeService.sendMessage(`Analyze the code blocks and technical architectural concepts on this page (${title}). Explain key logic, highlight optimizations, and provide clean code snippets.`, pageContext);
      this.removeTypingIndicator(typingId);
      this.appendMessage('bot', res);
    } else if (action === 'savetomemo') {
      const lastMsg = claudeService.history.filter(m => m.role === 'assistant').slice(-1)[0];
      const contentToSave = lastMsg ? lastMsg.content : `Note from ${title} (${pageContext.url}):\n${pageContext.bodyText ? pageContext.bodyText.substring(0, 500) : ''}`;
      const currentNotes = scratchpadService.getContent();
      const updatedNotes = currentNotes ? `${currentNotes}\n\n--- AI Notes (${new Date().toLocaleTimeString()}) ---\n${contentToSave}` : `--- AI Notes (${new Date().toLocaleTimeString()}) ---\n${contentToSave}`;
      scratchpadService.save(updatedNotes);
      if (this.shell.dom.scratchpadTextarea) this.shell.dom.scratchpadTextarea.value = updatedNotes;
      this.shell.showToast('Saved notes directly into Dashboard Scratchpad!');
    }
  }

  showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const msgEl = document.createElement('div');
    msgEl.className = 'ai-msg bot';
    msgEl.id = id;
    msgEl.innerHTML = `
      <div class="claude-typing-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    if (this.dom.aiMessages) {
      this.dom.aiMessages.appendChild(msgEl);
      this.dom.aiMessages.scrollTop = this.dom.aiMessages.scrollHeight;
    }
    return id;
  }

  removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  appendMessage(sender, text) {
    if (!this.dom.aiMessages) return;
    const msgEl = document.createElement('div');
    msgEl.className = `ai-msg ${sender}`;

    if (sender === 'user') {
      msgEl.textContent = text;
    } else {
      msgEl.innerHTML = this.formatMarkdown(text);
    }

    this.dom.aiMessages.appendChild(msgEl);
    this.dom.aiMessages.scrollTop = this.dom.aiMessages.scrollHeight;
  }

  formatMarkdown(text) {
    if (!text) return '';
    let html = text;

    // 1. Code blocks with copy button
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const safeCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const encodedCode = encodeURIComponent(code);
      return `
        <div class="code-block-wrapper">
          <div class="code-header">
            <span>${lang || 'code'}</span>
            <button class="copy-code-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodedCode}')); this.innerText = '✓ Copied!'; setTimeout(() => this.innerText = 'Copy Code', 2000);">
              Copy Code
            </button>
          </div>
          <pre><code>${safeCode}</code></pre>
        </div>
      `;
    });

    // 2. Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 3. Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h3>$1</h3>');

    // 4. Bold and Italics
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 5. Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // 6. Bullet lists
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^([0-9]+)\. (.*$)/gim, '<li><strong>$1.</strong> $2</li>');

    // Wrap list items
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // 7. Line breaks
    html = html.replace(/\n\n/g, '<br><br>');

    return html;
  }
}

module.exports = { AiDrawerController };
