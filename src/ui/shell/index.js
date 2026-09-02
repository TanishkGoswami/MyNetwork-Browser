// UI Shell - Main Renderer Controller (Clean Pure Light Mode Architecture)
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS, DEFAULT_NEWTAB_URL, LEGACY_NEWTAB_URL, SETTINGS_URL, LEGACY_SETTINGS_URL, BLANK_URL } = require('../../shared/constants');
const { tabManager } = require('../../core/tabs/tab-manager');
const { browserContext } = require('../../core/browser/browser-context');
const { WebviewAdapter } = require('../../engine/webview/webview-adapter');
const { ipcBridge } = require('../../platform/electron/ipc-bridge');
const { keybindingManager } = require('../../core/shortcuts/keybinding-manager');

// Feature Services
const { scratchpadService } = require('../../features/scratchpad/scratchpad-service');
const { taskService } = require('../../features/tasks/task-service');
const { timerService } = require('../../features/focus-timer/timer-service');
const { historyService } = require('../../features/history/history-service');
const { settingsService } = require('../../infrastructure/config/settings-service');
const { passwordService } = require('../../infrastructure/storage/password-service');
const { sessionService } = require('../../features/session/session-service');

class MyNetworkShell {
  constructor() {
    this.initDomCache();
    this.engineAdapter = new WebviewAdapter(this.dom.webviewContainer);

    this.bindCoreEvents();
    this.bindFeatureEvents();
    this.bindUiInteractions();
    this.initKeybindings();
    this.initSettings();
    this.initPasswordManager();
    this.initTabContextMenu();
    this.initClockAndGreeting();

    // Initial feature data population
    this.renderTasks();
    this.renderRecents();
    this.initScratchpad();
    this.initTimer();
    this.renderPasswordsList();
    this.renderPasswordHealth();

    // Restore Session Tabs or Start with initial tab
    this.restoreSessionOrStart();
  }

  restoreSessionOrStart() {
    const startupBehavior = settingsService.get('startupBehavior', 'restore_session');
    const saved = sessionService.loadSession();

    if (saved && saved.tabs && saved.tabs.length > 0 && startupBehavior !== 'newtab') {
      let activeIndex = 0;
      saved.tabs.forEach((t, i) => {
        const tab = tabManager.createTab(t.url, t.title, t.favicon);
        if (t.isPinned) tabManager.pinTab(tab.id);
        if (t.url === saved.activeTabUrl) activeIndex = i;
      });
      const allTabs = tabManager.getAllTabs();
      if (allTabs[activeIndex]) {
        tabManager.activateTab(allTabs[activeIndex].id);
      }
    } else {
      tabManager.createTab(DEFAULT_NEWTAB_URL, 'New Tab');
    }
  }

  initDomCache() {
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

      // Dashboard elements
      liveTime: document.getElementById('live-time-display'),
      liveDate: document.getElementById('live-date-display'),
      greetingText: document.getElementById('greeting-text'),
      dashSearchInput: document.getElementById('dash-search-input'),

      // Scratchpad
      scratchpadTextarea: document.getElementById('scratchpad-textarea'),
      scratchpadCharCount: document.getElementById('scratchpad-char-count'),
      btnClearScratchpad: document.getElementById('btn-clear-scratchpad'),

      // Tasks
      tasksInputForm: document.getElementById('tasks-input-form'),
      taskInputField: document.getElementById('task-input-field'),
      tasksListContainer: document.getElementById('tasks-list-container'),
      tasksCountBadge: document.getElementById('tasks-count-badge'),

      // Timer
      timerDigits: document.getElementById('timer-digits-display'),
      btnTimerToggle: document.getElementById('btn-timer-toggle'),
      btnTimerReset: document.getElementById('btn-timer-reset'),
      timerModeFocus: document.getElementById('timer-mode-focus'),
      timerModeBreak: document.getElementById('timer-mode-break'),

      // Recents
      recentLinksList: document.getElementById('recent-links-list'),
      btnClearRecents: document.getElementById('btn-clear-recents'),

      // Shortcuts Modal
      modalShortcuts: document.getElementById('modal-shortcuts'),
      shortcutsModalList: document.getElementById('shortcuts-modal-list'),
      btnCloseShortcutsModal: document.getElementById('btn-close-shortcuts-modal'),

      // App 3-Dots Menu
      btnMenu: document.getElementById('btn-menu'),
      appDropdownMenu: document.getElementById('app-dropdown-menu'),

      // Window Controls (macOS Traffic Lights vs Windows 11)
      macTrafficLights: document.getElementById('mac-traffic-lights'),
      winWindowControls: document.getElementById('win-window-controls'),
      btnWinClose: document.getElementById('btn-win-close'),
      btnWinMin: document.getElementById('btn-win-min'),
      btnWinMax: document.getElementById('btn-win-max'),
      btnWinCloseWin: document.getElementById('btn-win-close-win'),
      btnWinMinWin: document.getElementById('btn-win-min-win'),
      btnWinMaxWin: document.getElementById('btn-win-max-win'),

      // Horizontal Tabs
      horizontalTabsBar: document.getElementById('horizontal-tabs-bar'),
      horizontalTabsList: document.getElementById('horizontal-tabs-list'),
      btnAddTabH: document.getElementById('btn-add-tab-h'),

      // Settings View
      settingsView: document.getElementById('settings-view'),
      btnSettingsBack: document.getElementById('btn-settings-back'),
      controlTabLayout: document.getElementById('control-tab-layout'),
      controlWindowStyle: document.getElementById('control-window-style'),
      controlTabDensity: document.getElementById('control-tab-density'),
      settingRestoreSession: document.getElementById('setting-restore-session'),
      settingSearchEngine: document.getElementById('setting-search-engine'),
      settingStartupBehavior: document.getElementById('setting-startup-behavior'),
      settingCompactSidebar: document.getElementById('setting-compact-sidebar'),
      settingTrackingLevel: document.getElementById('setting-tracking-level'),
      settingFocusDuration: document.getElementById('setting-focus-duration'),
      settingBreakDuration: document.getElementById('setting-break-duration'),
      btnSettingsClearHistory: document.getElementById('btn-settings-clear-history'),
      btnSettingsResetAll: document.getElementById('btn-settings-reset-all'),
      btnSettingsOpenShortcuts: document.getElementById('btn-settings-open-shortcuts'),
      settingsHistoryList: document.getElementById('settings-history-list'),
      historySearchInput: document.getElementById('history-search-input'),

      // Password Manager DOM
      btnOpenAddPwdModal: document.getElementById('btn-open-add-pwd-modal'),
      pwdModalDialog: document.getElementById('pwd-modal-dialog'),
      btnClosePwdModal: document.getElementById('btn-close-pwd-modal'),
      btnCancelPwdForm: document.getElementById('btn-cancel-pwd-form'),
      pwdForm: document.getElementById('pwd-form'),
      pwdFormId: document.getElementById('pwd-form-id'),
      pwdFormUrl: document.getElementById('pwd-form-url'),
      pwdFormTitle: document.getElementById('pwd-form-title'),
      pwdFormUsername: document.getElementById('pwd-form-username'),
      pwdFormPassword: document.getElementById('pwd-form-password'),
      pwdFormCategory: document.getElementById('pwd-form-category'),
      pwdFormNotes: document.getElementById('pwd-form-notes'),
      btnPwdGenerate: document.getElementById('btn-pwd-generate'),
      pwdStrengthBar: document.getElementById('pwd-strength-bar'),
      pwdStrengthCaption: document.getElementById('pwd-strength-caption'),
      pwdSearchInput: document.getElementById('pwd-search-input'),
      pwdCategoryFilters: document.getElementById('pwd-category-filters'),
      passwordsListContainer: document.getElementById('passwords-list-container'),
      btnExportPasswords: document.getElementById('btn-export-passwords'),
      btnImportPasswords: document.getElementById('btn-import-passwords'),
      pwdHealthScore: document.getElementById('pwd-health-score'),
      pwdHealthHeadline: document.getElementById('pwd-health-headline'),
      pwdHealthSubline: document.getElementById('pwd-health-subline'),
      pwdHealthBadges: document.getElementById('pwd-health-badges'),

      // Master Security PIN Lock DOM
      btnVaultSecurity: document.getElementById('btn-vault-security'),
      vaultPinModal: document.getElementById('vault-pin-modal'),
      btnClosePinModal: document.getElementById('btn-close-pin-modal'),
      btnCancelPin: document.getElementById('btn-cancel-pin'),
      vaultPinForm: document.getElementById('vault-pin-form'),
      vaultPinInput: document.getElementById('vault-pin-input'),
      vaultPinConfirmInput: document.getElementById('vault-pin-confirm-input'),
      pinConfirmGroup: document.getElementById('pin-confirm-group'),
      pinErrorMsg: document.getElementById('pin-error-msg'),
      btnRemovePin: document.getElementById('btn-remove-pin'),
      btnSubmitPin: document.getElementById('btn-submit-pin'),
      pinModalTitle: document.getElementById('pin-modal-title'),
      pinModalDesc: document.getElementById('pin-modal-desc'),

      // Save Password Floating Prompt
      macSavePwdBanner: document.getElementById('mac-save-pwd-banner'),
      savePwdDomainText: document.getElementById('save-pwd-domain-text'),
      savePwdUserVal: document.getElementById('save-pwd-user-val'),
      savePwdPassVal: document.getElementById('save-pwd-pass-val'),
      btnDismissSavePwd: document.getElementById('btn-dismiss-save-pwd'),
      btnNeverSavePwd: document.getElementById('btn-never-save-pwd'),
      btnConfirmSavePwd: document.getElementById('btn-confirm-save-pwd'),

      // Tab Context Menu
      tabContextMenu: document.getElementById('tab-context-menu'),
      ctxPinTab: document.getElementById('ctx-pin-tab'),
      ctxPinLabel: document.getElementById('ctx-pin-label'),
      ctxDuplicateTab: document.getElementById('ctx-duplicate-tab'),
      ctxReloadTab: document.getElementById('ctx-reload-tab'),
      ctxMuteTab: document.getElementById('ctx-mute-tab'),
      ctxMuteLabel: document.getElementById('ctx-mute-label'),
      ctxCloseTab: document.getElementById('ctx-close-tab'),
      ctxCloseOtherTabs: document.getElementById('ctx-close-other-tabs'),
      ctxCloseTabsRight: document.getElementById('ctx-close-tabs-right')
    };
  }

  /* ==========================================================================
     CORE EVENT BINDINGS
     ========================================================================== */
  bindCoreEvents() {
    // Tab lifecycle
    eventBus.on(EVENTS.TAB_CREATED, ({ tab }) => {
      this.engineAdapter.createWebview(tab);
      this.renderTabPill(tab);
      sessionService.saveSession(tabManager.getAllTabs(), tabManager.activeTabId);
    });

    eventBus.on(EVENTS.TAB_ACTIVATED, ({ tabId, tab }) => {
      this.updateActiveTabUi(tabId, tab);
      sessionService.saveSession(tabManager.getAllTabs(), tabId);
    });

    eventBus.on(EVENTS.TAB_CLOSED, ({ tabId }) => {
      this.engineAdapter.removeWebview(tabId);
      const tabPill = document.getElementById(`tab-pill-${tabId}`);
      if (tabPill && tabPill.parentNode) tabPill.parentNode.removeChild(tabPill);
      const hTabPill = document.getElementById(`h-tab-pill-${tabId}`);
      if (hTabPill && hTabPill.parentNode) hTabPill.parentNode.removeChild(hTabPill);
      sessionService.saveSession(tabManager.getAllTabs(), tabManager.activeTabId);
    });

    eventBus.on(EVENTS.TAB_UPDATED, ({ tabId, updates, tab }) => {
      const fullTab = tab || tabManager.getTab(tabId);
      if (fullTab) this.updateTabPillDisplay(tabId, fullTab);
      const activeTab = tabManager.getActiveTab();
      if (activeTab && activeTab.id === tabId) {
        if (updates && updates.url && updates.url !== DEFAULT_NEWTAB_URL && updates.url !== BLANK_URL && !updates.url.startsWith('mynetwork://')) {
          this.dom.urlInput.value = updates.url;
        }
      }
      sessionService.saveSession(tabManager.getAllTabs(), tabManager.activeTabId);
    });

    // Engine Navigation
    eventBus.on(EVENTS.NAV_START, ({ tabId }) => {
      tabManager.updateTab(tabId, { isLoading: true });
    });

    eventBus.on(EVENTS.NAV_PROGRESS, ({ percentage }) => {
      this.showProgress(percentage);
    });

    eventBus.on(EVENTS.NAV_FINISH, ({ tabId, url, title, favicon }) => {
      this.hideProgress();
    });

    // In-page Login Credentials Submitted Observer
    eventBus.on('security:credential-submitted', ({ tabId, username, password, url }) => {
      this.handleAutoSavePasswordPrompt(username, password, url);
    });

    // In-page Autofill Suggestion Click Handler (Respects Master PIN Lock)
    eventBus.on('security:autofill-requested', ({ tabId, credId, username, url }) => {
      const cred = passwordService.getById(credId);
      if (!cred) return;

      this.ensureVaultUnlocked(() => {
        this.engineAdapter.performAutofill(tabId, cred.username, cred.password);
        this.showToast(`Autofilled account "${cred.username}"`);
      });
    });

    // Context & Mode Toggles
    eventBus.on('context:engine-changed', ({ engineKey, engine }) => {
      document.querySelectorAll('.engine-chip').forEach(chip => {
        if (chip.getAttribute('data-engine') === engineKey) {
          chip.classList.add('active');
        } else {
          chip.classList.remove('active');
        }
      });
      if (this.dom.dashSearchInput) this.dom.dashSearchInput.placeholder = engine.placeholder;
      if (this.dom.omniboxEngineIcon) this.dom.omniboxEngineIcon.innerHTML = engine.icon;
    });

    eventBus.on('ui:sidebar-toggled', ({ isRail }) => {
      if (this.dom.sidebar) {
        this.dom.sidebar.classList.toggle('compact', isRail);
      }
    });

    eventBus.on('ui:splitview-toggled', ({ isSplit }) => {
      const splitBtn = document.getElementById('btn-split-toggle');
      if (splitBtn) splitBtn.classList.toggle('active', isSplit);
      if (this.dom.webviewContainer) {
        this.dom.webviewContainer.classList.toggle('split-mode', isSplit);
      }
    });

    eventBus.on('ui:ai-drawer-toggled', ({ isOpen }) => {
      if (this.dom.aiDrawer) {
        this.dom.aiDrawer.classList.toggle('open', isOpen);
      }
    });
  }

  /* ==========================================================================
     FEATURE EVENT BINDINGS
     ========================================================================== */
  bindFeatureEvents() {
    eventBus.on(EVENTS.TASKS_CHANGED, () => {
      this.renderTasks();
    });

    eventBus.on(EVENTS.SCRATCHPAD_CHANGED, ({ length }) => {
      if (this.dom.scratchpadCharCount) {
        this.dom.scratchpadCharCount.textContent = `${length} characters`;
      }
    });

    eventBus.on(EVENTS.TIMER_TICK, ({ formatted, isRunning }) => {
      if (this.dom.timerDigits) this.dom.timerDigits.textContent = formatted;
      if (this.dom.btnTimerToggle) {
        this.dom.btnTimerToggle.textContent = isRunning ? 'Pause' : 'Start';
      }
    });

    eventBus.on(EVENTS.TIMER_COMPLETED, ({ mode }) => {
      if (this.dom.btnTimerToggle) this.dom.btnTimerToggle.textContent = 'Done!';
    });

    eventBus.on(EVENTS.HISTORY_UPDATED, () => {
      this.renderRecents();
    });
  }

  /* ==========================================================================
     UI INTERACTIONS & LISTENERS
     ========================================================================== */
  bindUiInteractions() {
    // Tab creation
    if (this.dom.btnAddTab) {
      this.dom.btnAddTab.addEventListener('click', () => tabManager.createTab());
    }
    const sidebarAddBtn = document.getElementById('sidebar-rail-add-tab');
    if (sidebarAddBtn) {
      sidebarAddBtn.addEventListener('click', () => tabManager.createTab());
    }

    // Sidebar Rail Toggle
    if (this.dom.sidebarToggleBtn) {
      this.dom.sidebarToggleBtn.addEventListener('click', () => browserContext.toggleSidebarRail());
    }

    // Navigation Controls
    const btnBack = document.getElementById('btn-back') || document.getElementById('btn-nav-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        const active = tabManager.getActiveTab();
        if (active) this.engineAdapter.goBack(active.id);
      });
    }

    const btnForward = document.getElementById('btn-forward') || document.getElementById('btn-nav-forward');
    if (btnForward) {
      btnForward.addEventListener('click', () => {
        const active = tabManager.getActiveTab();
        if (active) this.engineAdapter.goForward(active.id);
      });
    }

    const btnReload = document.getElementById('btn-reload') || document.getElementById('btn-nav-reload');
    if (btnReload) {
      btnReload.addEventListener('click', () => {
        const active = tabManager.getActiveTab();
        if (active) this.engineAdapter.reload(active.id);
      });
    }

    // Omnibox Navigation
    if (this.dom.urlInput) {
      this.dom.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const input = this.dom.urlInput.value.trim();
          if (input) this.navigateCurrentTab(input);
        }
      });
    }

    // Dashboard Search Box
    if (this.dom.dashSearchInput) {
      this.dom.dashSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const input = this.dom.dashSearchInput.value.trim();
          if (input) this.navigateCurrentTab(input);
        }
      });
    }

    // Search Engine Switcher Chips
    document.querySelectorAll('.engine-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const engineKey = chip.getAttribute('data-engine');
        browserContext.setSearchEngine(engineKey);
      });
    });

    // Split View Toggle
    const splitBtn = document.getElementById('btn-split-toggle');
    if (splitBtn) {
      splitBtn.addEventListener('click', () => browserContext.toggleSplitView());
    }

    // AI Assistant Drawer
    const btnToggleAi = document.getElementById('btn-toggle-ai');
    if (btnToggleAi) {
      btnToggleAi.addEventListener('click', () => browserContext.toggleAiDrawer());
    }

    const btnCloseAi = document.getElementById('btn-close-ai');
    if (btnCloseAi) {
      btnCloseAi.addEventListener('click', () => browserContext.toggleAiDrawer(false));
    }
    
    const dashAiBtn = document.getElementById('dash-ai-btn');
    if (dashAiBtn) {
      dashAiBtn.addEventListener('click', () => browserContext.toggleAiDrawer(true));
    }

    const btnSendAi = document.getElementById('btn-send-ai');
    if (btnSendAi) {
      btnSendAi.addEventListener('click', () => this.handleAiSubmit());
    }

    if (this.dom.aiInput) {
      this.dom.aiInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleAiSubmit();
      });
    }

    document.querySelectorAll('.ai-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.getAttribute('data-action');
        this.handleAiQuickAction(action);
      });
    });

    // Window Controls
    const btnWinMin = document.getElementById('btn-win-min');
    if (btnWinMin) btnWinMin.addEventListener('click', () => ipcBridge.minimizeWindow());

    const btnWinMax = document.getElementById('btn-win-max');
    if (btnWinMax) btnWinMax.addEventListener('click', () => ipcBridge.toggleMaximizeWindow());

    const btnWinClose = document.getElementById('btn-win-close');
    if (btnWinClose) btnWinClose.addEventListener('click', () => ipcBridge.closeWindow());

    // Shortcuts Modal UI Close
    if (this.dom.btnCloseShortcutsModal) {
      this.dom.btnCloseShortcutsModal.addEventListener('click', () => this.toggleShortcutsModal(false));
    }
    if (this.dom.modalShortcuts) {
      this.dom.modalShortcuts.addEventListener('click', (e) => {
        if (e.target === this.dom.modalShortcuts) {
          this.toggleShortcutsModal(false);
        }
      });
    }

    // Start Central Keybinding Listener
    keybindingManager.startListening();
  }

  /* ==========================================================================
     TAB RENDERING & NAVIGATION LOGIC
     ========================================================================== */
  renderTabPill(tab) {
    const createPillEl = (prefix) => {
      const el = document.createElement('div');
      el.className = `tab-item ${tab.isPinned ? 'pinned' : ''}`;
      el.id = `${prefix}-${tab.id}`;
      
      const isInternal = !tab.url || tab.url === BLANK_URL || tab.url === DEFAULT_NEWTAB_URL || tab.url === LEGACY_NEWTAB_URL;
      const displayTitle = isInternal ? 'New Tab' : (tab.title && tab.title !== 'about:blank' ? tab.title : (tab.url || 'New Tab'));

      const faviconHtml = tab.favicon 
        ? `<img src="${tab.favicon}" alt="" width="14" height="14" class="tab-favicon-img" onerror="this.outerHTML='<svg width=\\'13\\' height=\\'13\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/><line x1=\\'2\\' y1=\\'12\\' x2=\\'22\\' y2=\\'12\\'/><path d=\\'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\\'/></svg>'">`
        : (isInternal
          ? `<svg width="14" height="14" viewBox="0 0 100 100" style="color: var(--accent-blue);">
              <path d="M 48 23 Q 54 38 72 48 Q 59 54 53 60 Q 49 48 42 38 Q 43 29 48 23 Z" fill="currentColor"/>
              <path d="M 52 77 Q 46 62 28 52 Q 41 46 47 40 Q 51 52 58 62 Q 57 71 52 77 Z" fill="currentColor"/>
            </svg>`
          : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>`
        );

      el.innerHTML = `
        <div class="tab-favicon">${faviconHtml}</div>
        <span class="tab-title" title="${displayTitle}">${displayTitle}</span>
        ${tab.isPinned ? `<span class="tab-pin-indicator" title="Pinned Tab"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24V17z"/></svg></span>` : ''}
        <button class="tab-close-btn" title="Close Tab">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      el.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-close-btn')) {
          tabManager.activateTab(tab.id);
        }
      });

      // Right-Click Context Menu
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openTabContextMenu(e, tab.id);
      });

      el.querySelector('.tab-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        tabManager.closeTab(tab.id);
      });

      return el;
    };

    // Render Vertical Tab
    if (this.dom.tabsList) {
      this.dom.tabsList.appendChild(createPillEl('tab-pill'));
    }

    // Render Horizontal Tab
    if (this.dom.horizontalTabsList) {
      this.dom.horizontalTabsList.appendChild(createPillEl('h-tab-pill'));
    }
  }

  updateActiveTabUi(tabId, tab) {
    document.querySelectorAll('.tab-item').forEach(el => {
      el.classList.toggle('active', el.id === `tab-pill-${tabId}` || el.id === `h-tab-pill-${tabId}`);
    });

    const isSettings = tab.url === SETTINGS_URL || tab.url === LEGACY_SETTINGS_URL;
    const isNewTab = tab.url === DEFAULT_NEWTAB_URL || tab.url === LEGACY_NEWTAB_URL || tab.url === BLANK_URL;

    if (isSettings) {
      // Hide left sidebar completely when Settings is open
      if (this.dom.sidebar) this.dom.sidebar.style.display = 'none';
      if (this.dom.horizontalTabsBar) this.dom.horizontalTabsBar.style.display = 'none';
      if (this.dom.newTabView) this.dom.newTabView.style.display = 'none';
      if (this.dom.settingsView) this.dom.settingsView.style.display = 'flex';
      this.dom.urlInput.value = 'mynetwork://settings';
      document.querySelectorAll('.browser-webview').forEach(wv => wv.classList.remove('active'));
      this.populateSettingsForm();
      this.renderSettingsHistory();
    } else {
      // Restore layout mode (Vertical vs Horizontal)
      const currentLayout = settingsService.get('tabLayout', 'vertical');
      this.applyTabLayout(currentLayout);

      if (this.dom.settingsView) this.dom.settingsView.style.display = 'none';

      if (isNewTab) {
        if (this.dom.newTabView) this.dom.newTabView.style.display = 'flex';
        this.dom.urlInput.value = '';
        this.dom.urlInput.placeholder = browserContext.getCurrentEngine().placeholder;
        document.querySelectorAll('.browser-webview').forEach(wv => wv.classList.remove('active'));
      } else {
        if (this.dom.newTabView) this.dom.newTabView.style.display = 'none';
        this.dom.urlInput.value = tab.url;
        this.engineAdapter.showWebview(tabId);
      }
    }
  }

  updateTabPillDisplay(tabId, tab) {
    const updateEl = (el) => {
      if (!el || !tab) return;
      el.classList.toggle('pinned', !!tab.isPinned);
      const titleEl = el.querySelector('.tab-title');
      const isInternal = !tab.url || tab.url === BLANK_URL || tab.url === DEFAULT_NEWTAB_URL || tab.url === LEGACY_NEWTAB_URL;
      const displayTitle = isInternal ? 'New Tab' : (tab.title && tab.title !== 'about:blank' ? tab.title : (tab.url || 'New Tab'));
      
      if (titleEl) {
        titleEl.textContent = displayTitle;
        titleEl.title = displayTitle;
      }

      const faviconEl = el.querySelector('.tab-favicon');
      if (faviconEl) {
        if (tab.favicon) {
          faviconEl.innerHTML = `<img src="${tab.favicon}" alt="" width="14" height="14" class="tab-favicon-img" onerror="this.outerHTML='<svg width=\\'13\\' height=\\'13\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/><line x1=\\'2\\' y1=\\'12\\' x2=\\'22\\' y2=\\'12\\'/><path d=\\'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\\'/></svg>'">`;
        } else if (isInternal) {
          faviconEl.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 100 100" style="color: var(--accent-blue);">
              <path d="M 48 23 Q 54 38 72 48 Q 59 54 53 60 Q 49 48 42 38 Q 43 29 48 23 Z" fill="currentColor"/>
              <path d="M 52 77 Q 46 62 28 52 Q 41 46 47 40 Q 51 52 58 62 Q 57 71 52 77 Z" fill="currentColor"/>
            </svg>`;
        } else {
          faviconEl.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>`;
        }
      }
    };

    updateEl(document.getElementById(`tab-pill-${tabId}`));
    updateEl(document.getElementById(`h-tab-pill-${tabId}`));
  }

  navigateCurrentTab(query) {
    const activeTab = tabManager.getActiveTab();
    if (!activeTab) return;

    let targetUrl = query.trim();
    if (targetUrl.toLowerCase() === 'mynetwork://settings' || targetUrl.toLowerCase() === 'about:settings') {
      tabManager.updateTab(activeTab.id, { url: SETTINGS_URL, title: 'Settings' });
      this.updateActiveTabUi(activeTab.id, tabManager.getActiveTab());
      return;
    }

    if (targetUrl === DEFAULT_NEWTAB_URL || targetUrl === LEGACY_NEWTAB_URL || targetUrl === BLANK_URL) {
      tabManager.updateTab(activeTab.id, { url: DEFAULT_NEWTAB_URL, title: 'New Tab', favicon: null });
      this.updateActiveTabUi(activeTab.id, tabManager.getActiveTab());
      return;
    }

    const isUrl = /^https?:\/\//i.test(targetUrl) || (targetUrl.includes('.') && !targetUrl.includes(' '));
    if (isUrl) {
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }
    } else {
      const engine = browserContext.getCurrentEngine();
      targetUrl = engine.url + encodeURIComponent(targetUrl);
    }

    let provisionalFavicon = null;
    try {
      const parsed = new URL(targetUrl);
      if (parsed.hostname) {
        provisionalFavicon = `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
      }
    } catch (e) {}

    tabManager.updateTab(activeTab.id, {
      url: targetUrl,
      title: targetUrl,
      favicon: provisionalFavicon
    });

    this.dom.newTabView.style.display = 'none';
    this.dom.urlInput.value = targetUrl;
    this.engineAdapter.navigate(activeTab.id, targetUrl);
    this.engineAdapter.showWebview(activeTab.id);
  }

  /* ==========================================================================
     DASHBOARD WIDGET IMPLEMENTATIONS
     ========================================================================== */
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

  initScratchpad() {
    if (this.dom.scratchpadTextarea) {
      const notes = scratchpadService.getNotes();
      this.dom.scratchpadTextarea.value = notes;
      if (this.dom.scratchpadCharCount) {
        this.dom.scratchpadCharCount.textContent = `${notes.length} characters`;
      }

      this.dom.scratchpadTextarea.addEventListener('input', (e) => {
        scratchpadService.saveNotes(e.target.value);
      });
    }

    if (this.dom.btnClearScratchpad) {
      this.dom.btnClearScratchpad.addEventListener('click', () => {
        this.dom.scratchpadTextarea.value = '';
        scratchpadService.clearNotes();
      });
    }
  }

  renderTasks() {
    if (!this.dom.tasksListContainer) return;
    this.dom.tasksListContainer.innerHTML = '';

    const tasks = taskService.getTasks();
    const progress = taskService.getProgress();

    if (this.dom.tasksCountBadge) {
      this.dom.tasksCountBadge.textContent = `${progress.completed}/${progress.total} done`;
    }

    if (tasks.length === 0) {
      this.dom.tasksListContainer.innerHTML = `<div style="text-align:center; padding: 12px; color: #94a3b8; font-size:11px;">No tasks yet. Add one above!</div>`;
      return;
    }

    tasks.forEach(task => {
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
        taskService.toggleTask(task.id, e.target.checked);
      });

      taskEl.querySelector('.task-del-btn').addEventListener('click', () => {
        taskService.deleteTask(task.id);
      });

      this.dom.tasksListContainer.appendChild(taskEl);
    });

    if (this.dom.tasksInputForm && !this.dom.tasksInputForm._bound) {
      this.dom.tasksInputForm._bound = true;
      this.dom.tasksInputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.dom.taskInputField.value.trim();
        if (text) {
          taskService.addTask(text);
          this.dom.taskInputField.value = '';
        }
      });
    }
  }

  initTimer() {
    if (this.dom.btnTimerToggle) {
      this.dom.btnTimerToggle.addEventListener('click', () => timerService.toggle());
    }

    if (this.dom.btnTimerReset) {
      this.dom.btnTimerReset.addEventListener('click', () => timerService.reset());
    }

    if (this.dom.timerModeFocus) {
      this.dom.timerModeFocus.addEventListener('click', () => {
        timerService.setMode('focus', 25 * 60);
        this.dom.timerModeFocus.classList.add('active');
        this.dom.timerModeBreak.classList.remove('active');
      });
    }

    if (this.dom.timerModeBreak) {
      this.dom.timerModeBreak.addEventListener('click', () => {
        timerService.setMode('break', 5 * 60);
        this.dom.timerModeBreak.classList.add('active');
        this.dom.timerModeFocus.classList.remove('active');
      });
    }
  }

  renderRecents() {
    if (!this.dom.recentLinksList) return;
    this.dom.recentLinksList.innerHTML = '';

    const recents = historyService.getRecent();
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
        this.navigateCurrentTab(item.url);
      });

      this.dom.recentLinksList.appendChild(itemEl);
    });

    if (this.dom.btnClearRecents && !this.dom.btnClearRecents._bound) {
      this.dom.btnClearRecents._bound = true;
      this.dom.btnClearRecents.addEventListener('click', () => {
        historyService.clear();
      });
    }
  }

  /* ==========================================================================
     AI COPILOT & PROGRESS BAR
     ========================================================================== */
  handleAiSubmit() {
    const text = this.dom.aiInput.value.trim();
    if (!text) return;

    this.appendAiMessage('user', text);
    this.dom.aiInput.value = '';

    setTimeout(() => {
      let response = `I have analyzed "${text}". As your MyNetwork assistant, I can synthesize information, draft notes, or organize your research tabs.`;
      if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi')) {
        response = "Hello! How can I assist your browsing and research in MyNetwork today?";
      }
      this.appendAiMessage('bot', response);
    }, 500);
  }

  handleAiQuickAction(action) {
    const activeTab = tabManager.getActiveTab();
    const title = activeTab ? activeTab.title : 'Current Page';
    const url = activeTab ? activeTab.url : DEFAULT_NEWTAB_URL;

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

  showProgress(percentage) {
    if (this.dom.progressBar) {
      this.dom.progressBar.style.opacity = '1';
      this.dom.progressBar.style.width = `${percentage}%`;
    }
  }

  hideProgress() {
    if (this.dom.progressBar) {
      this.dom.progressBar.style.opacity = '0';
      setTimeout(() => {
        this.dom.progressBar.style.width = '0%';
      }, 250);
    }
  }

  /* ==========================================================================
     KEYBINDINGS REGISTRATION & MODAL
     ========================================================================== */
  initKeybindings() {
    // 1. Tab & Window Management
    keybindingManager.register('ctrl+t', {
      id: 'tab:new',
      label: 'New Tab',
      category: 'Tabs & Windows',
      handler: () => tabManager.createTab()
    });

    keybindingManager.register('ctrl+w', {
      id: 'tab:close',
      label: 'Close Active Tab',
      category: 'Tabs & Windows',
      handler: () => {
        const active = tabManager.getActiveTab();
        if (active) tabManager.closeTab(active.id);
      }
    });

    keybindingManager.register('ctrl+tab', {
      id: 'tab:next',
      label: 'Next Tab',
      category: 'Tabs & Windows',
      handler: () => this.cycleTab(1)
    });

    keybindingManager.register('ctrl+shift+tab', {
      id: 'tab:previous',
      label: 'Previous Tab',
      category: 'Tabs & Windows',
      handler: () => this.cycleTab(-1)
    });

    for (let i = 1; i <= 8; i++) {
      keybindingManager.register(`ctrl+${i}`, {
        id: `tab:switch-${i}`,
        label: `Switch to Tab ${i}`,
        category: 'Tabs & Windows',
        handler: () => this.switchToTabByIndex(i - 1)
      });
    }

    keybindingManager.register('ctrl+9', {
      id: 'tab:switch-last',
      label: 'Switch to Last Tab',
      category: 'Tabs & Windows',
      handler: () => this.switchToLastTab()
    });

    // 2. Navigation & Omnibox
    keybindingManager.register('ctrl+l', {
      id: 'nav:focus-omnibox',
      label: 'Focus Omnibox Address Bar',
      category: 'Navigation',
      handler: () => {
        if (this.dom.urlInput) {
          this.dom.urlInput.focus();
          this.dom.urlInput.select();
        }
      }
    });

    keybindingManager.register('alt+d', {
      id: 'nav:focus-omnibox-alt',
      label: 'Focus Omnibox (Alt+D)',
      category: 'Navigation',
      handler: () => {
        if (this.dom.urlInput) {
          this.dom.urlInput.focus();
          this.dom.urlInput.select();
        }
      }
    });

    keybindingManager.register('ctrl+k', {
      id: 'nav:focus-search',
      label: 'Focus Dashboard Search',
      category: 'Navigation',
      handler: () => {
        if (this.dom.dashSearchInput) {
          this.dom.dashSearchInput.focus();
          this.dom.dashSearchInput.select();
        }
      }
    });

    keybindingManager.register('ctrl+r', {
      id: 'nav:reload',
      label: 'Reload Active Page',
      category: 'Navigation',
      handler: () => {
        const active = tabManager.getActiveTab();
        if (active) this.engineAdapter.reload(active.id);
      }
    });

    keybindingManager.register('f5', {
      id: 'nav:reload-f5',
      label: 'Reload (F5)',
      category: 'Navigation',
      handler: () => {
        const active = tabManager.getActiveTab();
        if (active) this.engineAdapter.reload(active.id);
      }
    });

    keybindingManager.register('alt+arrowleft', {
      id: 'nav:back',
      label: 'Navigate Back (Alt+Left)',
      category: 'Navigation',
      handler: () => {
        const active = tabManager.getActiveTab();
        if (active) this.engineAdapter.goBack(active.id);
      }
    });

    keybindingManager.register('alt+arrowright', {
      id: 'nav:forward',
      label: 'Navigate Forward (Alt+Right)',
      category: 'Navigation',
      handler: () => {
        const active = tabManager.getActiveTab();
        if (active) this.engineAdapter.goForward(active.id);
      }
    });

    keybindingManager.register('escape', {
      id: 'ui:dismiss',
      label: 'Dismiss Overlay / Blur',
      category: 'General',
      handler: () => {
        this.toggleShortcutsModal(false);
        browserContext.toggleAiDrawer(false);
        if (document.activeElement) document.activeElement.blur();
      }
    });

    // 3. Workspace & Layout
    keybindingManager.register('ctrl+s', {
      id: 'ui:toggle-sidebar',
      label: 'Toggle Sidebar Compact Rail',
      category: 'Workspace & Layout',
      handler: () => browserContext.toggleSidebarRail()
    });

    keybindingManager.register('ctrl+b', {
      id: 'ui:toggle-sidebar-alt',
      label: 'Toggle Sidebar (Ctrl+B)',
      category: 'Workspace & Layout',
      handler: () => browserContext.toggleSidebarRail()
    });

    keybindingManager.register('ctrl+shift+s', {
      id: 'ui:toggle-splitview',
      label: 'Toggle Split View Mode',
      category: 'Workspace & Layout',
      handler: () => browserContext.toggleSplitView()
    });

    keybindingManager.register('ctrl+j', {
      id: 'ui:toggle-ai-drawer',
      label: 'Toggle Gemini Copilot Drawer',
      category: 'Workspace & Layout',
      handler: () => browserContext.toggleAiDrawer()
    });

    keybindingManager.register('ctrl+shift+t', {
      id: 'feature:toggle-timer',
      label: 'Start / Pause Focus Timer',
      category: 'Productivity',
      handler: () => timerService.toggle()
    });

    keybindingManager.register('ctrl+shift+l', {
      id: 'feature:open-passwords',
      label: 'Open Passwords & Keychain',
      category: 'Security',
      handler: () => this.openSettingsTab('passwords')
    });

    // 4. Help & Overlay
    keybindingManager.register('ctrl+/', {
      id: 'ui:toggle-shortcuts-modal',
      label: 'Toggle Keyboard Shortcuts Cheat Sheet',
      category: 'General',
      handler: () => this.toggleShortcutsModal()
    });

    keybindingManager.register('f1', {
      id: 'ui:toggle-shortcuts-modal-f1',
      label: 'Help / Keyboard Shortcuts (F1)',
      category: 'General',
      handler: () => this.toggleShortcutsModal()
    });
  }

  cycleTab(direction) {
    const tabs = tabManager.getAllTabs();
    if (tabs.length <= 1) return;
    const currentIndex = tabs.findIndex(t => t.id === tabManager.activeTabId);
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = tabs.length - 1;
    if (nextIndex >= tabs.length) nextIndex = 0;
    tabManager.activateTab(tabs[nextIndex].id);
  }

  switchToTabByIndex(index) {
    const tabs = tabManager.getAllTabs();
    if (tabs[index]) {
      tabManager.activateTab(tabs[index].id);
    }
  }

  switchToLastTab() {
    const tabs = tabManager.getAllTabs();
    if (tabs.length > 0) {
      tabManager.activateTab(tabs[tabs.length - 1].id);
    }
  }

  toggleShortcutsModal(forceState) {
    if (!this.dom.modalShortcuts) return;
    const shouldOpen = forceState !== undefined ? forceState : !this.dom.modalShortcuts.open;
    if (shouldOpen) {
      this.renderShortcutsModal();
      this.dom.modalShortcuts.showModal();
    } else {
      this.dom.modalShortcuts.close();
    }
  }

  renderShortcutsModal() {
    if (!this.dom.shortcutsModalList) return;
    const grouped = keybindingManager.getRegisteredShortcuts();
    this.dom.shortcutsModalList.innerHTML = '';

    for (const [category, shortcuts] of Object.entries(grouped)) {
      const groupEl = document.createElement('div');
      groupEl.className = 'shortcuts-category-group';
      
      const titleEl = document.createElement('div');
      titleEl.className = 'shortcuts-category-title';
      titleEl.textContent = category;
      groupEl.appendChild(titleEl);

      shortcuts.forEach(item => {
        const row = document.createElement('div');
        row.className = 'shortcut-row';

        const label = document.createElement('span');
        label.className = 'shortcut-label';
        label.textContent = item.label;

        const keysWrapper = document.createElement('div');
        keysWrapper.className = 'shortcut-keys';

        const keyParts = item.combo.split('+').map(k => {
          if (k === 'ctrl') return 'Ctrl';
          if (k === 'shift') return 'Shift';
          if (k === 'alt') return 'Alt';
          if (k === 'arrowleft') return '←';
          if (k === 'arrowright') return '→';
          if (k === 'escape') return 'Esc';
          return k.toUpperCase();
        });

        keysWrapper.innerHTML = keyParts.map(k => `<kbd>${k}</kbd>`).join(' + ');

        row.appendChild(label);
        row.appendChild(keysWrapper);
        groupEl.appendChild(row);
      });

      this.dom.shortcutsModalList.appendChild(groupEl);
    }
  }

  /* ==========================================================================
     SETTINGS & 3-DOTS MENU CONTROLLER
     ========================================================================== */
  openSettingsTab(category = 'general') {
    const existing = tabManager.getTabs().find(t => t.url === SETTINGS_URL || t.url === LEGACY_SETTINGS_URL);
    if (existing) {
      tabManager.activateTab(existing.id);
    } else {
      tabManager.createTab(SETTINGS_URL, 'Settings');
    }
    this.switchSettingsCategory(category);
  }

  switchSettingsCategory(category = 'general') {
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-category') === category);
    });

    document.querySelectorAll('.settings-section').forEach(sec => {
      sec.style.display = sec.id === `section-${category}` ? 'flex' : 'none';
    });

    if (category === 'privacy') {
      this.renderSettingsHistory();
    } else if (category === 'passwords') {
      this.renderPasswordsList();
      this.renderPasswordHealth();
    }
  }

  applyTabLayout(layout = 'vertical') {
    this.tabLayout = layout;
    const activeTab = tabManager.getActiveTab();
    const isSettings = activeTab && (activeTab.url === SETTINGS_URL || activeTab.url === LEGACY_SETTINGS_URL);

    if (isSettings) {
      if (this.dom.sidebar) this.dom.sidebar.style.display = 'none';
      if (this.dom.horizontalTabsBar) this.dom.horizontalTabsBar.style.display = 'none';
    } else {
      if (layout === 'horizontal') {
        if (this.dom.sidebar) this.dom.sidebar.style.display = 'none';
        if (this.dom.horizontalTabsBar) this.dom.horizontalTabsBar.style.display = 'flex';
      } else {
        if (this.dom.sidebar) this.dom.sidebar.style.display = 'flex';
        if (this.dom.horizontalTabsBar) this.dom.horizontalTabsBar.style.display = 'none';
      }
    }

    document.querySelectorAll('#control-tab-layout .segmented-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-layout') === layout);
    });
  }

  renderSettingsHistory(filterText = '') {
    if (!this.dom.settingsHistoryList) return;
    const history = historyService.getHistory();
    const query = filterText.toLowerCase().trim();
    const filtered = query
      ? history.filter(h => (h.title && h.title.toLowerCase().includes(query)) || (h.url && h.url.toLowerCase().includes(query)))
      : history;

    this.dom.settingsHistoryList.innerHTML = '';
    if (filtered.length === 0) {
      this.dom.settingsHistoryList.innerHTML = `
        <div style="padding: 14px; text-align: center; color: #94a3b8; font-size: 11.5px;">
          No browsing history found.
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const row = document.createElement('div');
      row.className = 'mac-history-row';
      const timeStr = new Date(item.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      row.innerHTML = `
        <span class="mac-history-time">${timeStr}</span>
        <span class="mac-history-title" title="${item.url}">${item.title || item.url}</span>
        <button class="mac-history-del" title="Delete entry">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      row.querySelector('.mac-history-title').addEventListener('click', () => {
        tabManager.createTab(item.url, item.title || item.url);
      });

      row.querySelector('.mac-history-del').addEventListener('click', (e) => {
        e.stopPropagation();
        historyService.removeItem(item.id);
        this.renderSettingsHistory(this.dom.historySearchInput ? this.dom.historySearchInput.value : '');
        this.renderRecents();
      });

      this.dom.settingsHistoryList.appendChild(row);
    });
  }

  initSettings() {
    // 1. 3-Dots Menu Trigger & Outside Click Dismiss
    if (this.dom.btnMenu && this.dom.appDropdownMenu) {
      this.dom.btnMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dom.appDropdownMenu.classList.toggle('active');
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-dropdown-container')) {
          this.dom.appDropdownMenu.classList.remove('active');
        }
      });
    }

    // 2. Menu Item Quick Actions
    const menuItemNewTab = document.getElementById('menu-item-new-tab');
    if (menuItemNewTab) {
      menuItemNewTab.addEventListener('click', () => {
        tabManager.createTab();
        if (this.dom.appDropdownMenu) this.dom.appDropdownMenu.classList.remove('active');
      });
    }

    const menuItemSplitView = document.getElementById('menu-item-split-view');
    if (menuItemSplitView) {
      menuItemSplitView.addEventListener('click', () => {
        browserContext.toggleSplitView();
        if (this.dom.appDropdownMenu) this.dom.appDropdownMenu.classList.remove('active');
      });
    }

    const menuItemAi = document.getElementById('menu-item-ai-copilot');
    if (menuItemAi) {
      menuItemAi.addEventListener('click', () => {
        browserContext.toggleAiDrawer(true);
        if (this.dom.appDropdownMenu) this.dom.appDropdownMenu.classList.remove('active');
      });
    }

    const menuItemHistory = document.getElementById('menu-item-history');
    if (menuItemHistory) {
      menuItemHistory.addEventListener('click', () => {
        this.openSettingsTab('privacy');
        if (this.dom.appDropdownMenu) this.dom.appDropdownMenu.classList.remove('active');
      });
    }

    const menuItemPasswords = document.getElementById('menu-item-passwords');
    if (menuItemPasswords) {
      menuItemPasswords.addEventListener('click', () => {
        this.openSettingsTab('passwords');
        if (this.dom.appDropdownMenu) this.dom.appDropdownMenu.classList.remove('active');
      });
    }

    const menuItemShortcuts = document.getElementById('menu-item-shortcuts');
    if (menuItemShortcuts) {
      menuItemShortcuts.addEventListener('click', () => {
        this.toggleShortcutsModal(true);
        if (this.dom.appDropdownMenu) this.dom.appDropdownMenu.classList.remove('active');
      });
    }

    const menuItemSettings = document.getElementById('menu-item-settings');
    if (menuItemSettings) {
      menuItemSettings.addEventListener('click', () => {
        this.openSettingsTab('general');
        if (this.dom.appDropdownMenu) this.dom.appDropdownMenu.classList.remove('active');
      });
    }

    const menuItemExit = document.getElementById('menu-item-exit');
    if (menuItemExit) {
      menuItemExit.addEventListener('click', () => ipcBridge.closeWindow());
    }

    // 3. Settings Back Button (Returns to workspace)
    if (this.dom.btnSettingsBack) {
      this.dom.btnSettingsBack.addEventListener('click', () => {
        const active = tabManager.getActiveTab();
        const nonSettingsTab = tabManager.getTabs().find(t => t.url !== SETTINGS_URL && t.url !== LEGACY_SETTINGS_URL);
        if (nonSettingsTab) {
          tabManager.activateTab(nonSettingsTab.id);
        } else {
          tabManager.createTab(DEFAULT_NEWTAB_URL, 'New Tab');
          if (active) tabManager.closeTab(active.id);
        }
      });
    }

    // 4. Horizontal Add Tab Button
    if (this.dom.btnAddTabH) {
      this.dom.btnAddTabH.addEventListener('click', () => {
        tabManager.createTab();
      });
    }

    // 5. Settings Navigation Category Switching
    document.querySelectorAll('.settings-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-category');
        this.switchSettingsCategory(category);
      });
    });

    // 6. Tab Layout Segmented Control (Vertical vs Horizontal)
    document.querySelectorAll('#control-tab-layout .segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layout = btn.getAttribute('data-layout');
        settingsService.set('tabLayout', layout);
        this.applyTabLayout(layout);
        document.querySelectorAll('#control-tab-layout .segmented-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // 6b. Window Controls Style Segmented Control (macOS Traffic Lights vs Windows 11)
    document.querySelectorAll('#control-window-style .segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const style = btn.getAttribute('data-win-style');
        settingsService.set('windowControlsStyle', style);
        this.applyWindowControlsStyle(style);
        document.querySelectorAll('#control-window-style .segmented-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.showToast(`Window Controls: ${style === 'win' ? 'Windows 11 Native' : 'macOS Traffic Lights'}`);
      });
    });

    // 6c. Tab Density Control (Comfortable vs Compact)
    document.querySelectorAll('#control-tab-density .segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const density = btn.getAttribute('data-density');
        settingsService.set('tabDensity', density);
        this.applyTabDensity(density);
        document.querySelectorAll('#control-tab-density .segmented-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.showToast(`Tab density set to ${density}`);
      });
    });

    // 6d. Startup Session Restore Toggle
    if (this.dom.settingRestoreSession) {
      this.dom.settingRestoreSession.addEventListener('change', (e) => {
        settingsService.set('restoreSessionOnStartup', e.target.checked);
        this.showToast(e.target.checked ? 'Session auto-restore enabled' : 'Session restore disabled');
      });
    }

    // 6e. Window Controls (Both macOS and Windows styles)
    if (this.dom.btnWinClose) {
      this.dom.btnWinClose.addEventListener('click', () => ipcBridge.closeWindow());
    }
    if (this.dom.btnWinMin) {
      this.dom.btnWinMin.addEventListener('click', () => ipcBridge.minimizeWindow());
    }
    if (this.dom.btnWinMax) {
      this.dom.btnWinMax.addEventListener('click', () => ipcBridge.toggleMaximize());
    }

    if (this.dom.btnWinCloseWin) {
      this.dom.btnWinCloseWin.addEventListener('click', () => ipcBridge.closeWindow());
    }
    if (this.dom.btnWinMinWin) {
      this.dom.btnWinMinWin.addEventListener('click', () => ipcBridge.minimizeWindow());
    }
    if (this.dom.btnWinMaxWin) {
      this.dom.btnWinMaxWin.addEventListener('click', () => ipcBridge.toggleMaximize());
    }

    // 7. History Search Filter
    if (this.dom.historySearchInput) {
      this.dom.historySearchInput.addEventListener('input', (e) => {
        this.renderSettingsHistory(e.target.value);
      });
    }

    // 8. Reactive Form Controls
    if (this.dom.settingSearchEngine) {
      this.dom.settingSearchEngine.addEventListener('change', (e) => {
        const engineKey = e.target.value;
        settingsService.set('defaultSearchEngine', engineKey);
        browserContext.setSearchEngine(engineKey);
      });
    }

    if (this.dom.settingStartupBehavior) {
      this.dom.settingStartupBehavior.addEventListener('change', (e) => {
        settingsService.set('startupBehavior', e.target.value);
      });
    }

    if (this.dom.settingCompactSidebar) {
      this.dom.settingCompactSidebar.addEventListener('change', (e) => {
        settingsService.set('compactSidebarOnStart', e.target.checked);
      });
    }

    if (this.dom.settingTrackingLevel) {
      this.dom.settingTrackingLevel.addEventListener('change', (e) => {
        settingsService.set('trackingProtectionLevel', e.target.value);
      });
    }

    if (this.dom.settingFocusDuration) {
      this.dom.settingFocusDuration.addEventListener('change', (e) => {
        const mins = parseInt(e.target.value, 10) || 25;
        settingsService.set('focusDurationMinutes', mins);
        timerService.focusDuration = mins * 60;
        timerService.reset();
      });
    }

    if (this.dom.settingBreakDuration) {
      this.dom.settingBreakDuration.addEventListener('change', (e) => {
        const mins = parseInt(e.target.value, 10) || 5;
        settingsService.set('breakDurationMinutes', mins);
        timerService.breakDuration = mins * 60;
      });
    }

    // Theme Accent Buttons
    document.querySelectorAll('.accent-color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        document.querySelectorAll('.accent-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        settingsService.set('accentTheme', color);
        this.applyAccentTheme(color);
      });
    });

    // Clear History Button
    if (this.dom.btnSettingsClearHistory) {
      this.dom.btnSettingsClearHistory.addEventListener('click', () => {
        historyService.clear();
        this.renderRecents();
        this.renderSettingsHistory();
        this.dom.btnSettingsClearHistory.textContent = 'Cleared!';
        setTimeout(() => {
          if (this.dom.btnSettingsClearHistory) this.dom.btnSettingsClearHistory.textContent = 'Clear History';
        }, 1200);
      });
    }

    // Reset All Settings Button
    if (this.dom.btnSettingsResetAll) {
      this.dom.btnSettingsResetAll.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
          settingsService.resetToDefaults();
          historyService.clear();
          this.renderRecents();
          this.populateSettingsForm();
          this.applyAccentTheme('blue');
          this.applyTabLayout('vertical');
          this.applyWindowControlsStyle('mac');
          this.applyTabDensity('comfortable');
        }
      });
    }

    // Open Shortcuts Button from Settings
    if (this.dom.btnSettingsOpenShortcuts) {
      this.dom.btnSettingsOpenShortcuts.addEventListener('click', () => {
        this.toggleShortcutsModal(true);
      });
    }

    // Apply saved layout, window controls style, density, and accent theme on load
    const savedLayout = settingsService.get('tabLayout', 'vertical');
    this.applyTabLayout(savedLayout);
    this.applyAccentTheme(settingsService.get('accentTheme', 'blue'));
    this.applyWindowControlsStyle(settingsService.get('windowControlsStyle', 'mac'));
    this.applyTabDensity(settingsService.get('tabDensity', 'comfortable'));
  }

  populateSettingsForm() {
    const s = settingsService.getAll();
    if (this.dom.settingSearchEngine) this.dom.settingSearchEngine.value = s.defaultSearchEngine;
    if (this.dom.settingStartupBehavior) this.dom.settingStartupBehavior.value = s.startupBehavior;
    if (this.dom.settingCompactSidebar) this.dom.settingCompactSidebar.checked = !!s.compactSidebarOnStart;
    if (this.dom.settingRestoreSession) this.dom.settingRestoreSession.checked = s.restoreSessionOnStartup !== false;
    if (this.dom.settingTrackingLevel) this.dom.settingTrackingLevel.value = s.trackingProtectionLevel;
    if (this.dom.settingFocusDuration) this.dom.settingFocusDuration.value = s.focusDurationMinutes;
    if (this.dom.settingBreakDuration) this.dom.settingBreakDuration.value = s.breakDurationMinutes;

    document.querySelectorAll('.accent-color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-color') === s.accentTheme);
    });

    document.querySelectorAll('#control-tab-layout .segmented-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-layout') === (s.tabLayout || 'vertical'));
    });

    document.querySelectorAll('#control-window-style .segmented-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-win-style') === (s.windowControlsStyle || 'mac'));
    });

    document.querySelectorAll('#control-tab-density .segmented-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-density') === (s.tabDensity || 'comfortable'));
    });
  }

  applyWindowControlsStyle(style = 'mac') {
    if (style === 'win') {
      if (this.dom.macTrafficLights) this.dom.macTrafficLights.style.display = 'none';
      if (this.dom.winWindowControls) this.dom.winWindowControls.style.display = 'flex';
    } else {
      if (this.dom.macTrafficLights) this.dom.macTrafficLights.style.display = 'flex';
      if (this.dom.winWindowControls) this.dom.winWindowControls.style.display = 'none';
    }
  }

  applyTabDensity(density = 'comfortable') {
    document.body.classList.toggle('density-compact', density === 'compact');
  }

  applyAccentTheme(theme) {
    const themeColors = {
      blue: { main: '#2563eb', light: '#eff6ff', hover: '#1d4ed8' },
      indigo: { main: '#4f46e5', light: '#eef2ff', hover: '#4338ca' },
      purple: { main: '#7c3aed', light: '#f5f3ff', hover: '#6d28d9' },
      emerald: { main: '#059669', light: '#ecfdf5', hover: '#047857' },
      amber: { main: '#d97706', light: '#fef3c7', hover: '#b45309' },
      rose: { main: '#e11d48', light: '#ffe4e6', hover: '#be123c' },
      slate: { main: '#475569', light: '#f1f5f9', hover: '#334155' }
    };

    const palette = themeColors[theme] || themeColors.blue;
    document.documentElement.style.setProperty('--accent-blue', palette.main);
    document.documentElement.style.setProperty('--accent-light', palette.light);
    document.documentElement.style.setProperty('--accent-hover', palette.hover);
  }

  /* ==========================================================================
     PASSWORDS & KEYCHAIN SYSTEM CONTROLLER (macOS Sequoia Style)
     ========================================================================== */
  initPasswordManager() {
    this.currentPwdCategory = 'all';
    this.currentPwdSearch = '';
    this.revealedPasswords = new Set();

    // 1. Listen for changes in vault
    eventBus.on('passwords:updated', () => {
      this.renderPasswordsList();
      this.renderPasswordHealth();
    });

    // 2. Search Input
    if (this.dom.pwdSearchInput) {
      this.dom.pwdSearchInput.addEventListener('input', (e) => {
        this.currentPwdSearch = e.target.value;
        this.renderPasswordsList();
      });
    }

    // 3. Category Filter Buttons
    if (this.dom.pwdCategoryFilters) {
      this.dom.pwdCategoryFilters.querySelectorAll('.segmented-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.dom.pwdCategoryFilters.querySelectorAll('.segmented-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentPwdCategory = btn.getAttribute('data-pwd-cat') || 'all';
          this.renderPasswordsList();
        });
      });
    }

    // 4. Modal Open / Close
    if (this.dom.btnOpenAddPwdModal) {
      this.dom.btnOpenAddPwdModal.addEventListener('click', () => {
        this.openPasswordModal();
      });
    }

    if (this.dom.btnClosePwdModal) {
      this.dom.btnClosePwdModal.addEventListener('click', () => {
        this.closePasswordModal();
      });
    }

    if (this.dom.btnCancelPwdForm) {
      this.dom.btnCancelPwdForm.addEventListener('click', () => {
        this.closePasswordModal();
      });
    }

    // 5. Password Generator Trigger
    if (this.dom.btnPwdGenerate) {
      this.dom.btnPwdGenerate.addEventListener('click', () => {
        const strongPwd = passwordService.generatePassword({ length: 18 });
        if (this.dom.pwdFormPassword) {
          this.dom.pwdFormPassword.value = strongPwd;
          this.updateStrengthMeter(strongPwd);
        }
      });
    }

    // 6. Live Strength Meter on input
    if (this.dom.pwdFormPassword) {
      this.dom.pwdFormPassword.addEventListener('input', (e) => {
        this.updateStrengthMeter(e.target.value);
      });
    }

    // 7. Form Submission (Add or Update)
    if (this.dom.pwdForm) {
      this.dom.pwdForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = this.dom.pwdFormId ? this.dom.pwdFormId.value : '';
        const url = this.dom.pwdFormUrl ? this.dom.pwdFormUrl.value.trim() : '';
        const title = this.dom.pwdFormTitle ? this.dom.pwdFormTitle.value.trim() : '';
        const username = this.dom.pwdFormUsername ? this.dom.pwdFormUsername.value.trim() : '';
        const password = this.dom.pwdFormPassword ? this.dom.pwdFormPassword.value : '';
        const category = this.dom.pwdFormCategory ? this.dom.pwdFormCategory.value : 'logins';
        const notes = this.dom.pwdFormNotes ? this.dom.pwdFormNotes.value.trim() : '';

        if (!url || !username || !password) return;

        if (id) {
          passwordService.updateCredential(id, { url, title, username, password, category, notes });
          this.showToast('Password updated successfully');
        } else {
          passwordService.addCredential({ url, title, username, password, category, notes });
          this.showToast('New password saved to Keychain');
        }

        this.closePasswordModal();
        this.renderPasswordsList();
        this.renderPasswordHealth();
      });
    }

    // 8. Export CSV Backup
    if (this.dom.btnExportPasswords) {
      this.dom.btnExportPasswords.addEventListener('click', () => {
        const csv = passwordService.exportAsCsv();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mynetwork_passwords_${Date.now()}.csv`;
        link.click();
        this.showToast('Passwords exported to CSV');
      });
    }

    // 9. Import CSV/JSON
    if (this.dom.btnImportPasswords) {
      this.dom.btnImportPasswords.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.json';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target.result;
            let res;
            if (file.name.endsWith('.json')) {
              res = passwordService.importFromJson(content);
            } else {
              res = passwordService.importFromCsv(content);
            }
            if (res && res.success) {
              this.showToast(`Imported ${res.count} passwords successfully!`);
              this.renderPasswordsList();
              this.renderPasswordHealth();
            } else {
              this.showToast(`Import error: ${res?.error || 'Failed to read file'}`);
            }
          };
          reader.readAsText(file);
        };
        input.click();
      });
    }

    // 10. Master Security PIN Lock Button Trigger
    if (this.dom.btnVaultSecurity) {
      this.dom.btnVaultSecurity.addEventListener('click', () => {
        if (!passwordService.hasMasterPin()) {
          this.openMasterPinModal('set');
        } else if (passwordService.isVaultLocked()) {
          this.openMasterPinModal('unlock');
        } else {
          // Already unlocked with PIN: toggle lock or open management
          passwordService.lockVault();
          this.revealedPasswords.clear();
          this.showToast('Keychain locked');
          this.renderPasswordsList();
          this.updateVaultSecurityButton();
        }
      });
    }

    // 11. Master PIN Modal Form Handlers with 4-Digit Auto-Submit
    if (this.dom.btnClosePinModal) {
      this.dom.btnClosePinModal.addEventListener('click', () => this.closeMasterPinModal());
    }

    if (this.dom.btnCancelPin) {
      this.dom.btnCancelPin.addEventListener('click', () => this.closeMasterPinModal());
    }

    const tryUnlock = (pin) => {
      const success = passwordService.unlockVault(pin);
      if (success) {
        this.showToast('Keychain unlocked');
        this.closeMasterPinModal();
        this.updateVaultSecurityButton();
        this.renderPasswordsList();
        if (typeof this.pendingUnlockCallback === 'function') {
          const cb = this.pendingUnlockCallback;
          this.pendingUnlockCallback = null;
          cb();
        }
      } else {
        const card = document.getElementById('pin-modal-card');
        if (card) {
          card.classList.remove('mac-shake-anim');
          void card.offsetWidth;
          card.classList.add('mac-shake-anim');
        }
        this.showPinError('Incorrect 4-digit PIN. Please try again.');
        if (this.dom.vaultPinInput) {
          this.dom.vaultPinInput.value = '';
          this.dom.vaultPinInput.focus();
        }
      }
    };

    // Live Auto-Submit on 4th digit
    if (this.dom.vaultPinInput) {
      this.dom.vaultPinInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (this.dom.pinErrorMsg) this.dom.pinErrorMsg.style.display = 'none';

        if (this.pinModalMode === 'unlock' && val.length === 4) {
          tryUnlock(val);
        } else if (this.pinModalMode === 'set' && val.length === 4 && this.dom.vaultPinConfirmInput) {
          this.dom.vaultPinConfirmInput.focus();
        }
      });
    }

    if (this.dom.vaultPinConfirmInput) {
      this.dom.vaultPinConfirmInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (this.dom.pinErrorMsg) this.dom.pinErrorMsg.style.display = 'none';

        if (this.pinModalMode === 'set' && val.length === 4) {
          const pin = this.dom.vaultPinInput ? this.dom.vaultPinInput.value.trim() : '';
          if (pin === val) {
            passwordService.setMasterPin(pin);
            this.showToast('4-Digit Master PIN enabled');
            this.closeMasterPinModal();
            this.updateVaultSecurityButton();
            this.renderPasswordsList();
          } else {
            this.showPinError('PIN confirmation does not match');
            this.dom.vaultPinConfirmInput.value = '';
          }
        }
      });
    }

    if (this.dom.vaultPinForm) {
      this.dom.vaultPinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pin = this.dom.vaultPinInput ? this.dom.vaultPinInput.value.trim() : '';
        const confirmPin = this.dom.vaultPinConfirmInput ? this.dom.vaultPinConfirmInput.value.trim() : '';

        if (this.pinModalMode === 'set') {
          if (!pin || pin.length < 4) {
            this.showPinError('Please enter a 4-digit PIN');
            return;
          }
          if (pin !== confirmPin) {
            this.showPinError('PIN confirmation does not match');
            return;
          }
          passwordService.setMasterPin(pin);
          this.showToast('4-Digit Master PIN enabled');
          this.closeMasterPinModal();
          this.updateVaultSecurityButton();
          this.renderPasswordsList();
        } else if (this.pinModalMode === 'unlock') {
          tryUnlock(pin);
        }
      });
    }

    if (this.dom.btnRemovePin) {
      this.dom.btnRemovePin.addEventListener('click', () => {
        const pin = this.dom.vaultPinInput ? this.dom.vaultPinInput.value.trim() : '';
        if (!pin) {
          this.showPinError('Enter current 4-digit PIN to remove lock');
          return;
        }
        const success = passwordService.removeMasterPin(pin);
        if (success) {
          this.showToast('Security PIN removed (Vault is now open)');
          this.closeMasterPinModal();
          this.updateVaultSecurityButton();
          this.renderPasswordsList();
        } else {
          this.showPinError('Incorrect PIN. Cannot remove.');
        }
      });
    }

    this.updateVaultSecurityButton();
  }

  updateVaultSecurityButton() {
    if (!this.dom.btnVaultSecurity) return;
    if (!passwordService.hasMasterPin()) {
      this.dom.btnVaultSecurity.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Set Master PIN`;
      this.dom.btnVaultSecurity.style.color = '#334155';
    } else if (passwordService.isVaultLocked()) {
      this.dom.btnVaultSecurity.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" style="margin-right:4px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Unlock Keychain`;
      this.dom.btnVaultSecurity.style.color = '#dc2626';
    } else {
      this.dom.btnVaultSecurity.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" style="margin-right:4px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> Lock Vault`;
      this.dom.btnVaultSecurity.style.color = '#059669';
    }
  }

  openMasterPinModal(mode = 'unlock', callback = null) {
    if (!this.dom.vaultPinModal) return;
    this.pinModalMode = mode;
    this.pendingUnlockCallback = callback;

    if (this.dom.pinErrorMsg) this.dom.pinErrorMsg.style.display = 'none';
    if (this.dom.vaultPinForm) this.dom.vaultPinForm.reset();

    if (mode === 'set') {
      if (this.dom.pinModalTitle) this.dom.pinModalTitle.textContent = 'Set Master Security PIN';
      if (this.dom.pinModalDesc) this.dom.pinModalDesc.textContent = 'Set a PIN to protect viewing and editing passwords.';
      if (this.dom.pinInputLabel) this.dom.pinInputLabel.textContent = 'Create Master PIN';
      if (this.dom.pinConfirmGroup) this.dom.pinConfirmGroup.style.display = 'flex';
      if (this.dom.btnRemovePin) this.dom.btnRemovePin.style.display = 'none';
      if (this.dom.btnSubmitPin) this.dom.btnSubmitPin.textContent = 'Set PIN';
    } else {
      // unlock mode
      if (this.dom.pinModalTitle) this.dom.pinModalTitle.textContent = 'Unlock Keychain';
      if (this.dom.pinModalDesc) this.dom.pinModalDesc.textContent = 'Enter your Master PIN to reveal or edit passwords.';
      if (this.dom.pinInputLabel) this.dom.pinInputLabel.textContent = 'Master PIN';
      if (this.dom.pinConfirmGroup) this.dom.pinConfirmGroup.style.display = 'none';
      if (this.dom.btnRemovePin) this.dom.btnRemovePin.style.display = 'inline-block';
      if (this.dom.btnSubmitPin) this.dom.btnSubmitPin.textContent = 'Unlock';
    }

    this.dom.vaultPinModal.showModal();
    setTimeout(() => {
      if (this.dom.vaultPinInput) this.dom.vaultPinInput.focus();
    }, 50);
  }

  closeMasterPinModal() {
    if (this.dom.vaultPinModal) {
      this.dom.vaultPinModal.close();
      if (this.dom.vaultPinForm) this.dom.vaultPinForm.reset();
      if (this.dom.pinErrorMsg) this.dom.pinErrorMsg.style.display = 'none';
    }
  }

  showPinError(msg) {
    if (this.dom.pinErrorMsg) {
      this.dom.pinErrorMsg.textContent = msg;
      this.dom.pinErrorMsg.style.display = 'block';
    }
  }

  ensureVaultUnlocked(onSuccess) {
    if (!passwordService.isVaultLocked()) {
      onSuccess();
    } else {
      this.openMasterPinModal('unlock', onSuccess);
    }
  }

  openPasswordModal(credential = null) {
    this.ensureVaultUnlocked(() => {
      if (!this.dom.pwdModalDialog) return;

      if (credential) {
        const titleNode = document.getElementById('pwd-modal-title');
        if (titleNode) titleNode.textContent = 'Edit Password';
        if (this.dom.pwdFormId) this.dom.pwdFormId.value = credential.id || '';
        if (this.dom.pwdFormUrl) this.dom.pwdFormUrl.value = credential.url || '';
        if (this.dom.pwdFormTitle) this.dom.pwdFormTitle.value = credential.title || '';
        if (this.dom.pwdFormUsername) this.dom.pwdFormUsername.value = credential.username || '';
        if (this.dom.pwdFormPassword) this.dom.pwdFormPassword.value = credential.password || '';
        if (this.dom.pwdFormCategory) this.dom.pwdFormCategory.value = credential.category || 'logins';
        if (this.dom.pwdFormNotes) this.dom.pwdFormNotes.value = credential.notes || '';
        this.updateStrengthMeter(credential.password || '');
      } else {
        const titleNode = document.getElementById('pwd-modal-title');
        if (titleNode) titleNode.textContent = 'Add New Password';
        if (this.dom.pwdForm) this.dom.pwdForm.reset();
        if (this.dom.pwdFormId) this.dom.pwdFormId.value = '';
        this.updateStrengthMeter('');
      }

      this.dom.pwdModalDialog.showModal();
    });
  }

  closePasswordModal() {
    if (this.dom.pwdModalDialog) {
      this.dom.pwdModalDialog.close();
      if (this.dom.pwdForm) this.dom.pwdForm.reset();
      if (this.dom.pwdFormId) this.dom.pwdFormId.value = '';
    }
  }

  updateStrengthMeter(password) {
    if (!this.dom.pwdStrengthBar || !this.dom.pwdStrengthCaption) return;
    const strength = passwordService.calculateStrength(password);
    this.dom.pwdStrengthBar.style.width = `${strength.score}%`;
    this.dom.pwdStrengthBar.style.backgroundColor = strength.color;
    this.dom.pwdStrengthCaption.textContent = password ? `Strength: ${strength.label} (${strength.score}/100)` : 'Strength: Not entered';
    this.dom.pwdStrengthCaption.style.color = strength.color;
  }

  renderPasswordsList() {
    if (!this.dom.passwordsListContainer) return;
    const items = passwordService.search(this.currentPwdSearch, this.currentPwdCategory);
    this.dom.passwordsListContainer.innerHTML = '';
    const isLocked = passwordService.isVaultLocked();

    if (items.length === 0) {
      this.dom.passwordsListContainer.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: #94a3b8; font-size: 12px;">
          No passwords found in this category. Click <strong>+ New Password</strong> to save one.
        </div>
      `;
      return;
    }

    items.forEach(c => {
      const row = document.createElement('div');
      row.className = 'mac-pwd-row';

      const strength = passwordService.calculateStrength(c.password);
      const isRevealed = !isLocked && this.revealedPasswords.has(c.id);
      const maskedPass = isRevealed ? (c.password || '') : '••••••••••••';
      const faviconImg = c.favicon 
        ? `<img src="${c.favicon}" alt="" width="16" height="16" onerror="this.outerHTML='<svg width=\\'14\\' height=\\'14\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#64748b\\' stroke-width=\\'2\\'><rect x=\\'2\\' y=\\'4\\' width=\\'20\\' height=\\'16\\' rx=\\'2\\'/><line x1=\\'2\\' y1=\\'10\\' x2=\\'22\\' y2=\\'10\\'/></svg>'">`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

      let strengthBadgeStyle = 'background: #ecfdf5; color: #059669;';
      if (strength.score < 40) strengthBadgeStyle = 'background: #fee2e2; color: #dc2626;';
      else if (strength.score < 75) strengthBadgeStyle = 'background: #fef3c7; color: #b45309;';

      row.innerHTML = `
        <div class="pwd-row-left">
          <div class="pwd-row-favicon">${faviconImg}</div>
          <div class="pwd-row-details">
            <div class="pwd-row-title-line">
              <span class="pwd-row-title">${c.title || c.domain || 'Untitled'}</span>
              <span class="pwd-strength-pill" style="${strengthBadgeStyle}">${strength.label}</span>
            </div>
            <span class="pwd-row-user">${c.username || 'No username'} ${c.url ? '• ' + c.url.replace(/^https?:\/\//, '').split('/')[0] : ''}</span>
          </div>
        </div>
        <div class="pwd-row-right">
          <span class="pwd-password-preview" id="pwd-preview-${c.id}">${maskedPass}</span>
          
          <button class="pwd-action-icon-btn btn-reveal-pwd" title="${isRevealed ? 'Hide Password' : 'Show Password'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>

          <button class="pwd-action-icon-btn btn-copy-pwd" title="Copy Password">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>

          <button class="pwd-action-icon-btn btn-copy-user" title="Copy Username">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>

          <button class="pwd-action-icon-btn btn-edit-pwd" title="Edit Account">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>

          <button class="pwd-action-icon-btn danger btn-del-pwd" title="Delete Account">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      // Reveal / Mask toggle
      row.querySelector('.btn-reveal-pwd').addEventListener('click', () => {
        this.ensureVaultUnlocked(() => {
          if (this.revealedPasswords.has(c.id)) {
            this.revealedPasswords.delete(c.id);
          } else {
            this.revealedPasswords.add(c.id);
          }
          this.renderPasswordsList();
        });
      });

      // Copy password
      row.querySelector('.btn-copy-pwd').addEventListener('click', () => {
        this.ensureVaultUnlocked(() => {
          if (navigator.clipboard && c.password) {
            navigator.clipboard.writeText(c.password);
            this.showToast('Password copied to clipboard');
          }
        });
      });

      // Copy username
      row.querySelector('.btn-copy-user').addEventListener('click', () => {
        if (navigator.clipboard && c.username) {
          navigator.clipboard.writeText(c.username);
          this.showToast('Username copied to clipboard');
        }
      });

      // Edit
      row.querySelector('.btn-edit-pwd').addEventListener('click', () => {
        this.openPasswordModal(c);
      });

      // Delete
      row.querySelector('.btn-del-pwd').addEventListener('click', () => {
        this.ensureVaultUnlocked(() => {
          if (confirm(`Delete password for "${c.title || c.domain || c.username}"?`)) {
            passwordService.deleteCredential(c.id);
            this.showToast('Password removed');
            this.renderPasswordsList();
            this.renderPasswordHealth();
          }
        });
      });

      this.dom.passwordsListContainer.appendChild(row);
    });
  }

  renderPasswordHealth() {
    const audit = passwordService.getSecurityAudit();
    if (this.dom.pwdHealthScore) {
      this.dom.pwdHealthScore.textContent = `${audit.score}%`;
      const ring = document.querySelector('.pwd-health-score-ring');
      if (ring) {
        if (audit.score >= 80) {
          ring.style.borderColor = '#10b981';
          ring.style.backgroundColor = '#ecfdf5';
          this.dom.pwdHealthScore.style.color = '#047857';
        } else if (audit.score >= 50) {
          ring.style.borderColor = '#f59e0b';
          ring.style.backgroundColor = '#fef3c7';
          this.dom.pwdHealthScore.style.color = '#b45309';
        } else {
          ring.style.borderColor = '#ef4444';
          ring.style.backgroundColor = '#fee2e2';
          this.dom.pwdHealthScore.style.color = '#dc2626';
        }
      }
    }

    if (this.dom.pwdHealthHeadline) {
      if (audit.alertsCount === 0) {
        this.dom.pwdHealthHeadline.textContent = 'Vault Health: Excellent';
        this.dom.pwdHealthSubline.textContent = 'All saved passwords meet high uniqueness and entropy standards.';
      } else {
        this.dom.pwdHealthHeadline.textContent = `Security Recommendations (${audit.alertsCount} Alerts)`;
        this.dom.pwdHealthSubline.textContent = 'Some accounts have weak or reused passwords that should be updated.';
      }
    }

    if (this.dom.pwdHealthBadges) {
      const weakBadgeClass = audit.weak.length > 0 ? 'badge-danger' : 'badge-safe';
      const reusedCount = audit.reused.reduce((acc, r) => acc + r.count, 0);
      const reusedBadgeClass = reusedCount > 0 ? 'badge-warn' : 'badge-safe';

      this.dom.pwdHealthBadges.innerHTML = `
        <span class="pwd-badge ${weakBadgeClass}">${audit.weak.length} Weak Passwords</span>
        <span class="pwd-badge ${reusedBadgeClass}">${reusedCount} Reused Accounts</span>
        <span class="pwd-badge badge-safe">${audit.total} Total Saved</span>
      `;
    }
  }

  showToast(message) {
    let toast = document.getElementById('mac-app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mac-app-toast';
      toast.className = 'mac-toast';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  /* ==========================================================================
     MAC OS TAB CONTEXT MENU CONTROLLER
     ========================================================================== */
  initTabContextMenu() {
    this.currentContextTabId = null;

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#tab-context-menu')) {
        this.closeTabContextMenu();
      }
    });

    if (this.dom.ctxPinTab) {
      this.dom.ctxPinTab.addEventListener('click', () => {
        if (this.currentContextTabId) {
          tabManager.togglePinTab(this.currentContextTabId);
          this.rebuildTabLists();
        }
        this.closeTabContextMenu();
      });
    }

    if (this.dom.ctxDuplicateTab) {
      this.dom.ctxDuplicateTab.addEventListener('click', () => {
        if (this.currentContextTabId) {
          tabManager.duplicateTab(this.currentContextTabId);
        }
        this.closeTabContextMenu();
      });
    }

    if (this.dom.ctxReloadTab) {
      this.dom.ctxReloadTab.addEventListener('click', () => {
        if (this.currentContextTabId) {
          this.engineAdapter.reload(this.currentContextTabId);
        }
        this.closeTabContextMenu();
      });
    }

    if (this.dom.ctxMuteTab) {
      this.dom.ctxMuteTab.addEventListener('click', () => {
        if (this.currentContextTabId) {
          tabManager.toggleMuteTab(this.currentContextTabId);
        }
        this.closeTabContextMenu();
      });
    }

    if (this.dom.ctxCloseTab) {
      this.dom.ctxCloseTab.addEventListener('click', () => {
        if (this.currentContextTabId) {
          tabManager.closeTab(this.currentContextTabId);
        }
        this.closeTabContextMenu();
      });
    }

    if (this.dom.ctxCloseOtherTabs) {
      this.dom.ctxCloseOtherTabs.addEventListener('click', () => {
        if (this.currentContextTabId) {
          tabManager.closeOtherTabs(this.currentContextTabId);
        }
        this.closeTabContextMenu();
      });
    }

    if (this.dom.ctxCloseTabsRight) {
      this.dom.ctxCloseTabsRight.addEventListener('click', () => {
        if (this.currentContextTabId) {
          tabManager.closeTabsToRight(this.currentContextTabId);
        }
        this.closeTabContextMenu();
      });
    }
  }

  openTabContextMenu(e, tabId) {
    if (!this.dom.tabContextMenu) return;
    this.currentContextTabId = tabId;
    const tab = tabManager.getTab(tabId);
    if (!tab) return;

    if (this.dom.ctxPinLabel) {
      this.dom.ctxPinLabel.textContent = tab.isPinned ? 'Unpin Tab' : 'Pin Tab';
    }

    if (this.dom.ctxMuteLabel) {
      this.dom.ctxMuteLabel.textContent = tab.isMuted ? 'Unmute Tab' : 'Mute Tab';
    }

    const menu = this.dom.tabContextMenu;
    menu.style.display = 'flex';

    // Position menu safely inside window viewport
    const menuWidth = 200;
    const menuHeight = 220;
    let left = e.clientX;
    let top = e.clientY;

    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
    if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  closeTabContextMenu() {
    if (this.dom.tabContextMenu) {
      this.dom.tabContextMenu.style.display = 'none';
      this.currentContextTabId = null;
    }
  }

  rebuildTabLists() {
    if (this.dom.tabsList) this.dom.tabsList.innerHTML = '';
    if (this.dom.horizontalTabsList) this.dom.horizontalTabsList.innerHTML = '';
    tabManager.getAllTabs().forEach(t => this.renderTabPill(t));
    const active = tabManager.getActiveTab();
    if (active) this.updateActiveTabUi(active.id, active);
  }

  /* ==========================================================================
     AUTO-SAVE PASSWORD PROMPT (macOS Native Floating Card)
     ========================================================================== */
  handleAutoSavePasswordPrompt(username, password, url) {
    if (!username || !password || !url) return;
    if (url.startsWith('about:') || url.startsWith('mynetwork://')) return;

    let domain = url;
    try {
      const parsed = new URL(url);
      domain = parsed.hostname;
    } catch(e) {}

    // Check if exact credential already exists
    const existing = passwordService.getForDomain(domain);
    const alreadySaved = existing.find(c => c.username === username && c.password === password);
    if (alreadySaved) return;

    // Check if user previously marked domain as never save
    const neverList = settingsService.get('passwordsNeverSaveDomains', []);
    if (neverList.includes(domain)) return;

    if (this.dom.macSavePwdBanner) {
      if (this.dom.savePwdDomainText) {
        this.dom.savePwdDomainText.textContent = `Save login for ${domain} to MyNetwork Keychain?`;
      }
      if (this.dom.savePwdUserVal) {
        this.dom.savePwdUserVal.textContent = username || 'Current Account';
      }
      if (this.dom.savePwdPassVal) {
        this.dom.savePwdPassVal.textContent = '••••••••••••';
      }

      this.dom.macSavePwdBanner.style.display = 'flex';

      // Bind confirm action
      if (this.dom.btnConfirmSavePwd) {
        this.dom.btnConfirmSavePwd.onclick = () => {
          passwordService.addCredential({
            url: url,
            title: domain,
            username: username,
            password: password,
            category: 'logins',
            notes: `Auto-saved from ${domain}`
          });
          this.dom.macSavePwdBanner.style.display = 'none';
          this.showToast('Password saved to Keychain!');
          this.renderPasswordsList();
          this.renderPasswordHealth();
        };
      }

      // Bind never action
      if (this.dom.btnNeverSavePwd) {
        this.dom.btnNeverSavePwd.onclick = () => {
          const list = settingsService.get('passwordsNeverSaveDomains', []);
          if (!list.includes(domain)) {
            list.push(domain);
            settingsService.set('passwordsNeverSaveDomains', list);
          }
          this.dom.macSavePwdBanner.style.display = 'none';
          this.showToast(`Never saving for ${domain}`);
        };
      }

      // Bind dismiss
      if (this.dom.btnDismissSavePwd) {
        this.dom.btnDismissSavePwd.onclick = () => {
          this.dom.macSavePwdBanner.style.display = 'none';
        };
      }
    }
  }
}

// Instantiate immediately or on DOM ready
function initShell() {
  if (typeof window !== 'undefined' && !window.myNetworkApp) {
    window.myNetworkApp = new MyNetworkShell();
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }
}

module.exports = { MyNetworkShell };

