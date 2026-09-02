// MyNetwork Browser - Frontend Renderer Process (Pure Light Mode)
const { ipcRenderer } = require('electron');

class MyNetworkBrowser {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
    this.isSplitView = false;
    this.isAiOpen = false;

    // Search Engines Configuration
    this.searchEngines = {
      google: {
        name: 'Google',
        url: 'https://www.google.com/search?q=',
        placeholder: 'Search Google or type a URL...',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>'
      },
      duckduckgo: {
        name: 'DuckDuckGo',
        url: 'https://duckduckgo.com/?q=',
        placeholder: 'Search DuckDuckGo or type a URL...',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#de5833" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>'
      },
      youtube: {
        name: 'YouTube',
        url: 'https://www.youtube.com/results?search_query=',
        placeholder: 'Search YouTube videos...',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#ff0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>'
      },
      github: {
        name: 'GitHub',
        url: 'https://github.com/search?q=',
        placeholder: 'Search GitHub repositories & code...',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="#24292f"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>'
      },
      wikipedia: {
        name: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Special:Search?search=',
        placeholder: 'Search Wikipedia articles...',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>'
      }
    };
    this.currentEngine = 'google';

    // Focus Timer State
    this.timerSeconds = 25 * 60;
    this.timerInterval = null;
    this.timerMode = 'focus'; // 'focus' | 'break'

    // DOM Elements Cache
    this.dom = {
      sidebar: document.getElementById('sidebar'),
      tabsList: document.getElementById('tabs-list'),
      urlInput: document.getElementById('url-input'),
      omniboxEngineIcon: document.getElementById('omnibox-engine-icon'),
      webviewContainer: document.getElementById('webview-container'),
      newTabView: document.getElementById('new-tab-view'),
      progressBar: document.getElementById('load-progress'),
      aiDrawer: document.getElementById('ai-drawer'),
      aiMessages: document.getElementById('ai-messages-container'),
      aiInput: document.getElementById('ai-user-input'),
      sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
      btnAddTab: document.getElementById('btn-add-tab'),
      
      // Dashboard Elements
      liveTime: document.getElementById('live-time-display'),
      liveDate: document.getElementById('live-date-display'),
      greetingText: document.getElementById('greeting-text'),
      dashSearchInput: document.getElementById('dash-search-input'),
      shortcutsGrid: document.getElementById('shortcuts-grid'),
      scratchpadTextarea: document.getElementById('scratchpad-textarea'),
      scratchpadCharCount: document.getElementById('scratchpad-char-count'),
      btnClearScratchpad: document.getElementById('btn-clear-scratchpad'),
      tasksInputForm: document.getElementById('tasks-input-form'),
      taskInputField: document.getElementById('task-input-field'),
      tasksListContainer: document.getElementById('tasks-list-container'),
      tasksCountBadge: document.getElementById('tasks-count-badge'),
      timerDigits: document.getElementById('timer-digits-display'),
      btnTimerToggle: document.getElementById('btn-timer-toggle'),
      btnTimerReset: document.getElementById('btn-timer-reset'),
      timerModeFocus: document.getElementById('timer-mode-focus'),
      timerModeBreak: document.getElementById('timer-mode-break'),
      recentLinksList: document.getElementById('recent-links-list'),
      btnClearRecent: document.getElementById('btn-clear-recent'),
      modalAddShortcut: document.getElementById('modal-add-shortcut'),
      formAddShortcut: document.getElementById('form-add-shortcut'),
      btnCloseShortcutModal: document.getElementById('btn-close-shortcut-modal'),
      btnCancelShortcut: document.getElementById('btn-cancel-shortcut'),
    };

    this.init();
  }

  init() {
    this.bindEvents();
    this.initDashboardWidgets();

    // Open dedicated New Tab Dashboard by default on launch
    this.createTab('zen://newtab', 'New Tab');
  }

  /* ==========================================================================
     EVENT BINDINGS
     ========================================================================== */
  bindEvents() {
    // Navigation controls
    document.getElementById('btn-back').addEventListener('click', () => this.navigateBack());
    document.getElementById('btn-forward').addEventListener('click', () => this.navigateForward());
    document.getElementById('btn-reload').addEventListener('click', () => this.reload());

    // Sidebar Collapse / Expand Toggle
    this.dom.sidebarToggleBtn.addEventListener('click', () => this.toggleSidebarRail());

    // Add Tab Button
    this.dom.btnAddTab.addEventListener('click', () => this.createTab('zen://newtab', 'New Tab'));

    // Omnibox Navigation
    this.dom.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.navigateTo(this.dom.urlInput.value);
      }
    });

    // Dashboard Search Input
    if (this.dom.dashSearchInput) {
      this.dom.dashSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.navigateTo(this.dom.dashSearchInput.value);
        }
      });
    }

    // Search Engine Switcher Chips
    document.querySelectorAll('.engine-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const engine = chip.getAttribute('data-engine');
        this.setSearchEngine(engine);
      });
    });

    // Dashboard AI Mode button
    const dashAiBtn = document.getElementById('dash-ai-btn');
    if (dashAiBtn) {
      dashAiBtn.addEventListener('click', () => {
        this.openAiDrawer("How can Gemini assist your research today?");
      });
    }

    // Split View Toggle
    const splitBtn = document.getElementById('btn-split-toggle');
    if (splitBtn) {
      splitBtn.addEventListener('click', () => this.toggleSplitView());
    }

    // AI Assistant Drawer Toggles
    document.getElementById('btn-toggle-ai').addEventListener('click', () => this.toggleAiDrawer());
    document.getElementById('btn-close-ai').addEventListener('click', () => this.closeAiDrawer());

    // AI Chat Submission
    document.getElementById('btn-send-ai').addEventListener('click', () => this.handleAiSubmit());
    this.dom.aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAiSubmit();
    });

    // AI Quick action chips
    document.querySelectorAll('.ai-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.getAttribute('data-action');
        this.handleAiQuickAction(action);
      });
    });

    // Window Controls (IPC)
    document.getElementById('btn-win-min').addEventListener('click', () => ipcRenderer.send('window-minimize'));
    document.getElementById('btn-win-max').addEventListener('click', () => ipcRenderer.send('window-maximize-toggle'));
    document.getElementById('btn-win-close').addEventListener('click', () => ipcRenderer.send('window-close'));

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        this.createTab('zen://newtab', 'New Tab');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (this.activeTabId) this.closeTab(this.activeTabId);
      } else if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        this.reload();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        this.dom.urlInput.focus();
        this.dom.urlInput.select();
      } else if (e.ctrlKey && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        this.toggleSidebarRail();
      }
    });
  }

  /* ==========================================================================
     DASHBOARD WIDGETS & TOOLS INITIALIZATION
     ========================================================================== */
  initDashboardWidgets() {
    this.initClockAndGreeting();
    this.initScratchpad();
    this.initTasksList();
    this.initFocusTimer();
    this.renderRecentLinks();
  }

  // 1. Live Clock & Dynamic Greeting
  initClockAndGreeting() {
    const updateTime = () => {
      const now = new Date();
      if (this.dom.liveTime) {
        this.dom.liveTime.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (this.dom.liveDate) {
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        this.dom.liveDate.textContent = now.toLocaleDateString(undefined, options);
      }
      if (this.dom.greetingText) {
        const hour = now.getHours();
        let greeting = 'Welcome back to MyNetwork';
        if (hour >= 5 && hour < 12) greeting = 'Good morning, Explorer';
        else if (hour >= 12 && hour < 17) greeting = 'Good afternoon, Explorer';
        else if (hour >= 17 && hour < 22) greeting = 'Good evening, Explorer';
        this.dom.greetingText.textContent = greeting;
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  // 2. Search Engine Switcher
  setSearchEngine(engineKey) {
    if (!this.searchEngines[engineKey]) return;
    this.currentEngine = engineKey;
    const engine = this.searchEngines[engineKey];

    document.querySelectorAll('.engine-chip').forEach(chip => {
      if (chip.getAttribute('data-engine') === engineKey) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    if (this.dom.dashSearchInput) {
      this.dom.dashSearchInput.placeholder = engine.placeholder;
    }
    if (this.dom.omniboxEngineIcon) {
      this.dom.omniboxEngineIcon.innerHTML = engine.icon;
    }
  }

  // 3. Quick Scratchpad Widget
  initScratchpad() {
    const savedNotes = localStorage.getItem('zen_scratchpad') || '';
    if (this.dom.scratchpadTextarea) {
      this.dom.scratchpadTextarea.value = savedNotes;
      this.updateScratchpadCount(savedNotes);

      this.dom.scratchpadTextarea.addEventListener('input', (e) => {
        const text = e.target.value;
        localStorage.setItem('zen_scratchpad', text);
        this.updateScratchpadCount(text);
      });
    }

    if (this.dom.btnClearScratchpad) {
      this.dom.btnClearScratchpad.addEventListener('click', () => {
        this.dom.scratchpadTextarea.value = '';
        localStorage.removeItem('zen_scratchpad');
        this.updateScratchpadCount('');
      });
    }
  }

  updateScratchpadCount(text) {
    if (this.dom.scratchpadCharCount) {
      this.dom.scratchpadCharCount.textContent = `${text.length} characters`;
    }
  }

  // 4. Daily Focus Tasks Widget
  initTasksList() {
    this.tasks = JSON.parse(localStorage.getItem('zen_tasks') || '[]');
    this.renderTasks();

    if (this.dom.tasksInputForm) {
      this.dom.tasksInputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.dom.taskInputField.value.trim();
        if (!text) return;

        this.tasks.push({ id: Date.now(), text: text, done: false });
        localStorage.setItem('zen_tasks', JSON.stringify(this.tasks));
        this.dom.taskInputField.value = '';
        this.renderTasks();
      });
    }
  }

  renderTasks() {
    if (!this.dom.tasksListContainer) return;
    this.dom.tasksListContainer.innerHTML = '';

    const completedCount = this.tasks.filter(t => t.done).length;
    if (this.dom.tasksCountBadge) {
      this.dom.tasksCountBadge.textContent = `${completedCount}/${this.tasks.length} done`;
    }

    if (this.tasks.length === 0) {
      this.dom.tasksListContainer.innerHTML = `<div style="text-align:center; padding: 12px; color: #94a3b8; font-size:11px;">No tasks yet. Add one above!</div>`;
      return;
    }

    this.tasks.forEach(task => {
      const taskEl = document.createElement('div');
      taskEl.className = `task-item ${task.done ? 'completed' : ''}`;
      taskEl.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''}>
        <span class="task-text">${task.text}</span>
        <button class="task-del-btn" title="Delete Task">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      taskEl.querySelector('.task-checkbox').addEventListener('change', (e) => {
        task.done = e.target.checked;
        localStorage.setItem('zen_tasks', JSON.stringify(this.tasks));
        this.renderTasks();
      });

      taskEl.querySelector('.task-del-btn').addEventListener('click', () => {
        this.tasks = this.tasks.filter(t => t.id !== task.id);
        localStorage.setItem('zen_tasks', JSON.stringify(this.tasks));
        this.renderTasks();
      });

      this.dom.tasksListContainer.appendChild(taskEl);
    });
  }

  // 5. Focus & Pomodoro Timer Widget
  initFocusTimer() {
    this.updateTimerDisplay();

    if (this.dom.btnTimerToggle) {
      this.dom.btnTimerToggle.addEventListener('click', () => this.toggleTimer());
    }

    if (this.dom.btnTimerReset) {
      this.dom.btnTimerReset.addEventListener('click', () => this.resetTimer());
    }

    if (this.dom.timerModeFocus) {
      this.dom.timerModeFocus.addEventListener('click', () => {
        this.setTimerMode('focus', 25 * 60);
      });
    }

    if (this.dom.timerModeBreak) {
      this.dom.timerModeBreak.addEventListener('click', () => {
        this.setTimerMode('break', 5 * 60);
      });
    }
  }

  setTimerMode(mode, durationSeconds) {
    this.timerMode = mode;
    this.timerSeconds = durationSeconds;
    this.resetTimer();

    if (mode === 'focus') {
      this.dom.timerModeFocus.classList.add('active');
      this.dom.timerModeBreak.classList.remove('active');
    } else {
      this.dom.timerModeBreak.classList.add('active');
      this.dom.timerModeFocus.classList.remove('active');
    }
  }

  toggleTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
      this.dom.btnTimerToggle.textContent = 'Resume';
    } else {
      this.dom.btnTimerToggle.textContent = 'Pause';
      this.timerInterval = setInterval(() => {
        if (this.timerSeconds > 0) {
          this.timerSeconds--;
          this.updateTimerDisplay();
        } else {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
          this.dom.btnTimerToggle.textContent = 'Done!';
        }
      }, 1000);
    }
  }

  resetTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerSeconds = this.timerMode === 'focus' ? 25 * 60 : 5 * 60;
    this.dom.btnTimerToggle.textContent = this.timerMode === 'focus' ? 'Start Focus' : 'Start Break';
    this.updateTimerDisplay();
  }

  updateTimerDisplay() {
    if (!this.dom.timerDigits) return;
    const mins = Math.floor(this.timerSeconds / 60);
    const secs = this.timerSeconds % 60;
    this.dom.timerDigits.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // 6. Recently Visited Tracker
  addRecentRecord(title, url) {
    if (!url || url.startsWith('zen://') || url === 'about:blank') return;
    const recents = JSON.parse(localStorage.getItem('zen_recents') || '[]');
    const filtered = recents.filter(r => r.url !== url);
    filtered.unshift({
      title: title || url,
      url: url,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (filtered.length > 8) filtered.pop();
    localStorage.setItem('zen_recents', JSON.stringify(filtered));
    this.renderRecentLinks();
  }

  renderRecentLinks() {
    if (!this.dom.recentLinksList) return;
    this.dom.recentLinksList.innerHTML = '';
    const recents = JSON.parse(localStorage.getItem('zen_recents') || '[]');

    if (recents.length === 0) {
      this.dom.recentLinksList.innerHTML = `<div style="text-align:center; padding: 12px; color: #94a3b8; font-size:11px;">No recently visited pages yet</div>`;
      return;
    }

    recents.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'recent-item';
      itemEl.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span class="recent-item-title">${item.title}</span>
        <span class="recent-item-time">${item.time}</span>
      `;
      itemEl.addEventListener('click', () => {
        this.navigateTo(item.url);
      });
      this.dom.recentLinksList.appendChild(itemEl);
    });

    if (this.dom.btnClearRecent) {
      this.dom.btnClearRecent.onclick = () => {
        localStorage.removeItem('zen_recents');
        this.renderRecentLinks();
      };
    }
  }

  /* ==========================================================================
     SIDEBAR RAIL / COMPACT TOGGLE
     ========================================================================== */
  toggleSidebarRail() {
    this.dom.sidebar.classList.toggle('compact');
  }

  /* ==========================================================================
     TAB ENGINE
     ========================================================================== */
  createTab(url = 'zen://newtab', title = 'New Tab', favicon = null) {
    const tabId = 'tab-' + Date.now();

    const webview = document.createElement('webview');
    webview.id = `webview-${tabId}`;
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('autosize', 'on');

    const tabData = {
      id: tabId,
      url: url,
      title: title,
      favicon: favicon,
      webview: webview
    };

    this.tabs.push(tabData);
    this.dom.webviewContainer.appendChild(webview);

    this.setupWebviewEvents(tabData);

    if (url === 'zen://newtab' || url === 'about:blank') {
      webview.src = 'about:blank';
    } else {
      webview.src = url;
    }

    this.renderTabs();
    this.switchTab(tabId);
    return tabId;
  }

  setupWebviewEvents(tabData) {
    const { webview, id } = tabData;

    webview.addEventListener('did-start-loading', () => {
      if (id === this.activeTabId) {
        this.showProgress(35);
      }
    });

    webview.addEventListener('did-stop-loading', () => {
      if (id === this.activeTabId) {
        this.showProgress(100);
        setTimeout(() => this.hideProgress(), 250);

        try {
          const currentUrl = webview.getURL();
          if (currentUrl && currentUrl !== 'about:blank') {
            tabData.url = currentUrl;
            this.dom.urlInput.value = currentUrl;
            this.addRecentRecord(tabData.title || currentUrl, currentUrl);
          }
        } catch (err) {}
      }
    });

    webview.addEventListener('page-title-updated', (e) => {
      tabData.title = e.title || 'Untitled';
      this.updateTabUI(tabData);
    });

    webview.addEventListener('page-favicon-updated', (e) => {
      if (e.favicons && e.favicons.length > 0) {
        tabData.favicon = e.favicons[0];
        this.updateTabUI(tabData);
      }
    });
  }

  renderTabs() {
    this.dom.tabsList.innerHTML = '';

    this.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${tab.id === this.activeTabId ? 'active' : ''}`;
      tabEl.id = `ui-${tab.id}`;

      // Clean SVG Favicon Fallback (Zero Emojis!)
      let faviconHtml = `
        <span class="tab-favicon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </span>
      `;

      if (tab.favicon && typeof tab.favicon === 'string' && tab.favicon.startsWith('http')) {
        faviconHtml = `<span class="tab-favicon"><img src="${tab.favicon}" onerror="this.parentElement.innerHTML='<svg width=\\'15\\' height=\\'15\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/></svg>'"></span>`;
      }

      tabEl.innerHTML = `
        ${faviconHtml}
        <span class="tab-title" title="${tab.title}">${tab.title}</span>
        <button class="tab-close-btn" title="Close Tab">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      tabEl.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-close-btn')) {
          this.switchTab(tab.id);
        }
      });

      tabEl.querySelector('.tab-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });

      this.dom.tabsList.appendChild(tabEl);
    });
  }

  updateTabUI(tabData) {
    const tabEl = document.getElementById(`ui-${tabData.id}`);
    if (tabEl) {
      const titleEl = tabEl.querySelector('.tab-title');
      if (titleEl) {
        titleEl.textContent = tabData.title;
        titleEl.title = tabData.title;
      }

      const faviconContainer = tabEl.querySelector('.tab-favicon');
      if (faviconContainer && tabData.favicon && tabData.favicon.startsWith('http')) {
        faviconContainer.innerHTML = `<img src="${tabData.favicon}" onerror="this.parentElement.innerHTML='<svg width=\\'15\\' height=\\'15\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/></svg>'">`;
      }
    }
  }

  switchTab(tabId) {
    this.activeTabId = tabId;
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(`ui-${tabId}`);
    if (activeEl) activeEl.classList.add('active');

    if (tab.url === 'zen://newtab' || tab.url === 'about:blank') {
      this.dom.newTabView.style.display = 'flex';
      this.tabs.forEach(t => t.webview.classList.remove('active'));
      this.dom.urlInput.value = '';
      this.dom.urlInput.placeholder = this.searchEngines[this.currentEngine].placeholder;
    } else {
      this.dom.newTabView.style.display = 'none';
      if (!this.isSplitView) {
        this.tabs.forEach(t => {
          if (t.id === tabId) {
            t.webview.classList.add('active');
          } else {
            t.webview.classList.remove('active');
          }
        });
      }
      this.dom.urlInput.value = tab.url;
    }
  }

  closeTab(tabId) {
    const tabIndex = this.tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = this.tabs[tabIndex];
    if (tab.webview) {
      tab.webview.remove();
    }

    this.tabs.splice(tabIndex, 1);

    if (this.tabs.length === 0) {
      this.createTab('zen://newtab', 'New Tab');
    } else if (this.activeTabId === tabId) {
      const nextTab = this.tabs[Math.max(0, tabIndex - 1)];
      this.switchTab(nextTab.id);
    }

    this.renderTabs();
  }

  /* ==========================================================================
     NAVIGATION & OMNIBOX
     ========================================================================== */
  navigateTo(query) {
    if (!query || !query.trim()) return;
    query = query.trim();

    let targetUrl = query;
    if (query === 'zen://newtab' || query === 'about:blank') {
      targetUrl = 'zen://newtab';
    } else if (!query.startsWith('http://') && !query.startsWith('https://')) {
      if (query.includes('.') && !query.includes(' ')) {
        targetUrl = 'https://' + query;
      } else {
        const engine = this.searchEngines[this.currentEngine];
        targetUrl = `${engine.url}${encodeURIComponent(query)}`;
      }
    }

    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    if (activeTab) {
      activeTab.url = targetUrl;
      if (targetUrl === 'zen://newtab') {
        activeTab.webview.src = 'about:blank';
        this.dom.newTabView.style.display = 'flex';
        activeTab.webview.classList.remove('active');
        this.dom.urlInput.value = '';
      } else {
        activeTab.webview.src = targetUrl;
        this.dom.newTabView.style.display = 'none';
        activeTab.webview.classList.add('active');
        this.dom.urlInput.value = targetUrl;
      }
    }
  }

  navigateBack() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab && tab.webview && tab.webview.canGoBack()) {
      tab.webview.goBack();
    }
  }

  navigateForward() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab && tab.webview && tab.webview.canGoForward()) {
      tab.webview.goForward();
    }
  }

  reload() {
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab && tab.webview) {
      tab.webview.reload();
    }
  }

  /* ==========================================================================
     SPLIT VIEW MODE
     ========================================================================== */
  toggleSplitView() {
    this.isSplitView = !this.isSplitView;

    if (this.isSplitView) {
      this.dom.webviewContainer.classList.add('split-mode');
      this.dom.newTabView.style.display = 'none';

      if (this.tabs.length < 2) {
        this.createTab('zen://newtab', 'New Tab');
      }

      if (this.tabs[0]) this.tabs[0].webview.classList.add('active');
      if (this.tabs[1]) this.tabs[1].webview.classList.add('active');
    } else {
      this.dom.webviewContainer.classList.remove('split-mode');
      this.switchTab(this.activeTabId);
    }
  }

  /* ==========================================================================
     ASK GEMINI AI ASSISTANT DRAWER
     ========================================================================== */
  toggleAiDrawer() {
    this.isAiOpen = !this.isAiOpen;
    if (this.isAiOpen) {
      this.dom.aiDrawer.classList.add('open');
      this.dom.aiInput.focus();
    } else {
      this.dom.aiDrawer.classList.remove('open');
    }
  }

  openAiDrawer(initialPrompt = null) {
    this.isAiOpen = true;
    this.dom.aiDrawer.classList.add('open');
    if (initialPrompt) {
      this.appendAiMessage('bot', initialPrompt);
    }
    this.dom.aiInput.focus();
  }

  closeAiDrawer() {
    this.isAiOpen = false;
    this.dom.aiDrawer.classList.remove('open');
  }

  handleAiSubmit() {
    const text = this.dom.aiInput.value.trim();
    if (!text) return;

    this.appendAiMessage('user', text);
    this.dom.aiInput.value = '';

    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    const pageTitle = activeTab ? activeTab.title : 'Active page';

    setTimeout(() => {
      let response = `Regarding "${text}" on **${pageTitle}**: Here is a concise overview and breakdown based on the active page context.`;
      this.appendAiMessage('bot', response);
    }, 500);
  }

  handleAiQuickAction(action) {
    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    const title = activeTab ? activeTab.title : 'Current Page';
    const url = activeTab ? activeTab.url : 'zen://newtab';

    if (action === 'summarize') {
      this.appendAiMessage('user', `Summarize "${title}"`);
      setTimeout(() => {
        this.appendAiMessage('bot', `### Summary of ${title}\n- **Core Topic**: Primary analysis of ${url}.\n- **Key Highlights**: Streamlined information synthesis generated by Gemini AI.\n- **Conclusion**: Ready for review and quick actions.`);
      }, 400);
    } else if (action === 'keypoints') {
      this.appendAiMessage('user', `Key Takeaways for "${title}"`);
      setTimeout(() => {
        this.appendAiMessage('bot', `### Key Takeaways:\n1. Structured overview of relevant concepts.\n2. Actionable insights extracted from ${title}.\n3. High-priority focus points for deep analysis.`);
      }, 400);
    } else if (action === 'explain') {
      this.appendAiMessage('user', `Explain concepts on this page`);
      setTimeout(() => {
        this.appendAiMessage('bot', `### Conceptual Breakdown\nThis page covers essential frameworks related to **${title}**. Ask me if you need specific technical or research explanations.`);
      }, 400);
    }
  }

  appendAiMessage(sender, text) {
    const msgEl = document.createElement('div');
    msgEl.className = `ai-msg ${sender}`;
    msgEl.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
    this.dom.aiMessages.appendChild(msgEl);
    this.dom.aiMessages.scrollTop = this.dom.aiMessages.scrollHeight;
  }

  /* ==========================================================================
     PROGRESS BAR
     ========================================================================== */
  showProgress(percentage) {
    this.dom.progressBar.style.opacity = '1';
    this.dom.progressBar.style.width = `${percentage}%`;
  }

  hideProgress() {
    this.dom.progressBar.style.opacity = '0';
    setTimeout(() => {
      this.dom.progressBar.style.width = '0%';
    }, 250);
  }
}

// Instantiate on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.myNetworkBrowser = new MyNetworkBrowser();
});



