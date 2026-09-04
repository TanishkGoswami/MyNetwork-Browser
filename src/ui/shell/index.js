// UI Shell - Main Renderer Controller (Clean Pure Light Mode Architecture)
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS, DEFAULT_NEWTAB_URL, LEGACY_NEWTAB_URL, SETTINGS_URL, LEGACY_SETTINGS_URL, HISTORY_URL, LEGACY_HISTORY_URL, BOOKMARKS_URL, LEGACY_BOOKMARKS_URL, PROJECTS_URL, LEGACY_PROJECTS_URL, BLANK_URL } = require('../../shared/constants');
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
const { bookmarkService, workspaceService } = require('../../features/bookmarks');
const { containerService } = require('../../features/containers');
const { omniboxService } = require('../../features/omnibox');

class MyNetworkShell {
  constructor() {
    this.initDomCache();
    this.engineAdapter = new WebviewAdapter(this.dom.webviewContainer);

    // History Controller State
    this.historyViewMode = 'date'; // 'date' | 'group' | 'tree'
    this.historySortBy = 'last-visited'; // 'by-date-site' | 'by-site' | 'by-date' | 'most-visited' | 'last-visited'
    this.historySelectedIds = new Set();
    this.historySearchQuery = '';
    this.activeContextItem = null;

    // Bookmarks Controller State
    this.currentBmFilter = { rootId: null, workspaceId: null, folderId: null, tag: null, isRead: null, query: '' };
    this.currentBmViewMode = 'grid'; // 'grid' | 'list'
    this.popoverActiveTags = [];
    this.activeBmContextItem = null;
    this.bmSelectedIds = new Set();

    // Projects Controller State
    this.projectsSearchQuery = '';
    this.activeTabContextMenuId = null;

    this.bindCoreEvents();
    this.bindFeatureEvents();
    this.bindUiInteractions();
    this.initKeybindings();
    this.initSettings();
    this.initHistoryController();
    this.initBookmarksController();
    this.initPasswordManager();
    this.initWorkspaceController();
    this.initProjectsOverviewController();
    this.initWorkspaceModal();
    this.initTabContextMenu();
    this.initSmartOmnibox();
    this.initClockAndGreeting();

    // Initial feature data population
    this.renderTasks();
    this.renderRecents();
    this.initScratchpad();
    this.initTimer();
    this.renderPasswordsList();
    this.renderPasswordHealth();
    this.renderBookmarksBar();
    this.renderNewTabShortcuts();

    // Restore Session Tabs or Start with initial tab
    this.restoreSessionOrStart();
  }

  restoreSessionOrStart() {
    const startupBehavior = settingsService.get('startupBehavior', 'restore_session');
    const saved = sessionService.loadSession();

    if (saved && saved.tabs && saved.tabs.length > 0 && startupBehavior !== 'newtab') {
      if (saved.activeWorkspaceId) {
        workspaceService.setActiveWorkspace(saved.activeWorkspaceId);
      }
      
      let targetTabToActivate = null;
      saved.tabs.forEach((t) => {
        const tab = tabManager.createTab(t.url, t.title, t.favicon, t.workspaceId || 'ws_default');
        if (t.isPinned) tabManager.pinTab(tab.id);
        if (t.id === saved.activeTabId || t.url === saved.activeTabUrl) {
          targetTabToActivate = tab;
        }
      });

      const activeWsTabs = tabManager.getTabsForWorkspace(workspaceService.getActiveWorkspaceId());
      if (targetTabToActivate && targetTabToActivate.workspaceId === workspaceService.getActiveWorkspaceId()) {
        tabManager.activateTab(targetTabToActivate.id);
      } else if (activeWsTabs.length > 0) {
        tabManager.activateTab(activeWsTabs[0].id);
      }
    } else {
      tabManager.createTab(DEFAULT_NEWTAB_URL, 'New Tab', null, workspaceService.getActiveWorkspaceId());
    }

    this.renderWorkspaceSidebar();
    this.renderWorkspaceTabs();
  }

  initDomCache() {
    this.dom = {
      sidebar: document.getElementById('sidebar'),
      tabsList: document.getElementById('tabs-list'),
      urlInput: document.getElementById('url-input'),
      omniboxEngineIcon: document.getElementById('omnibox-engine-icon'),
      omniboxDropdown: document.getElementById('omnibox-dropdown'),
      omniboxResultsList: document.getElementById('omnibox-results-list'),
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
      btnClearRecents: document.getElementById('btn-clear-recent') || document.getElementById('btn-clear-recents'),

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

      // Dedicated macOS History View DOM
      historyView: document.getElementById('history-view'),
      btnHistoryBack: document.getElementById('btn-history-back'),
      macHistorySearch: document.getElementById('mac-history-search'),
      btnHistoryClearSearch: document.getElementById('btn-history-clear-search'),
      btnHistoryViewDropdown: document.getElementById('btn-history-view-dropdown'),
      historyViewDropdownLabel: document.getElementById('history-view-dropdown-label'),
      historyViewMenu: document.getElementById('history-view-menu'),
      btnOpenClearHistoryDialog: document.getElementById('btn-open-clear-history-dialog'),
      tabModeDate: document.getElementById('tab-mode-date'),
      tabModeGroup: document.getElementById('tab-mode-group'),
      tabModeTree: document.getElementById('tab-mode-tree'),
      historyBatchBar: document.getElementById('history-batch-bar'),
      batchSelectedCount: document.getElementById('batch-selected-count'),
      btnBatchCancel: document.getElementById('btn-batch-cancel'),
      btnBatchDelete: document.getElementById('btn-batch-delete'),
      historyMainFeed: document.getElementById('history-main-feed'),
      clearHistoryDialog: document.getElementById('clear-history-dialog'),
      btnCloseClearHistoryDialog: document.getElementById('btn-close-clear-history-dialog'),
      btnCancelClearHistory: document.getElementById('btn-cancel-clear-history'),
      btnConfirmClearHistory: document.getElementById('btn-confirm-clear-history'),
      clearHistoryRangeSelect: document.getElementById('clear-history-range-select'),
      historyContextMenu: document.getElementById('history-context-menu'),
      ctxHistOpenTab: document.getElementById('ctx-hist-open-tab'),
      ctxHistOpenSplit: document.getElementById('ctx-hist-open-split'),
      ctxHistCopyLink: document.getElementById('ctx-hist-copy-link'),
      ctxHistFilterDomain: document.getElementById('ctx-hist-filter-domain'),
      ctxHistDelete: document.getElementById('ctx-hist-delete'),

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
      ctxCloseTabsRight: document.getElementById('ctx-close-tabs-right'),

      // Bookmarks & Workspaces DOM
      btnBookmark: document.getElementById('btn-bookmark'),
      btnBookmarkStarSvg: document.getElementById('btn-bookmark-star-svg'),
      bookmarkStarPopover: document.getElementById('bookmark-star-popover'),
      btnBmPopoverClose: document.getElementById('btn-bm-popover-close'),
      bmPopoverHeading: document.getElementById('bm-popover-heading'),
      bmPopoverName: document.getElementById('bm-popover-name'),
      bmPopoverUrl: document.getElementById('bm-popover-url'),
      bmPopoverFolderSelect: document.getElementById('bm-popover-folder-select'),
      btnBmPopoverNewFolder: document.getElementById('btn-bm-popover-new-folder'),
      bmPopoverNewFolderRow: document.getElementById('bm-popover-new-folder-row'),
      bmPopoverNewFolderInput: document.getElementById('bm-popover-new-folder-input'),
      btnBmPopoverCreateFolderConfirm: document.getElementById('btn-bm-popover-create-folder-confirm'),
      btnBmPopoverCreateFolderCancel: document.getElementById('btn-bm-popover-create-folder-cancel'),
      bmPopoverWsSelect: document.getElementById('bm-popover-ws-select'),
      bmPopoverDetectedBadge: document.getElementById('bm-popover-detected-badge'),
      bmPopoverTagsBox: document.getElementById('bm-popover-tags-box'),
      bmPopoverTagsInput: document.getElementById('bm-popover-tags-input'),
      bmPopoverFavCheck: document.getElementById('bm-popover-fav-check'),
      btnBmPopoverRemove: document.getElementById('btn-bm-popover-remove'),
      btnBmPopoverCancel: document.getElementById('btn-bm-popover-cancel'),
      btnBmPopoverSave: document.getElementById('btn-bm-popover-save'),

      bookmarksBar: document.getElementById('bookmarks-bar'),
      bookmarksBarItems: document.getElementById('bookmarks-bar-items'),
      btnBookmarksBarAdd: document.getElementById('btn-bookmarks-bar-add'),
      bookmarksBarDropdown: document.getElementById('bookmarks-bar-dropdown'),
      bmBarDropdownContent: document.getElementById('bm-bar-dropdown-content'),

      newtabShortcutsContainer: document.getElementById('newtab-shortcuts-container'),
      newtabShortcutsRow: document.getElementById('newtab-shortcuts-row'),
      newtabWorkspaceBoards: document.getElementById('newtab-workspace-boards'),
      newtabWorkspaceTabs: document.getElementById('newtab-workspace-tabs'),

      modalAddShortcut: document.getElementById('modal-add-shortcut'),
      formAddShortcut: document.getElementById('form-add-shortcut'),
      shortcutEditId: document.getElementById('shortcut-edit-id'),
      shortcutInputTitle: document.getElementById('shortcut-input-title'),
      shortcutInputUrl: document.getElementById('shortcut-input-url'),
      shortcutInputFolder: document.getElementById('shortcut-input-parent'),
      shortcutInputWs: document.getElementById('shortcut-input-ws'),
      shortcutInputTags: document.getElementById('shortcut-input-tags'),
      btnDeleteShortcut: document.getElementById('btn-delete-shortcut'),
      btnCloseShortcutModal: document.getElementById('btn-close-shortcut-modal'),
      btnCancelShortcutModal: document.getElementById('btn-cancel-shortcut-modal'),

      modalAddBmFolder: document.getElementById('modal-add-bm-folder'),
      formAddBmFolder: document.getElementById('form-add-bm-folder'),
      bmFolderEditId: document.getElementById('bm-folder-edit-id'),
      bmFolderInputTitle: document.getElementById('bm-folder-input-title'),
      bmFolderInputParent: document.getElementById('bm-folder-input-parent'),
      bmFolderColorOptions: document.getElementById('bm-folder-color-options'),
      btnDeleteBmFolder: document.getElementById('btn-delete-bm-folder'),
      btnCloseBmFolderModal: document.getElementById('btn-close-bm-folder-modal'),
      btnCancelBmFolderModal: document.getElementById('btn-cancel-bm-folder-modal'),

      bookmarksView: document.getElementById('bookmarks-view'),
      btnBookmarksBack: document.getElementById('btn-bookmarks-back'),
      macBookmarksSearch: document.getElementById('mac-bookmarks-search'),
      btnBookmarksClearSearch: document.getElementById('btn-bookmarks-clear-search'),
      btnBmAddNewFolder: document.getElementById('btn-bm-add-new-folder'),
      btnBmAddNewBookmark: document.getElementById('btn-bm-add-new-bookmark'),
      btnBmViewGrid: document.getElementById('btn-bm-view-grid'),
      btnBmViewList: document.getElementById('btn-bm-view-list'),
      bmMgrWorkspacesList: document.getElementById('bm-mgr-workspaces-list'),
      bmMgrFolderTree: document.getElementById('bm-mgr-folder-tree'),
      bmMgrTagsCloud: document.getElementById('bm-mgr-tags-cloud'),
      bmMgrBreadcrumbs: document.getElementById('bm-mgr-breadcrumbs'),
      bmMgrItemsContainer: document.getElementById('bm-mgr-items-container'),
      bmStatusText: document.getElementById('bm-status-text'),
      btnBmImportHtml: document.getElementById('btn-bm-import-html'),
      btnBmExportHtml: document.getElementById('btn-bm-export-html'),
      btnBmEmptyTrash: document.getElementById('btn-bm-empty-trash'),
      bookmarkContextMenu: document.getElementById('bookmark-context-menu'),
      bmBatchBar: document.getElementById('bm-batch-bar'),
      bmBatchCount: document.getElementById('bm-batch-count'),
      btnBmBatchSelectAll: document.getElementById('btn-bm-batch-select-all'),
      btnBmBatchTrash: document.getElementById('btn-bm-batch-trash'),
      bmBatchTrashLabel: document.getElementById('bm-batch-trash-label'),
      btnBmBatchRestore: document.getElementById('btn-bm-batch-restore'),
      btnBmBatchClear: document.getElementById('btn-bm-batch-clear'),
      ctxBmRestore: document.getElementById('ctx-bm-restore'),
      ctxBmDeleteLabel: document.getElementById('ctx-bm-delete-label'),
      ctxBmEditLabel: document.getElementById('ctx-bm-edit-label'),

      // Settings bookmark controls
      settingBookmarksBarMode: document.getElementById('setting-bookmarks-bar-mode'),
      settingNewtabBookmarksLayout: document.getElementById('setting-newtab-bookmarks-layout'),
      settingDefaultBookmarkFolder: document.getElementById('setting-default-bookmark-folder'),
      settingBookmarkOpenTarget: document.getElementById('setting-bookmark-open-target'),
      settingToggleWidgetScratchpad: document.getElementById('setting-toggle-widget-scratchpad'),
      settingToggleWidgetTasks: document.getElementById('setting-toggle-widget-tasks'),
      settingToggleWidgetTimer: document.getElementById('setting-toggle-widget-timer'),
      settingToggleWidgetRecent: document.getElementById('setting-toggle-widget-recent'),
      btnSettingsImportBm: document.getElementById('btn-settings-import-bm'),
      btnSettingsExportBm: document.getElementById('btn-settings-export-bm'),

      // Project Workspace DOM
      sidebarWsHeader: document.getElementById('sidebar-workspace-header'),
      sidebarWsSelect: document.getElementById('btn-sidebar-workspace-select'),
      sidebarActiveWsDot: document.getElementById('sidebar-active-ws-dot'),
      sidebarActiveWsName: document.getElementById('sidebar-active-ws-name'),
      sidebarWsDropdown: document.getElementById('sidebar-ws-dropdown'),
      sidebarWsDropdownList: document.getElementById('sidebar-ws-dropdown-list'),
      btnSidebarNewWs: document.getElementById('btn-sidebar-new-workspace'),
      workspaceQuickChips: document.getElementById('workspace-quick-chips'),
      btnManageProjectsNav: document.getElementById('btn-manage-projects-nav'),
      btnCreateProjectModalTrigger: document.getElementById('btn-create-project-modal-trigger'),
      btnWorkspaces: document.getElementById('btn-workspaces'),

      // Dedicated macOS Projects View DOM
      projectsView: document.getElementById('projects-view'),
      btnProjectsBack: document.getElementById('btn-projects-back'),
      macProjectsSearch: document.getElementById('mac-projects-search'),
      btnProjectsAddNew: document.getElementById('btn-projects-add-new'),
      projectsCardsContainer: document.getElementById('projects-cards-container'),
      projectsStatsBadge: document.getElementById('projects-stats-badge'),

      // Workspace Create / Edit Modal DOM
      modalCreateWorkspace: document.getElementById('modal-create-workspace'),
      formCreateWorkspace: document.getElementById('form-create-workspace'),
      workspaceFormId: document.getElementById('workspace-form-id'),
      workspaceFormName: document.getElementById('workspace-form-name'),
      workspaceFormDevUrl: document.getElementById('workspace-form-dev-url'),
      workspaceFormDesc: document.getElementById('workspace-form-desc'),
      workspaceColorPicker: document.getElementById('workspace-color-picker'),
      workspaceIconSelector: document.getElementById('workspace-icon-selector'),
      btnDeleteWorkspace: document.getElementById('btn-delete-workspace'),
      btnCloseWorkspaceModal: document.getElementById('btn-close-workspace-modal'),
      btnCancelWorkspaceModal: document.getElementById('btn-cancel-workspace-modal'),
      workspaceModalTitle: document.getElementById('workspace-modal-title'),

      // Tab Context Menu Submenu
      ctxWorkspaceSubmenu: document.getElementById('ctx-workspace-submenu'),
      ctxMoveWorkspaceItem: document.getElementById('ctx-move-workspace-item'),
      ctxContainerSubmenu: document.getElementById('ctx-container-submenu'),
      ctxReopenGhostTab: document.getElementById('ctx-reopen-ghost-tab'),
      btnAddGhostTab: document.getElementById('btn-add-ghost-tab')
    };
  }

  /* ==========================================================================
     CORE EVENT BINDINGS
     ========================================================================== */
  bindCoreEvents() {
    // Tab lifecycle
    eventBus.on(EVENTS.TAB_CREATED, ({ tab }) => {
      this.engineAdapter.createWebview(tab);
      const activeWsId = workspaceService.getActiveWorkspaceId();
      if ((tab.workspaceId || 'ws_default') === activeWsId) {
        this.renderTabPill(tab);
      }
      this.renderWorkspaceSidebar();
      sessionService.saveSession(tabManager.getAllTabs(), tabManager.activeTabId, activeWsId);
    });

    eventBus.on(EVENTS.TAB_ACTIVATED, ({ tabId, tab }) => {
      const activeTab = tab || tabManager.getTab(tabId);
      if (activeTab && activeTab.workspaceId && activeTab.workspaceId !== workspaceService.getActiveWorkspaceId()) {
        workspaceService.setActiveWorkspace(activeTab.workspaceId);
      }
      this.updateActiveTabUi(tabId, activeTab);
      sessionService.saveSession(tabManager.getAllTabs(), tabId, workspaceService.getActiveWorkspaceId());
    });

    eventBus.on(EVENTS.TAB_CLOSED, ({ tabId }) => {
      this.engineAdapter.removeWebview(tabId);
      const tabPill = document.getElementById(`tab-pill-${tabId}`);
      if (tabPill && tabPill.parentNode) tabPill.parentNode.removeChild(tabPill);
      const hTabPill = document.getElementById(`h-tab-pill-${tabId}`);
      if (hTabPill && hTabPill.parentNode) hTabPill.parentNode.removeChild(hTabPill);
      this.renderWorkspaceSidebar();
      sessionService.saveSession(tabManager.getAllTabs(), tabManager.activeTabId, workspaceService.getActiveWorkspaceId());
    });

    eventBus.on(EVENTS.TAB_UPDATED, ({ tabId, updates, tab }) => {
      const fullTab = tab || tabManager.getTab(tabId);
      const activeWsId = workspaceService.getActiveWorkspaceId();
      if (updates && updates.workspaceId) {
        // Tab moved to another workspace - refresh tab pills
        this.renderWorkspaceTabs();
        this.renderWorkspaceSidebar();
      } else if (fullTab && (fullTab.workspaceId || 'ws_default') === activeWsId) {
        this.updateTabPillDisplay(tabId, fullTab);
      }
      const activeTab = tabManager.getActiveTab();
      if (activeTab && activeTab.id === tabId) {
        if (updates && updates.url && updates.url !== DEFAULT_NEWTAB_URL && updates.url !== BLANK_URL && !updates.url.startsWith('mynetwork://')) {
          this.dom.urlInput.value = updates.url;
        }
        this.updateOmniboxIcon(activeTab);
        this.updateOmniboxStarState(activeTab);
      }
      sessionService.saveSession(tabManager.getAllTabs(), tabManager.activeTabId, activeWsId);
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
      const activeTab = tabManager.getActiveTab();
      if (activeTab && activeTab.id === tabId) {
        this.updateOmniboxStarState(activeTab);
        this.updateNavButtonsState(tabId);
      }
    });

    eventBus.on(EVENTS.NAV_FAIL, ({ tabId }) => {
      this.hideProgress();
      tabManager.updateTab(tabId, { isLoading: false });
      const activeTab = tabManager.getActiveTab();
      if (activeTab && activeTab.id === tabId) {
        this.updateNavButtonsState(tabId);
      }
    });

    eventBus.on('navigation:state-changed', ({ tabId, canGoBack, canGoForward }) => {
      const activeTab = tabManager.getActiveTab();
      if (activeTab && activeTab.id === tabId) {
        const btnBack = document.getElementById('btn-back');
        const btnForward = document.getElementById('btn-forward');
        if (btnBack) btnBack.classList.toggle('disabled', !canGoBack);
        if (btnForward) btnForward.classList.toggle('disabled', !canGoForward);
      }
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
      const activeTab = tabManager.getActiveTab();
      this.updateOmniboxIcon(activeTab);
    });

    eventBus.on('ui:sidebar-toggled', ({ isRail }) => {
      if (this.dom.sidebar) {
        this.dom.sidebar.classList.toggle('compact', isRail);
      }
      if (this.dom.sidebarToggleBtn) {
        this.dom.sidebarToggleBtn.classList.toggle('active', isRail);
      }
      const collapseBtn = document.getElementById('sidebar-collapse-icon-btn');
      if (collapseBtn) {
        collapseBtn.classList.toggle('active', isRail);
      }
    });

    eventBus.on('ui:splitview-toggled', ({ isSplit, layout = 'dual', tabIds = null }) => {
      const splitBtn = document.getElementById('btn-split-toggle');
      if (splitBtn) splitBtn.classList.toggle('active', isSplit);
      if (this.dom.webviewContainer) {
        this.dom.webviewContainer.classList.toggle('split-mode', isSplit);
        this.dom.webviewContainer.classList.toggle('split-triple', isSplit && layout === 'triple');
        this.dom.webviewContainer.classList.toggle('split-quad', isSplit && layout === 'quad');
      }
      this.updateSplitViewWebviews(isSplit, layout, tabIds || browserContext.splitTabIds);
    });

    eventBus.on('ui:ai-drawer-toggled', ({ isOpen }) => {
      if (this.dom.aiDrawer) {
        this.dom.aiDrawer.classList.toggle('open', isOpen);
      }
    });

    // Handle standard new tab opening from target="_blank" window.open in webviews
    ipcBridge.on('open-new-tab', (event, { url }) => {
      if (url && url !== 'about:blank' && !url.startsWith('mynetwork://')) {
        const activeWsId = workspaceService.getActiveWorkspaceId();
        tabManager.createTab(url, 'New Tab', null, activeWsId);
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

    eventBus.on(EVENTS.BOOKMARKS_UPDATED, () => {
      this.renderBookmarksBar();
      this.renderNewTabShortcuts();
      this.renderBookmarksManager();
      const activeTab = tabManager.getActiveTab();
      if (activeTab) this.updateOmniboxStarState(activeTab);
    });

    eventBus.on(EVENTS.WORKSPACE_CHANGED, () => {
      this.renderWorkspaceSidebar();
      this.renderWorkspaceTabs();
      this.renderBookmarksBar();
      this.renderNewTabShortcuts();
      this.renderBookmarksManager();
      if (this.dom.projectsView && this.dom.projectsView.style.display !== 'none') {
        this.renderProjectsDashboard();
      }
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
    if (this.dom.btnAddGhostTab) {
      this.dom.btnAddGhostTab.addEventListener('click', () => {
        tabManager.createTab(DEFAULT_NEWTAB_URL, 'Ghost Tab', null, null, null, true);
        this.showToast('👻 Opened Ghost Tab (Ephemeral in-memory session)');
      });
    }
    const sidebarAddBtn = document.getElementById('sidebar-rail-add-tab');
    if (sidebarAddBtn) {
      sidebarAddBtn.addEventListener('click', () => tabManager.createTab());
    }

    // Sidebar Rail Toggle
    if (this.dom.sidebarToggleBtn) {
      this.dom.sidebarToggleBtn.addEventListener('click', () => browserContext.toggleSidebarRail());
    }
    const sidebarCollapseIconBtn = document.getElementById('sidebar-collapse-icon-btn');
    if (sidebarCollapseIconBtn) {
      sidebarCollapseIconBtn.addEventListener('click', () => browserContext.toggleSidebarRail());
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

      this.dom.urlInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val.startsWith('mynetwork://') || val.startsWith('about:')) {
          this.updateOmniboxIcon({ url: val });
        } else if (val) {
          const currentEngine = browserContext.getCurrentEngine();
          if (this.dom.omniboxEngineIcon) {
            this.dom.omniboxEngineIcon.innerHTML = currentEngine.icon;
            this.dom.omniboxEngineIcon.title = `Search with ${currentEngine.name}`;
          }
        } else {
          const active = tabManager.getActiveTab();
          this.updateOmniboxIcon(active);
        }
      });

      this.dom.urlInput.addEventListener('blur', () => {
        const active = tabManager.getActiveTab();
        this.updateOmniboxIcon(active);
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

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ==========================================================================
     TAB RENDERING & NAVIGATION LOGIC
     ========================================================================== */
  renderWorkspaceTabs() {
    if (this.dom.tabsList) this.dom.tabsList.innerHTML = '';
    if (this.dom.horizontalTabsList) this.dom.horizontalTabsList.innerHTML = '';
    
    const activeWsId = workspaceService.getActiveWorkspaceId();
    const tabs = tabManager.getTabsForWorkspace(activeWsId);

    if (tabs.length === 0) {
      tabManager.createTab(DEFAULT_NEWTAB_URL, 'New Tab', null, activeWsId);
      return;
    }

    tabs.forEach(tab => {
      this.renderTabPill(tab);
    });

    const activeTab = tabManager.getActiveTab();
    if (!activeTab || (activeTab.workspaceId || 'ws_default') !== activeWsId) {
      tabManager.activateTab(tabs[0].id);
    } else {
      this.updateActiveTabUi(activeTab.id, activeTab);
    }
  }

  renderTabPill(tab) {
    const createPillEl = (prefix) => {
      const el = document.createElement('div');
      el.className = `tab-item ${tab.isPinned ? 'pinned' : ''}`;
      el.id = `${prefix}-${tab.id}`;
      
      const url = tab.url || '';
      const isNewTab = !url || url === BLANK_URL || url === DEFAULT_NEWTAB_URL || url === LEGACY_NEWTAB_URL;
      const isSettings = url === SETTINGS_URL || url === LEGACY_SETTINGS_URL || url.toLowerCase() === 'mynetwork://settings' || url.toLowerCase() === 'about:settings';
      const isHistory = url === HISTORY_URL || url === LEGACY_HISTORY_URL || url.toLowerCase() === 'mynetwork://history' || url.toLowerCase() === 'about:history';
      const isBookmarks = url === BOOKMARKS_URL || url === LEGACY_BOOKMARKS_URL || url.toLowerCase() === 'mynetwork://bookmarks' || url.toLowerCase() === 'about:bookmarks';
      const isProjects = url === PROJECTS_URL || url === LEGACY_PROJECTS_URL || url.toLowerCase() === 'mynetwork://projects' || url.toLowerCase() === 'about:projects';
      const isInternal = isNewTab || isSettings || isHistory || isBookmarks || isProjects || url.startsWith('mynetwork://') || url.startsWith('about:') || url.startsWith('chrome://');

      let displayTitle = 'New Tab';
      if (isSettings) displayTitle = 'Settings';
      else if (isHistory) displayTitle = 'History';
      else if (isBookmarks) displayTitle = 'Bookmarks';
      else if (isProjects) displayTitle = 'Projects';
      else if (isNewTab) displayTitle = 'New Tab';
      else displayTitle = (tab.title && tab.title !== 'about:blank') ? tab.title : (url || 'New Tab');

      const faviconHtml = (tab.favicon && !isInternal)
        ? `<img src="${tab.favicon}" alt="" width="14" height="14" class="tab-favicon-img" onerror="this.outerHTML='<svg width=\\'13\\' height=\\'13\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/><line x1=\\'2\\' y1=\\'12\\' x2=\\'22\\' y2=\\'12\\'/><path d=\\'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\\'/></svg>'">`
        : (isInternal
          ? `<img src="assets/icon-symbol.svg" alt="" width="14" height="14" class="tab-favicon-img" style="object-fit: contain;">`
          : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>`
        );

      let containerBadgeHtml = '';
      if (tab.isGhost) {
        el.classList.add('ghost-tab');
        containerBadgeHtml = `<span class="tab-ghost-badge" title="Disposable Ghost Tab (Session destroyed on close)">👻</span>`;
      } else if (tab.containerId) {
        const container = containerService.getContainer(tab.containerId);
        if (container) {
          el.classList.add('container-tab');
          containerBadgeHtml = `<span class="tab-container-dot" style="background: ${container.color};" title="Container: ${container.name}"></span>`;
        }
      }

      el.innerHTML = `
        <div class="tab-favicon">${faviconHtml}</div>
        <span class="tab-title" title="${displayTitle}">${displayTitle}</span>
        ${containerBadgeHtml}
        ${tab.isPinned ? `<span class="tab-pin-indicator" title="Pinned Tab"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24V17z"/></svg></span>` : ''}
        <button class="tab-close-btn" title="Close Tab">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;

      el.setAttribute('draggable', 'true');

      // Drag & Drop Tab Reordering (Mac/Arc style tab positioning)
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', tab.id);
        e.dataTransfer.effectAllowed = 'move';
        el.classList.add('dragging');
      });

      el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          el.classList.add('drag-over-top');
          el.classList.remove('drag-over-bottom');
        } else {
          el.classList.add('drag-over-bottom');
          el.classList.remove('drag-over-top');
        }
      });

      el.addEventListener('dragleave', () => {
        el.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      el.addEventListener('drop', (e) => {
        e.preventDefault();
        const sourceTabId = e.dataTransfer.getData('text/plain');
        el.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
        if (!sourceTabId || sourceTabId === tab.id) return;

        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertBefore = e.clientY < midY;

        tabManager.moveTab(sourceTabId, tab.id, insertBefore);
        this.renderWorkspaceTabs();
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        document.querySelectorAll('.tab-item').forEach(item => {
          item.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        });
      });

      el.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close-btn')) return;

        // Ctrl + Click (or Cmd + Click on macOS) toggles Split Screen Grouping
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          browserContext.toggleSplitTab(tab.id);
          return;
        }

        tabManager.activateTab(tab.id);
      });

      // Right-Click Context Menu
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openTabContextMenu(e, tab.id);
      });

      const closeBtn = el.querySelector('.tab-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          tabManager.closeTab(tab.id);
        });
      }

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

  updateOmniboxIcon(tab) {
    if (!this.dom.omniboxEngineIcon) return;

    const url = tab ? (tab.url || '') : '';
    const isInternal = !url || 
      url === BLANK_URL || 
      url === DEFAULT_NEWTAB_URL || 
      url === LEGACY_NEWTAB_URL || 
      url === SETTINGS_URL || 
      url === LEGACY_SETTINGS_URL || 
      url === HISTORY_URL || 
      url === LEGACY_HISTORY_URL || 
      url === BOOKMARKS_URL || 
      url === LEGACY_BOOKMARKS_URL || 
      url === PROJECTS_URL ||
      url === LEGACY_PROJECTS_URL ||
      url.startsWith('mynetwork://') || 
      url.startsWith('about:') || 
      url.startsWith('chrome://');

    const browserLogoHtml = `
      <img src="assets/icon-symbol.svg" width="16" height="16" alt="MyNetwork" style="display: block; object-fit: contain;">
    `;

    if (isInternal) {
      this.dom.omniboxEngineIcon.innerHTML = browserLogoHtml;
      this.dom.omniboxEngineIcon.title = 'MyNetwork Internal Page';
      return;
    }

    if (tab && tab.favicon) {
      this.dom.omniboxEngineIcon.innerHTML = `<img src="${tab.favicon}" width="14" height="14" style="border-radius: 3px; object-fit: contain;" onerror="this.parentElement.innerHTML='<svg width=\\'13\\' height=\\'13\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#10b981\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'11\\' width=\\'18\\' height=\\'11\\' rx=\\'2\\' ry=\\'2\\'/><path d=\\'M7 11V7a5 5 0 0 1 10 0v4\\'/></svg>'">`;
      this.dom.omniboxEngineIcon.title = 'Secure Connection';
      return;
    }

    if (url.startsWith('https://')) {
      this.dom.omniboxEngineIcon.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      `;
      this.dom.omniboxEngineIcon.title = 'Connection is secure (HTTPS)';
      return;
    }

    const currentEngine = browserContext.getCurrentEngine();
    this.dom.omniboxEngineIcon.innerHTML = currentEngine.icon;
    this.dom.omniboxEngineIcon.title = `Search with ${currentEngine.name}`;
  }

  updateActiveTabUi(tabId, tab) {
    this.updateOmniboxIcon(tab);

    document.querySelectorAll('.tab-item').forEach(el => {
      const elTabId = el.id.replace('tab-pill-', '').replace('h-tab-pill-', '');
      const isSplitGrouped = browserContext.isSplitView && browserContext.splitTabIds && browserContext.splitTabIds.includes(elTabId);
      const isCurrentActive = el.id === `tab-pill-${tabId}` || el.id === `h-tab-pill-${tabId}`;
      el.classList.toggle('active', isCurrentActive);
      el.classList.toggle('split-grouped', !!isSplitGrouped);
      el.classList.toggle('split-active', !!isSplitGrouped && isCurrentActive);
    });

    const isSettings = tab.url === SETTINGS_URL || tab.url === LEGACY_SETTINGS_URL;
    const isHistory = tab.url === HISTORY_URL || tab.url === LEGACY_HISTORY_URL;
    const isBookmarks = tab.url === BOOKMARKS_URL || tab.url === LEGACY_BOOKMARKS_URL;
    const isProjects = tab.url === PROJECTS_URL || tab.url === LEGACY_PROJECTS_URL || tab.url.toLowerCase() === 'mynetwork://projects' || tab.url.toLowerCase() === 'about:projects';
    const isNewTab = tab.url === DEFAULT_NEWTAB_URL || tab.url === LEGACY_NEWTAB_URL || tab.url === BLANK_URL;

    if (isSettings) {
      if (this.dom.sidebar) this.dom.sidebar.style.display = 'none';
      if (this.dom.horizontalTabsBar) this.dom.horizontalTabsBar.style.display = 'none';
      if (this.dom.newTabView) this.dom.newTabView.style.display = 'none';
      if (this.dom.historyView) this.dom.historyView.style.display = 'none';
      if (this.dom.bookmarksView) this.dom.bookmarksView.style.display = 'none';
      if (this.dom.projectsView) this.dom.projectsView.style.display = 'none';
      if (this.dom.settingsView) this.dom.settingsView.style.display = 'flex';
      this.dom.urlInput.value = 'mynetwork://settings';
      document.querySelectorAll('.browser-webview').forEach(wv => wv.classList.remove('active'));
      this.populateSettingsForm();
      this.renderSettingsHistory();
    } else if (isHistory) {
      if (this.dom.sidebar) this.dom.sidebar.style.display = 'none';
      if (this.dom.horizontalTabsBar) this.dom.horizontalTabsBar.style.display = 'none';
      if (this.dom.newTabView) this.dom.newTabView.style.display = 'none';
      if (this.dom.settingsView) this.dom.settingsView.style.display = 'none';
      if (this.dom.bookmarksView) this.dom.bookmarksView.style.display = 'none';
      if (this.dom.projectsView) this.dom.projectsView.style.display = 'none';
      if (this.dom.historyView) this.dom.historyView.style.display = 'flex';
      this.dom.urlInput.value = 'mynetwork://history';
      document.querySelectorAll('.browser-webview').forEach(wv => wv.classList.remove('active'));
      this.renderHistoryView();
    } else if (isBookmarks) {
      if (this.dom.sidebar) this.dom.sidebar.style.display = 'none';
      if (this.dom.horizontalTabsBar) this.dom.horizontalTabsBar.style.display = 'none';
      if (this.dom.newTabView) this.dom.newTabView.style.display = 'none';
      if (this.dom.settingsView) this.dom.settingsView.style.display = 'none';
      if (this.dom.historyView) this.dom.historyView.style.display = 'none';
      if (this.dom.projectsView) this.dom.projectsView.style.display = 'none';
      if (this.dom.bookmarksView) this.dom.bookmarksView.style.display = 'flex';
      this.dom.urlInput.value = 'mynetwork://bookmarks';
      document.querySelectorAll('.browser-webview').forEach(wv => wv.classList.remove('active'));
      this.renderBookmarksManager();
    } else if (isProjects) {
      if (this.dom.sidebar) this.dom.sidebar.style.display = 'none';
      if (this.dom.horizontalTabsBar) this.dom.horizontalTabsBar.style.display = 'none';
      if (this.dom.newTabView) this.dom.newTabView.style.display = 'none';
      if (this.dom.settingsView) this.dom.settingsView.style.display = 'none';
      if (this.dom.historyView) this.dom.historyView.style.display = 'none';
      if (this.dom.bookmarksView) this.dom.bookmarksView.style.display = 'none';
      if (this.dom.projectsView) this.dom.projectsView.style.display = 'flex';
      this.dom.urlInput.value = 'mynetwork://projects';
      document.querySelectorAll('.browser-webview').forEach(wv => wv.classList.remove('active'));
      this.renderProjectsDashboard();
    } else {
      const currentLayout = settingsService.get('tabLayout', 'vertical');
      this.applyTabLayout(currentLayout);

      if (this.dom.settingsView) this.dom.settingsView.style.display = 'none';
      if (this.dom.historyView) this.dom.historyView.style.display = 'none';
      if (this.dom.bookmarksView) this.dom.bookmarksView.style.display = 'none';
      if (this.dom.projectsView) this.dom.projectsView.style.display = 'none';

      if (browserContext.isSplitView && browserContext.splitTabIds && browserContext.splitTabIds.includes(tabId)) {
        if (this.dom.newTabView) this.dom.newTabView.style.display = 'none';
        this.dom.urlInput.value = (tab.url && tab.url !== DEFAULT_NEWTAB_URL && tab.url !== BLANK_URL) ? tab.url : '';
        this.updateSplitViewWebviews(true, 'dual', browserContext.splitTabIds);
      } else if (isNewTab) {
        if (this.dom.newTabView) this.dom.newTabView.style.display = 'flex';
        this.dom.urlInput.value = '';
        this.dom.urlInput.placeholder = browserContext.getCurrentEngine().placeholder;
        document.querySelectorAll('.browser-webview').forEach(wv => wv.classList.remove('active'));
        this.renderNewTabShortcuts();
      } else {
        if (this.dom.newTabView) this.dom.newTabView.style.display = 'none';
        this.dom.urlInput.value = tab.url;
        this.engineAdapter.showWebview(tabId);
      }
    }

    this.updateOmniboxStarState(tab);
    this.renderBookmarksBar();
    this.updateNavButtonsState(tabId);
  }

  updateTabPillDisplay(tabId, tab) {
    const updateEl = (el) => {
      if (!el || !tab) return;
      el.classList.toggle('pinned', !!tab.isPinned);
      const titleEl = el.querySelector('.tab-title');
      const url = tab.url || '';
      const isNewTab = !url || url === BLANK_URL || url === DEFAULT_NEWTAB_URL || url === LEGACY_NEWTAB_URL;
      const isSettings = url === SETTINGS_URL || url === LEGACY_SETTINGS_URL || url.toLowerCase() === 'mynetwork://settings' || url.toLowerCase() === 'about:settings';
      const isHistory = url === HISTORY_URL || url === LEGACY_HISTORY_URL || url.toLowerCase() === 'mynetwork://history' || url.toLowerCase() === 'about:history';
      const isBookmarks = url === BOOKMARKS_URL || url === LEGACY_BOOKMARKS_URL || url.toLowerCase() === 'mynetwork://bookmarks' || url.toLowerCase() === 'about:bookmarks';
      const isProjects = url === PROJECTS_URL || url === LEGACY_PROJECTS_URL || url.toLowerCase() === 'mynetwork://projects' || url.toLowerCase() === 'about:projects';
      const isInternal = isNewTab || isSettings || isHistory || isBookmarks || isProjects || url.startsWith('mynetwork://') || url.startsWith('about:') || url.startsWith('chrome://');

      let displayTitle = 'New Tab';
      if (isSettings) displayTitle = 'Settings';
      else if (isHistory) displayTitle = 'History';
      else if (isBookmarks) displayTitle = 'Bookmarks';
      else if (isProjects) displayTitle = 'Projects';
      else if (isNewTab) displayTitle = 'New Tab';
      else displayTitle = (tab.title && tab.title !== 'about:blank') ? tab.title : (url || 'New Tab');
      
      if (titleEl) {
        titleEl.textContent = displayTitle;
        titleEl.title = displayTitle;
      }

      const faviconEl = el.querySelector('.tab-favicon');
      if (faviconEl) {
        if (tab.favicon && !isInternal) {
          faviconEl.innerHTML = `<img src="${tab.favicon}" alt="" width="14" height="14" class="tab-favicon-img" onerror="this.outerHTML='<svg width=\\'13\\' height=\\'13\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/><line x1=\\'2\\' y1=\\'12\\' x2=\\'22\\' y2=\\'12\\'/><path d=\\'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\\'/></svg>'">`;
        } else if (isInternal) {
          faviconEl.innerHTML = `<img src="assets/icon-symbol.svg" alt="" width="14" height="14" class="tab-favicon-img" style="object-fit: contain;">`;
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
    if (!query || typeof query !== 'string' || query === 'undefined' || !query.trim()) {
      return;
    }
    const activeTab = tabManager.getActiveTab();
    if (!activeTab) return;

    let targetUrl = query.trim();
    if (targetUrl.toLowerCase() === 'mynetwork://settings' || targetUrl.toLowerCase() === 'about:settings') {
      tabManager.updateTab(activeTab.id, { url: SETTINGS_URL, title: 'Settings' });
      this.updateActiveTabUi(activeTab.id, tabManager.getActiveTab());
      return;
    }

    if (targetUrl.toLowerCase() === 'mynetwork://history' || targetUrl.toLowerCase() === 'about:history' || targetUrl.toLowerCase() === 'chrome://history') {
      tabManager.updateTab(activeTab.id, { url: HISTORY_URL, title: 'History' });
      this.updateActiveTabUi(activeTab.id, tabManager.getActiveTab());
      return;
    }

    if (targetUrl.toLowerCase() === 'mynetwork://bookmarks' || targetUrl.toLowerCase() === 'about:bookmarks' || targetUrl.toLowerCase() === 'chrome://bookmarks') {
      tabManager.updateTab(activeTab.id, { url: BOOKMARKS_URL, title: 'Bookmarks' });
      this.updateActiveTabUi(activeTab.id, tabManager.getActiveTab());
      return;
    }

    if (targetUrl.toLowerCase() === 'mynetwork://projects' || targetUrl.toLowerCase() === 'about:projects' || targetUrl.toLowerCase() === 'chrome://projects' || targetUrl.toLowerCase() === 'projects') {
      tabManager.updateTab(activeTab.id, { url: PROJECTS_URL, title: 'Projects' });
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

    if (this.dom.newTabView) this.dom.newTabView.style.display = 'none';
    if (this.dom.settingsView) this.dom.settingsView.style.display = 'none';
    if (this.dom.historyView) this.dom.historyView.style.display = 'none';
    if (this.dom.bookmarksView) this.dom.bookmarksView.style.display = 'none';
    if (this.dom.projectsView) this.dom.projectsView.style.display = 'none';
    if (this.dom.urlInput) this.dom.urlInput.value = targetUrl;
    
    this.engineAdapter.navigate(activeTab.id, targetUrl);
    this.engineAdapter.showWebview(activeTab.id);
    this.updateActiveTabUi(activeTab.id, tabManager.getTab(activeTab.id));
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

  renderRecents() {
    if (!this.dom.recentLinksList) return;
    this.dom.recentLinksList.innerHTML = '';

    const recents = historyService.getRecent(8);
    if (recents.length === 0) {
      this.dom.recentLinksList.innerHTML = `<div style="text-align:center; padding: 14px; color: #94a3b8; font-size:11.5px;">No recently visited pages yet</div>`;
      return;
    }

    recents.forEach(item => {
      const itemEl = document.createElement('div');
      itemEl.className = 'recent-item';
      
      const faviconHtml = item.favicon 
        ? `<img src="${item.favicon}" alt="" width="14" height="14" class="recent-favicon" onerror="this.outerHTML='<svg width=\\'13\\' height=\\'13\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#64748b\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/><line x1=\\'2\\' y1=\\'12\\' x2=\\'22\\' y2=\\'12\\'/><path d=\\'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\\'/></svg>'">`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

      itemEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
          <div style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${faviconHtml}</div>
          <span class="recent-item-title" title="${item.url}">${item.title || item.url}</span>
        </div>
        <span class="recent-item-time">${item.time || ''}</span>
      `;

      itemEl.addEventListener('click', () => {
        tabManager.createTab(item.url, item.title || item.url);
      });

      this.dom.recentLinksList.appendChild(itemEl);
    });

    if (this.dom.btnClearRecents && !this.dom.btnClearRecents._bound) {
      this.dom.btnClearRecents._bound = true;
      this.dom.btnClearRecents.addEventListener('click', () => {
        this.toggleClearHistoryDialog(true);
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

  updateNavButtonsState(tabId) {
    const btnBack = document.getElementById('btn-back');
    const btnForward = document.getElementById('btn-forward');
    if (!tabId) {
      if (btnBack) btnBack.classList.add('disabled');
      if (btnForward) btnForward.classList.add('disabled');
      return;
    }
    const webview = this.engineAdapter?.webviewMap?.get(tabId);
    if (webview && typeof webview.canGoBack === 'function') {
      if (btnBack) btnBack.classList.toggle('disabled', !webview.canGoBack());
      if (btnForward) btnForward.classList.toggle('disabled', !webview.canGoForward());
    } else {
      if (btnBack) btnBack.classList.add('disabled');
      if (btnForward) btnForward.classList.add('disabled');
    }
  }

  showProgress(percentage) {
    if (this.dom.progressBar) {
      const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
      this.dom.progressBar.style.opacity = '1';
      this.dom.progressBar.style.width = `${pct}%`;
      if (pct >= 100) {
        if (this._progressTimeout) clearTimeout(this._progressTimeout);
        this._progressTimeout = setTimeout(() => {
          this.hideProgress();
        }, 260);
      }
    }
  }

  hideProgress() {
    if (this._progressTimeout) clearTimeout(this._progressTimeout);
    if (this.dom.progressBar) {
      this.dom.progressBar.style.opacity = '0';
      setTimeout(() => {
        if (this.dom.progressBar && this.dom.progressBar.style.opacity === '0') {
          this.dom.progressBar.style.width = '0%';
        }
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

    keybindingManager.register('ctrl+shift+g', {
      id: 'tab:new-ghost',
      label: 'New Disposable Ghost Tab',
      category: 'Tabs & Windows',
      handler: () => {
        tabManager.createTab(DEFAULT_NEWTAB_URL, 'Ghost Tab', null, null, null, true);
        this.showToast('👻 Opened Ghost Tab (Ephemeral in-memory session)');
      }
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
      id: 'nav:smart-omnibox',
      label: 'Smart Omnibox Command Center',
      category: 'Navigation',
      handler: () => {
        if (this.dom.urlInput) {
          this.dom.urlInput.focus();
          this.dom.urlInput.select();
          this.triggerOmniboxSearch(this.dom.urlInput.value || '>');
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

    keybindingManager.register('ctrl+h', {
      id: 'feature:open-history',
      label: 'Open Browsing History',
      category: 'General',
      handler: () => this.openHistoryTab()
    });

    keybindingManager.register('ctrl+b', {
      id: 'feature:open-bookmarks',
      label: 'Open Bookmarks & Workspaces',
      category: 'General',
      handler: () => this.openBookmarksTab()
    });

    keybindingManager.register('ctrl+d', {
      id: 'feature:bookmark-active-tab',
      label: 'Bookmark Active Tab',
      category: 'General',
      handler: () => this.toggleBookmarkPopover()
    });

    keybindingManager.register('ctrl+shift+b', {
      id: 'ui:toggle-bookmarks-bar',
      label: 'Toggle Favorites Bar',
      category: 'Workspace & Layout',
      handler: () => this.toggleBookmarksBar()
    });

    keybindingManager.register('escape', {
      id: 'ui:dismiss',
      label: 'Dismiss Overlay / Blur',
      category: 'General',
      handler: () => {
        this.toggleShortcutsModal(false);
        this.toggleClearHistoryDialog(false);
        this.closeBookmarkPopover();
        browserContext.toggleAiDrawer(false);
        if (this.dom.historyContextMenu) this.dom.historyContextMenu.style.display = 'none';
        if (this.dom.bookmarkContextMenu) this.dom.bookmarkContextMenu.style.display = 'none';
        if (this.dom.bookmarksBarDropdown) this.dom.bookmarksBarDropdown.style.display = 'none';
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

    keybindingManager.register('ctrl+shift+p', {
      id: 'feature:open-projects',
      label: 'Open Project Workspaces Board',
      category: 'Workspace & Layout',
      handler: () => this.openProjectsTab()
    });

    for (let i = 1; i <= 6; i++) {
      keybindingManager.register(`alt+${i}`, {
        id: `workspace:switch-${i}`,
        label: `Switch to Project Workspace ${i}`,
        category: 'Workspace & Layout',
        handler: () => this.switchToWorkspaceByIndex(i - 1)
      });
    }

    keybindingManager.register('ctrl+shift+[', {
      id: 'workspace:prev',
      label: 'Previous Project Workspace',
      category: 'Workspace & Layout',
      handler: () => this.cycleWorkspace(-1)
    });

    keybindingManager.register('ctrl+shift+]', {
      id: 'workspace:next',
      label: 'Next Project Workspace',
      category: 'Workspace & Layout',
      handler: () => this.cycleWorkspace(1)
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
    } else if (category === 'bookmarks') {
      this.populateBookmarkSettings();
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

  /* ==========================================================================
     DEDICATED macOS BROWSING HISTORY CONTROLLER
     ========================================================================== */
  openHistoryTab(mode = 'date') {
    this.historyViewMode = mode;
    const existing = tabManager.getTabs().find(t => t.url === HISTORY_URL || t.url === LEGACY_HISTORY_URL);
    if (existing) {
      tabManager.activateTab(existing.id);
    } else {
      tabManager.createTab(HISTORY_URL, 'History');
    }
    this.updateHistorySegmentButtons();
    this.renderHistoryView();
  }

  initHistoryController() {
    // 1. History Back Button
    if (this.dom.btnHistoryBack) {
      this.dom.btnHistoryBack.addEventListener('click', () => {
        const active = tabManager.getActiveTab();
        const nonHistoryTab = tabManager.getTabs().find(t => t.url !== HISTORY_URL && t.url !== LEGACY_HISTORY_URL && t.url !== SETTINGS_URL && t.url !== LEGACY_SETTINGS_URL);
        if (nonHistoryTab) {
          tabManager.activateTab(nonHistoryTab.id);
        } else {
          tabManager.createTab(DEFAULT_NEWTAB_URL, 'New Tab');
          if (active) tabManager.closeTab(active.id);
        }
      });
    }

    // 2. Search History Input
    if (this.dom.macHistorySearch) {
      this.dom.macHistorySearch.addEventListener('input', (e) => {
        this.historySearchQuery = e.target.value.trim();
        if (this.dom.btnHistoryClearSearch) {
          this.dom.btnHistoryClearSearch.style.display = this.historySearchQuery ? 'flex' : 'none';
        }
        this.renderHistoryView();
      });
    }

    if (this.dom.btnHistoryClearSearch) {
      this.dom.btnHistoryClearSearch.addEventListener('click', () => {
        if (this.dom.macHistorySearch) {
          this.dom.macHistorySearch.value = '';
          this.dom.macHistorySearch.focus();
        }
        this.historySearchQuery = '';
        this.dom.btnHistoryClearSearch.style.display = 'none';
        this.renderHistoryView();
      });
    }

    // 3. Segmented Mode Switches (By Date, By Group, Tree View)
    if (this.dom.tabModeDate) {
      this.dom.tabModeDate.addEventListener('click', () => {
        this.historyViewMode = 'date';
        this.updateHistorySegmentButtons();
        this.renderHistoryView();
      });
    }

    if (this.dom.tabModeGroup) {
      this.dom.tabModeGroup.addEventListener('click', () => {
        this.historyViewMode = 'group';
        this.updateHistorySegmentButtons();
        this.renderHistoryView();
      });
    }

    if (this.dom.tabModeTree) {
      this.dom.tabModeTree.addEventListener('click', () => {
        this.historyViewMode = 'tree';
        this.updateHistorySegmentButtons();
        this.renderHistoryView();
      });
    }

    // 4. View Dropdown Menu
    if (this.dom.btnHistoryViewDropdown && this.dom.historyViewMenu) {
      this.dom.btnHistoryViewDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dom.historyViewMenu.classList.toggle('active');
      });

      document.querySelectorAll('.history-view-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const viewType = item.getAttribute('data-view');
          this.setHistoryViewSort(viewType);
          this.dom.historyViewMenu.classList.remove('active');
        });
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.history-view-dropdown-container')) {
          this.dom.historyViewMenu.classList.remove('active');
        }
      });
    }

    // 5. Batch Selection Actions
    if (this.dom.btnBatchCancel) {
      this.dom.btnBatchCancel.addEventListener('click', () => {
        this.historySelectedIds.clear();
        this.updateHistoryBatchBar();
        document.querySelectorAll('.mac-history-checkbox').forEach(cb => cb.checked = false);
        document.querySelectorAll('.mac-history-item-row').forEach(r => r.classList.remove('selected'));
      });
    }

    if (this.dom.btnBatchDelete) {
      this.dom.btnBatchDelete.addEventListener('click', () => {
        if (this.historySelectedIds.size === 0) return;
        historyService.removeItems(Array.from(this.historySelectedIds));
        this.historySelectedIds.clear();
        this.updateHistoryBatchBar();
        this.renderHistoryView();
        this.renderSettingsHistory();
        this.renderRecents();
      });
    }

    // 6. Clear Browsing Data Dialog (macOS sheet)
    if (this.dom.btnOpenClearHistoryDialog) {
      this.dom.btnOpenClearHistoryDialog.addEventListener('click', () => {
        this.toggleClearHistoryDialog(true);
      });
    }

    if (this.dom.btnCloseClearHistoryDialog) {
      this.dom.btnCloseClearHistoryDialog.addEventListener('click', () => {
        this.toggleClearHistoryDialog(false);
      });
    }

    if (this.dom.btnCancelClearHistory) {
      this.dom.btnCancelClearHistory.addEventListener('click', () => {
        this.toggleClearHistoryDialog(false);
      });
    }

    if (this.dom.btnConfirmClearHistory) {
      this.dom.btnConfirmClearHistory.addEventListener('click', () => {
        const range = this.dom.clearHistoryRangeSelect ? this.dom.clearHistoryRangeSelect.value : 'all';
        historyService.clearRange(range);
        this.toggleClearHistoryDialog(false);
        this.historySelectedIds.clear();
        this.updateHistoryBatchBar();
        this.renderHistoryView();
        this.renderSettingsHistory();
        this.renderRecents();
      });
    }

    // 7. Context Menu Event Listeners
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#history-context-menu')) {
        if (this.dom.historyContextMenu) this.dom.historyContextMenu.style.display = 'none';
      }
    });

    if (this.dom.ctxHistOpenTab) {
      this.dom.ctxHistOpenTab.addEventListener('click', () => {
        if (this.activeContextItem) {
          tabManager.createTab(this.activeContextItem.url, this.activeContextItem.title || this.activeContextItem.url);
        }
        if (this.dom.historyContextMenu) this.dom.historyContextMenu.style.display = 'none';
      });
    }

    if (this.dom.ctxHistOpenSplit) {
      this.dom.ctxHistOpenSplit.addEventListener('click', () => {
        if (this.activeContextItem) {
          browserContext.toggleSplitView(true);
        }
        if (this.dom.historyContextMenu) this.dom.historyContextMenu.style.display = 'none';
      });
    }

    if (this.dom.ctxHistCopyLink) {
      this.dom.ctxHistCopyLink.addEventListener('click', () => {
        if (this.activeContextItem && this.activeContextItem.url) {
          navigator.clipboard.writeText(this.activeContextItem.url);
        }
        if (this.dom.historyContextMenu) this.dom.historyContextMenu.style.display = 'none';
      });
    }

    if (this.dom.ctxHistFilterDomain) {
      this.dom.ctxHistFilterDomain.addEventListener('click', () => {
        if (this.activeContextItem && this.activeContextItem.domain) {
          this.historySearchQuery = this.activeContextItem.domain;
          if (this.dom.macHistorySearch) this.dom.macHistorySearch.value = this.activeContextItem.domain;
          if (this.dom.btnHistoryClearSearch) this.dom.btnHistoryClearSearch.style.display = 'flex';
          this.renderHistoryView();
        }
        if (this.dom.historyContextMenu) this.dom.historyContextMenu.style.display = 'none';
      });
    }

    if (this.dom.ctxHistDelete) {
      this.dom.ctxHistDelete.addEventListener('click', () => {
        if (this.activeContextItem) {
          historyService.removeItem(this.activeContextItem.id);
          this.renderHistoryView();
          this.renderSettingsHistory();
          this.renderRecents();
        }
        if (this.dom.historyContextMenu) this.dom.historyContextMenu.style.display = 'none';
      });
    }

    // 8. EventBus History Update Listener
    eventBus.on(EVENTS.HISTORY_UPDATED, () => {
      const active = tabManager.getActiveTab();
      if (active && (active.url === HISTORY_URL || active.url === LEGACY_HISTORY_URL)) {
        this.renderHistoryView();
      }
      this.renderRecents();
      this.renderSettingsHistory();
    });
  }

  setHistoryViewSort(viewType) {
    document.querySelectorAll('.history-view-menu-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewType);
    });

    const labelMap = {
      'by-date-site': 'By Date and Site',
      'by-site': 'By Site',
      'by-date': 'By Date',
      'most-visited': 'By Most Visited',
      'last-visited': 'By Last Visited'
    };

    if (this.dom.historyViewDropdownLabel && labelMap[viewType]) {
      this.dom.historyViewDropdownLabel.textContent = labelMap[viewType];
    }

    if (viewType === 'by-site') {
      this.historyViewMode = 'group';
      this.historySortBy = 'by-site';
    } else if (viewType === 'by-date-site') {
      this.historyViewMode = 'tree';
      this.historySortBy = 'by-date-site';
    } else if (viewType === 'most-visited') {
      this.historyViewMode = 'date';
      this.historySortBy = 'most-visited';
    } else {
      this.historyViewMode = 'date';
      this.historySortBy = viewType;
    }

    this.updateHistorySegmentButtons();
    this.renderHistoryView();
  }

  updateHistorySegmentButtons() {
    if (this.dom.tabModeDate) this.dom.tabModeDate.classList.toggle('active', this.historyViewMode === 'date');
    if (this.dom.tabModeGroup) this.dom.tabModeGroup.classList.toggle('active', this.historyViewMode === 'group');
    if (this.dom.tabModeTree) this.dom.tabModeTree.classList.toggle('active', this.historyViewMode === 'tree');
  }

  toggleClearHistoryDialog(show) {
    if (!this.dom.clearHistoryDialog) return;
    if (show) {
      if (!this.dom.clearHistoryDialog.open) this.dom.clearHistoryDialog.showModal();
    } else {
      if (this.dom.clearHistoryDialog.open) this.dom.clearHistoryDialog.close();
    }
  }

  updateHistoryBatchBar() {
    if (!this.dom.historyBatchBar || !this.dom.batchSelectedCount) return;
    const count = this.historySelectedIds.size;
    this.dom.batchSelectedCount.textContent = count;
    this.dom.historyBatchBar.style.display = count > 0 ? 'flex' : 'none';
  }

  handleHistoryCheckbox(id, isChecked) {
    if (isChecked) {
      this.historySelectedIds.add(id);
    } else {
      this.historySelectedIds.delete(id);
    }
    const row = document.getElementById(`hist-row-${id}`);
    if (row) row.classList.toggle('selected', isChecked);
    this.updateHistoryBatchBar();
  }

  selectAllInGroup(items, isSelectAll) {
    items.forEach(item => {
      if (isSelectAll) {
        this.historySelectedIds.add(item.id);
      } else {
        this.historySelectedIds.delete(item.id);
      }
      const cb = document.getElementById(`hist-cb-${item.id}`);
      if (cb) cb.checked = isSelectAll;
      const row = document.getElementById(`hist-row-${item.id}`);
      if (row) row.classList.toggle('selected', isSelectAll);
    });
    this.updateHistoryBatchBar();
  }

  showHistoryContextMenu(e, item) {
    e.preventDefault();
    e.stopPropagation();
    this.activeContextItem = item;

    if (!this.dom.historyContextMenu) return;
    const menu = this.dom.historyContextMenu;
    menu.style.display = 'block';

    const menuWidth = 180;
    const menuHeight = 160;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

    menu.style.left = `${Math.max(10, x)}px`;
    menu.style.top = `${Math.max(10, y)}px`;
  }

  renderHistoryView() {
    if (!this.dom.historyMainFeed) return;
    this.dom.historyMainFeed.innerHTML = '';

    const query = this.historySearchQuery;

    if (this.historyViewMode === 'group') {
      const domainGroups = historyService.getGroupedByDomain(query);
      if (domainGroups.length === 0) {
        this.renderHistoryEmptyState();
        return;
      }
      this.renderHistoryDomainCards(domainGroups);
    } else if (this.historyViewMode === 'tree') {
      const treeData = historyService.getTreeStructure(query);
      if (treeData.length === 0) {
        this.renderHistoryEmptyState();
        return;
      }
      this.renderHistoryTreeView(treeData);
    } else {
      const dateGroups = historyService.getGroupedByDate(query, this.historySortBy);
      if (dateGroups.length === 0) {
        this.renderHistoryEmptyState();
        return;
      }
      this.renderHistoryDateCards(dateGroups);
    }

    this.updateHistoryBatchBar();
  }

  renderHistoryEmptyState() {
    if (!this.dom.historyMainFeed) return;
    this.dom.historyMainFeed.innerHTML = `
      <div class="history-empty-state">
        <div class="history-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h3>${this.historySearchQuery ? 'No Matching History Found' : 'No Browsing History'}</h3>
        <p>${this.historySearchQuery ? 'Try checking your spelling or searching for another keyword.' : 'Sites and pages you visit will be recorded and organized here.'}</p>
        ${this.historySearchQuery ? `<button class="mac-btn-secondary" id="btn-empty-clear-search">Clear Search Filter</button>` : ''}
      </div>
    `;

    const btnClearSearch = document.getElementById('btn-empty-clear-search');
    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (this.dom.macHistorySearch) this.dom.macHistorySearch.value = '';
        this.historySearchQuery = '';
        if (this.dom.btnHistoryClearSearch) this.dom.btnHistoryClearSearch.style.display = 'none';
        this.renderHistoryView();
      });
    }
  }

  renderHistoryDateCards(groups) {
    groups.forEach(group => {
      const card = document.createElement('div');
      card.className = 'mac-history-group-card';

      const isAllInGroupSelected = group.items.length > 0 && group.items.every(item => this.historySelectedIds.has(item.id));

      const header = document.createElement('div');
      header.className = 'mac-history-group-header';
      header.innerHTML = `
        <div class="group-header-left">
          <span class="group-header-title">${group.header}</span>
          <span class="group-header-count">(${group.items.length})</span>
        </div>
        <button class="group-select-all-btn">${isAllInGroupSelected ? 'Deselect group' : 'Select group'}</button>
      `;

      header.querySelector('.group-select-all-btn').addEventListener('click', () => {
        const currentlySelected = group.items.every(item => this.historySelectedIds.has(item.id));
        this.selectAllInGroup(group.items, !currentlySelected);
        header.querySelector('.group-select-all-btn').textContent = !currentlySelected ? 'Deselect group' : 'Select group';
      });

      card.appendChild(header);

      const itemsList = document.createElement('div');
      itemsList.className = 'mac-history-items-list';

      group.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'mac-history-item-row';
        row.id = `hist-row-${item.id}`;
        if (this.historySelectedIds.has(item.id)) row.classList.add('selected');

        const isChecked = this.historySelectedIds.has(item.id);
        const faviconHtml = item.favicon 
          ? `<img src="${item.favicon}" alt="" onerror="this.outerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/><line x1=\\'2\\' y1=\\'12\\' x2=\\'22\\' y2=\\'12\\'/><path d=\\'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\\'/></svg>'">`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

        row.innerHTML = `
          <input type="checkbox" class="mac-history-checkbox" id="hist-cb-${item.id}" ${isChecked ? 'checked' : ''}>
          <span class="mac-history-time-col">${item.time}</span>
          <div class="mac-history-favicon">${faviconHtml}</div>
          <div class="mac-history-title-col">
            <span class="mac-history-title-text" title="${item.url}">${item.title || item.url}</span>
            <span class="mac-history-domain-pill">${item.domain}</span>
            ${(item.visitCount && item.visitCount > 1) ? `<span class="mac-history-visits-badge">${item.visitCount} visits</span>` : ''}
          </div>
          <div class="mac-history-row-actions">
            <button class="mac-history-row-btn btn-row-menu" title="More options">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            <button class="mac-history-row-btn danger btn-row-del" title="Delete from history">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>
        `;

        const cb = row.querySelector('.mac-history-checkbox');
        cb.addEventListener('change', (e) => {
          this.handleHistoryCheckbox(item.id, e.target.checked);
        });

        row.querySelector('.mac-history-title-col').addEventListener('click', () => {
          tabManager.createTab(item.url, item.title || item.url);
        });

        row.querySelector('.btn-row-menu').addEventListener('click', (e) => {
          this.showHistoryContextMenu(e, item);
        });

        row.querySelector('.btn-row-del').addEventListener('click', (e) => {
          e.stopPropagation();
          historyService.removeItem(item.id);
          this.renderHistoryView();
          this.renderSettingsHistory();
          this.renderRecents();
        });

        row.addEventListener('contextmenu', (e) => {
          this.showHistoryContextMenu(e, item);
        });

        itemsList.appendChild(row);
      });

      card.appendChild(itemsList);
      this.dom.historyMainFeed.appendChild(card);
    });
  }

  renderHistoryDomainCards(domainGroups) {
    domainGroups.forEach(grp => {
      const card = document.createElement('div');
      card.className = 'mac-domain-group-card';

      const faviconHtml = grp.favicon
        ? `<img src="${grp.favicon}" alt="" width="14" height="14" onerror="this.outerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/></svg>'">`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;

      const header = document.createElement('div');
      header.className = 'mac-domain-group-header';
      header.innerHTML = `
        <div class="domain-header-left">
          <div class="mac-history-favicon">${faviconHtml}</div>
          <span class="domain-header-title">${grp.domain}</span>
          <span class="mac-history-visits-badge">${grp.totalVisits} visits</span>
        </div>
        <button class="mac-btn-secondary btn-del-domain" style="height: 24px; font-size: 11px; padding: 0 8px;">Delete all from site</button>
      `;

      header.querySelector('.btn-del-domain').addEventListener('click', (e) => {
        e.stopPropagation();
        historyService.removeDomain(grp.domain);
        this.renderHistoryView();
        this.renderSettingsHistory();
        this.renderRecents();
      });

      card.appendChild(header);

      const itemsList = document.createElement('div');
      itemsList.className = 'mac-history-items-list';

      grp.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'mac-history-item-row';
        row.id = `hist-row-${item.id}`;
        if (this.historySelectedIds.has(item.id)) row.classList.add('selected');

        const isChecked = this.historySelectedIds.has(item.id);

        row.innerHTML = `
          <input type="checkbox" class="mac-history-checkbox" id="hist-cb-${item.id}" ${isChecked ? 'checked' : ''}>
          <span class="mac-history-time-col">${item.time}</span>
          <div class="mac-history-title-col">
            <span class="mac-history-title-text" title="${item.url}">${item.title || item.url}</span>
            <span class="mac-history-domain-pill">${item.url}</span>
          </div>
          <div class="mac-history-row-actions">
            <button class="mac-history-row-btn btn-row-menu" title="More options">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            <button class="mac-history-row-btn danger btn-row-del" title="Delete from history">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>
        `;

        const cb = row.querySelector('.mac-history-checkbox');
        cb.addEventListener('change', (e) => {
          this.handleHistoryCheckbox(item.id, e.target.checked);
        });

        row.querySelector('.mac-history-title-col').addEventListener('click', () => {
          tabManager.createTab(item.url, item.title || item.url);
        });

        row.querySelector('.btn-row-menu').addEventListener('click', (e) => {
          this.showHistoryContextMenu(e, item);
        });

        row.querySelector('.btn-row-del').addEventListener('click', (e) => {
          e.stopPropagation();
          historyService.removeItem(item.id);
          this.renderHistoryView();
          this.renderSettingsHistory();
          this.renderRecents();
        });

        row.addEventListener('contextmenu', (e) => {
          this.showHistoryContextMenu(e, item);
        });

        itemsList.appendChild(row);
      });

      card.appendChild(itemsList);
      this.dom.historyMainFeed.appendChild(card);
    });
  }

  renderHistoryTreeView(treeData) {
    const treeContainer = document.createElement('div');
    treeContainer.className = 'mac-history-tree';

    treeData.forEach(bucket => {
      const dateNode = document.createElement('div');
      dateNode.className = 'tree-node-date';

      const dateHeader = document.createElement('div');
      dateHeader.className = 'tree-date-header';
      dateHeader.innerHTML = `
        <svg class="tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>${bucket.title}</span>
        <span style="font-size: 11px; color: #8e8e93; font-weight: normal;">(${bucket.totalItems})</span>
      `;

      dateHeader.addEventListener('click', () => {
        dateNode.classList.toggle('tree-collapsed');
      });

      dateNode.appendChild(dateHeader);

      const domainList = document.createElement('div');
      domainList.className = 'tree-children';

      bucket.domains.forEach(dom => {
        const domNode = document.createElement('div');
        domNode.className = 'tree-node-domain';

        const domHeader = document.createElement('div');
        domHeader.className = 'tree-domain-header';
        domHeader.innerHTML = `
          <svg class="tree-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>${dom.domain}</span>
          <span style="font-size: 10.5px; color: #8e8e93; font-weight: normal;">(${dom.items.length})</span>
        `;

        domHeader.addEventListener('click', () => {
          domNode.classList.toggle('tree-collapsed');
        });

        domNode.appendChild(domHeader);

        const pagesList = document.createElement('div');
        pagesList.className = 'tree-children';

        dom.items.forEach(item => {
          const pageItem = document.createElement('div');
          pageItem.className = 'tree-page-item';
          pageItem.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span class="tree-page-title" title="${item.url}">${item.title || item.url}</span>
            <span class="tree-page-time">${item.time}</span>
          `;

          pageItem.addEventListener('click', () => {
            tabManager.createTab(item.url, item.title || item.url);
          });

          pageItem.addEventListener('contextmenu', (e) => {
            this.showHistoryContextMenu(e, item);
          });

          pagesList.appendChild(pageItem);
        });

        domNode.appendChild(pagesList);
        domainList.appendChild(domNode);
      });

      dateNode.appendChild(domainList);
      treeContainer.appendChild(dateNode);
    });

    this.dom.historyMainFeed.appendChild(treeContainer);
  }

  renderSettingsHistory(filterText = '') {
    if (!this.dom.settingsHistoryList) return;
    const history = historyService.getHistory();
    const query = filterText.toLowerCase().trim();
    const filtered = query
      ? history.filter(h => (h.title && h.title.toLowerCase().includes(query)) || (h.url && h.url.toLowerCase().includes(query)) || (h.domain && h.domain.toLowerCase().includes(query)))
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

    filtered.slice(0, 30).forEach(item => {
      const row = document.createElement('div');
      row.className = 'mac-history-row';
      const timeStr = item.time || new Date(item.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
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

  /* ==========================================================================
     BOOKMARKS & WORKSPACES SYSTEM CONTROLLER (macOS Finder Style)
     ========================================================================== */
  openBookmarksTab() {
    const allTabs = tabManager.getAllTabs();
    const existing = allTabs.find(t => t.url === BOOKMARKS_URL || t.url === LEGACY_BOOKMARKS_URL);
    if (existing) {
      tabManager.activateTab(existing.id);
    } else {
      tabManager.createTab(BOOKMARKS_URL, 'Bookmarks');
    }
  }

  updateOmniboxStarState(tab) {
    if (!this.dom.btnBookmark) return;
    const url = tab ? (tab.url || '') : '';
    const isInternal = !url || 
      url === BLANK_URL || 
      url === DEFAULT_NEWTAB_URL || 
      url === LEGACY_NEWTAB_URL || 
      url === SETTINGS_URL || 
      url === LEGACY_SETTINGS_URL || 
      url === HISTORY_URL || 
      url === LEGACY_HISTORY_URL || 
      url === BOOKMARKS_URL || 
      url === LEGACY_BOOKMARKS_URL || 
      url.startsWith('mynetwork://') || 
      url.startsWith('about:') || 
      url.startsWith('chrome://');

    if (isInternal) {
      this.dom.btnBookmark.style.display = 'none';
      return;
    }
    this.dom.btnBookmark.style.display = 'flex';
    const isBookmarked = bookmarkService.isBookmarked(url);
    this.dom.btnBookmark.classList.toggle('bookmarked', isBookmarked);
    this.dom.btnBookmark.title = isBookmarked ? 'Edit Bookmark (Ctrl+D)' : 'Bookmark This Tab (Ctrl+D)';
  }

  toggleBookmarkPopover() {
    if (!this.dom.bookmarkStarPopover) return;
    if (this.dom.bookmarkStarPopover.style.display === 'flex') {
      this.closeBookmarkPopover();
      return;
    }

    const activeTab = tabManager.getActiveTab();
    const tabUrl = (activeTab && activeTab.url && activeTab.url !== BLANK_URL && !activeTab.url.startsWith('mynetwork://') && !activeTab.url.startsWith('about:') && !activeTab.url.startsWith('chrome://')) 
      ? activeTab.url 
      : (this.dom.urlInput ? this.dom.urlInput.value.trim() : '');

    if (!tabUrl || tabUrl.startsWith('mynetwork://') || tabUrl.startsWith('about:') || tabUrl.startsWith('chrome://')) {
      return;
    }

    const tabTitle = (activeTab && activeTab.title && activeTab.title !== 'about:blank' && activeTab.title !== 'New Tab') 
      ? activeTab.title 
      : tabUrl;

    const existing = bookmarkService.getBookmarkByUrl(tabUrl);
    if (this.dom.bmPopoverHeading) {
      this.dom.bmPopoverHeading.textContent = existing ? 'Edit Bookmark' : 'Bookmark Added';
    }

    if (this.dom.bmPopoverName) {
      this.dom.bmPopoverName.value = existing ? existing.title : tabTitle;
    }
    if (this.dom.bmPopoverUrl) {
      this.dom.bmPopoverUrl.value = existing ? existing.url : tabUrl;
    }

    const defaultFolder = settingsService.get('defaultBookmarkFolder', 'root_bar');
    const targetFolderId = existing ? existing.parentId : defaultFolder;
    this.populatePopoverFolders(targetFolderId);

    // Smart Workspace Auto-Detection
    const smartClass = workspaceService.classifyUrl(tabUrl);
    this.populatePopoverWorkspaces(existing ? existing.workspaceId : smartClass.workspaceId, smartClass);

    if (this.dom.bmPopoverDetectedBadge) {
      this.dom.bmPopoverDetectedBadge.style.display = 'inline-flex';
      this.dom.bmPopoverDetectedBadge.textContent = `✨ ${smartClass.workspaceName}`;
    }

    if (existing && Array.isArray(existing.tags) && existing.tags.length > 0) {
      this.popoverActiveTags = [...existing.tags];
    } else {
      this.popoverActiveTags = smartClass.suggestedTags || [];
    }
    this.renderPopoverTags();

    if (this.dom.bmPopoverFavCheck) {
      this.dom.bmPopoverFavCheck.checked = existing ? (existing.parentId === 'root_bar') : true;
    }

    if (this.dom.btnBmPopoverRemove) {
      this.dom.btnBmPopoverRemove.style.display = existing ? 'block' : 'none';
    }

    this.dom.bookmarkStarPopover.style.display = 'flex';
    if (this.dom.bmPopoverName) {
      this.dom.bmPopoverName.focus();
      this.dom.bmPopoverName.select();
    }
  }

  closeBookmarkPopover() {
    if (this.dom.bookmarkStarPopover) {
      this.dom.bookmarkStarPopover.style.display = 'none';
    }
  }

  populatePopoverWorkspaces(selectedId = null, smartClass = null) {
    if (!this.dom.bmPopoverWsSelect) return;
    const workspaces = workspaceService.getWorkspaces();
    this.dom.bmPopoverWsSelect.innerHTML = '';

    workspaces.forEach(ws => {
      const opt = document.createElement('option');
      opt.value = ws.id;
      const wsIcon = ws.icon === 'globe' ? '🌐' : (ws.icon === 'code' ? '💻' : (ws.icon === 'user' ? '👤' : '💼'));
      const isSmartDetected = smartClass && smartClass.workspaceId === ws.id;
      opt.textContent = `${wsIcon} ${ws.name}${isSmartDetected ? ' (✨ Detected)' : ''}`;
      if (ws.id === selectedId) opt.selected = true;
      this.dom.bmPopoverWsSelect.appendChild(opt);
    });
  }

  populatePopoverFolders(selectedId = 'root_bar') {
    if (!this.dom.bmPopoverFolderSelect) return;
    const folders = bookmarkService.getAllFolders();
    this.dom.bmPopoverFolderSelect.innerHTML = '';
    folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = (f.parentId && f.parentId.startsWith('folder_')) ? `  📁 ${f.title}` : `📁 ${f.title}`;
      if (f.id === selectedId) opt.selected = true;
      this.dom.bmPopoverFolderSelect.appendChild(opt);
    });
  }

  renderPopoverTags() {
    if (!this.dom.bmPopoverTagsBox || !this.dom.bmPopoverTagsInput) return;
    this.dom.bmPopoverTagsBox.querySelectorAll('.bm-tag-chip').forEach(el => el.remove());
    this.popoverActiveTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'bm-tag-chip';
      chip.innerHTML = `<span>#${this.escapeHtml(tag)}</span><span class="bm-tag-chip-remove" data-tag="${this.escapeHtml(tag)}">×</span>`;
      chip.querySelector('.bm-tag-chip-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        this.popoverActiveTags = this.popoverActiveTags.filter(t => t !== tag);
        this.renderPopoverTags();
      });
      this.dom.bmPopoverTagsBox.insertBefore(chip, this.dom.bmPopoverTagsInput);
    });
  }

  saveBookmarkFromPopover() {
    const activeTab = tabManager.getActiveTab();
    const url = this.dom.bmPopoverUrl ? this.dom.bmPopoverUrl.value.trim() : (activeTab ? activeTab.url : '');
    const title = this.dom.bmPopoverName ? this.dom.bmPopoverName.value.trim() : (activeTab ? activeTab.title : 'Untitled');
    const selectedFolder = this.dom.bmPopoverFolderSelect ? this.dom.bmPopoverFolderSelect.value : 'root_bar';
    const selectedWs = this.dom.bmPopoverWsSelect ? this.dom.bmPopoverWsSelect.value : null;
    const isFav = this.dom.bmPopoverFavCheck ? this.dom.bmPopoverFavCheck.checked : true;
    
    // Target folder is the selected folder, or root_bar if checked for favorites bar
    const finalParentId = (selectedFolder && selectedFolder !== 'root_bar') ? selectedFolder : (isFav ? 'root_bar' : 'root_other');

    if (!url) {
      this.showToast('Please enter a valid URL');
      return;
    }

    const existing = bookmarkService.getBookmarkByUrl(url);
    if (existing) {
      bookmarkService.updateBookmark(existing.id, {
        title: title || existing.title,
        url,
        parentId: finalParentId,
        workspaceId: selectedWs || existing.workspaceId,
        tags: this.popoverActiveTags,
        favicon: (activeTab && activeTab.favicon) ? activeTab.favicon : existing.favicon
      });
      this.showToast(`Updated bookmark "${title}"`);
    } else {
      bookmarkService.createBookmark({
        title: title || 'Bookmark',
        url,
        parentId: finalParentId,
        tags: this.popoverActiveTags,
        favicon: (activeTab && activeTab.favicon) ? activeTab.favicon : null,
        workspaceId: selectedWs || workspaceService.detectWorkspaceForUrl(url)
      });
      this.showToast(`Saved "${title}" to Bookmarks ⭐`);
    }

    // Immediately trigger UI updates
    if (activeTab) this.updateOmniboxStarState(activeTab);
    this.renderBookmarksBar();
    this.renderNewTabShortcuts();
    this.renderBookmarksManager();

    this.closeBookmarkPopover();
  }

  removeBookmarkFromPopover() {
    const url = this.dom.bmPopoverUrl ? this.dom.bmPopoverUrl.value.trim() : '';
    if (url) {
      const existing = bookmarkService.getBookmarkByUrl(url);
      if (existing) {
        bookmarkService.deleteBookmark(existing.id);
        this.showToast(`Removed bookmark "${existing.title}"`);
      }
    }
    const activeTab = tabManager.getActiveTab();
    if (activeTab) this.updateOmniboxStarState(activeTab);
    this.renderBookmarksBar();
    this.renderNewTabShortcuts();
    this.renderBookmarksManager();
    this.closeBookmarkPopover();
  }

  renderBookmarksBar() {
    if (!this.dom.bookmarksBar || !this.dom.bookmarksBarItems) return;
    const mode = settingsService.get('bookmarksBarMode', 'always');
    const activeTab = tabManager.getActiveTab();
    const isNewTab = activeTab && (activeTab.url === DEFAULT_NEWTAB_URL || activeTab.url === LEGACY_NEWTAB_URL || activeTab.url === BLANK_URL);

    const shouldShow = (mode === 'always') || (mode === 'newtab' && isNewTab);
    this.dom.bookmarksBar.style.display = shouldShow ? 'flex' : 'none';
    if (!shouldShow) return;

    const activeWorkspaceId = workspaceService.getActiveWorkspaceId();
    const items = bookmarkService.getFavoritesBarItems(activeWorkspaceId);
    this.dom.bookmarksBarItems.innerHTML = '';

    items.forEach(item => {
      if (!item) return;
      const isFolder = item.type === 'folder' || !!item.isFolder;
      const pill = document.createElement('a');
      pill.className = `bm-bar-item ${isFolder ? 'folder' : ''}`;
      pill.setAttribute('data-id', item.id);
      
      if (isFolder) {
        pill.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${item.color || '#f59e0b'}" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>${this.escapeHtml(item.title)}</span>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>
        `;
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = pill.getBoundingClientRect();
          this.renderBookmarkFolderDropdown(item.id, rect.left, rect.bottom + 4);
        });
      } else {
        const faviconHtml = item.favicon 
          ? `<img src="${item.favicon}" alt="" onerror="this.outerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/></svg>'">`
          : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
        
        pill.innerHTML = `
          ${faviconHtml}
          <span>${this.escapeHtml(item.title)}</span>
        `;
        pill.title = `${item.title} (${item.url || ''})`;
        pill.addEventListener('click', (e) => {
          e.preventDefault();
          if (item.url) this.openBookmarkUrl(item.url, e.ctrlKey || e.metaKey);
        });
      }
      pill.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showBookmarkContextMenu(e, item);
      });
      this.dom.bookmarksBarItems.appendChild(pill);
    });
  }

  toggleBookmarksBar() {
    const current = settingsService.get('bookmarksBarMode', 'never');
    const next = current === 'always' ? 'never' : 'always';
    settingsService.set('bookmarksBarMode', next);
    this.renderBookmarksBar();
    this.showToast(`Favorites Bar: ${next === 'always' ? 'Always Shown' : 'Hidden'}`);
  }

  openBookmarkUrl(url, forceNewTab = false) {
    if (!url || typeof url !== 'string' || url === 'undefined' || !url.trim()) {
      return;
    }
    const targetMode = settingsService.get('bookmarkOpenTarget', 'current');
    if (forceNewTab || targetMode === 'new') {
      tabManager.createTab(url);
    } else if (targetMode === 'background') {
      const active = tabManager.getActiveTab();
      const tab = tabManager.createTab(url);
      if (active) tabManager.activateTab(active.id);
    } else {
      const active = tabManager.getActiveTab();
      if (active && (active.url === DEFAULT_NEWTAB_URL || active.url === LEGACY_NEWTAB_URL || active.url === BLANK_URL)) {
        this.navigateCurrentTab(url);
      } else {
        tabManager.createTab(url);
      }
    }
  }

  renderBookmarkFolderDropdown(folderId, x, y) {
    if (!this.dom.bookmarksBarDropdown || !this.dom.bmBarDropdownContent) return;
    const children = bookmarkService.getFolderChildren(folderId);
    this.dom.bmBarDropdownContent.innerHTML = '';

    if (children.length === 0) {
      this.dom.bmBarDropdownContent.innerHTML = `<div class="bm-dropdown-item" style="color: #94a3b8; cursor: default;">(Empty folder)</div>`;
    } else {
      children.forEach(child => {
        const itemEl = document.createElement('div');
        itemEl.className = 'bm-dropdown-item';
        const faviconHtml = child.favicon 
          ? `<img src="${child.favicon}" width="13" height="13" alt="">`
          : (child.isFolder ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>` : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`);
        itemEl.innerHTML = `
          ${faviconHtml}
          <span>${this.escapeHtml(child.title)}</span>
        `;
        itemEl.addEventListener('click', () => {
          if (child.isFolder) {
            this.openBookmarksTab();
          } else {
            this.openBookmarkUrl(child.url);
          }
          this.dom.bookmarksBarDropdown.style.display = 'none';
        });
        this.dom.bmBarDropdownContent.appendChild(itemEl);
      });
    }

    this.dom.bookmarksBarDropdown.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    this.dom.bookmarksBarDropdown.style.top = `${y}px`;
    this.dom.bookmarksBarDropdown.style.display = 'block';
  }

  renderNewTabShortcuts() {
    if (!this.dom.newtabShortcutsContainer) return;
    const layout = settingsService.get('newtabBookmarksLayout', 'spotlight');
    if (layout === 'minimal') {
      this.dom.newtabShortcutsContainer.style.display = 'none';
      return;
    }
    this.dom.newtabShortcutsContainer.style.display = 'flex';

    if (layout === 'spotlight') {
      if (this.dom.newtabShortcutsRow) this.dom.newtabShortcutsRow.style.display = 'flex';
      if (this.dom.newtabWorkspaceBoards) this.dom.newtabWorkspaceBoards.style.display = 'none';
      if (this.dom.newtabWorkspaceTabs && this.dom.newtabWorkspaceTabs.parentElement) {
        this.dom.newtabWorkspaceTabs.parentElement.style.display = 'none';
      }

      const items = bookmarkService.getFavoritesBarItems()
        .filter(i => i && (i.type === 'bookmark' || (!i.isFolder && i.type !== 'folder')) && i.url && i.url !== 'undefined')
        .slice(0, 10);
      this.dom.newtabShortcutsRow.innerHTML = '';

      items.forEach(item => {
        const chip = document.createElement('div');
        chip.className = 'shortcut-chip';
        const faviconHtml = item.favicon 
          ? `<img src="${item.favicon}" alt="" onerror="this.outerHTML='<svg width=\\'20\\' height=\\'20\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#64748b\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/></svg>'">`
          : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
        
        chip.innerHTML = `
          <div class="shortcut-icon-bubble">
            ${faviconHtml}
          </div>
          <span class="shortcut-title-text">${this.escapeHtml(item.title)}</span>
        `;
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          if (item.url && item.url !== 'undefined') {
            this.openBookmarkUrl(item.url, e.ctrlKey || e.metaKey);
          }
        });
        chip.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showBookmarkContextMenu(e, item);
        });
        this.dom.newtabShortcutsRow.appendChild(chip);
      });

      // + Add Shortcut button
      const addChip = document.createElement('div');
      addChip.className = 'shortcut-chip add-shortcut';
      addChip.innerHTML = `
        <div class="shortcut-icon-bubble">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <span class="shortcut-title-text">Add shortcut</span>
      `;
      addChip.addEventListener('click', () => this.openAddShortcutModal());
      this.dom.newtabShortcutsRow.appendChild(addChip);

    } else if (layout === 'boards') {
      if (this.dom.newtabShortcutsRow) this.dom.newtabShortcutsRow.style.display = 'none';
      if (this.dom.newtabWorkspaceBoards) this.dom.newtabWorkspaceBoards.style.display = 'grid';
      if (this.dom.newtabWorkspaceTabs && this.dom.newtabWorkspaceTabs.parentElement) {
        this.dom.newtabWorkspaceTabs.parentElement.style.display = 'flex';
      }

      // Render workspace switch tabs
      const workspaces = workspaceService.getWorkspaces();
      const activeWsId = workspaceService.getActiveWorkspaceId();
      this.dom.newtabWorkspaceTabs.innerHTML = '';
      workspaces.forEach(ws => {
        const tabEl = document.createElement('div');
        tabEl.className = `ws-tab-pill ${ws.id === activeWsId ? 'active' : ''}`;
        tabEl.textContent = ws.name;
        tabEl.addEventListener('click', () => {
          workspaceService.setActiveWorkspace(ws.id);
        });
        this.dom.newtabWorkspaceTabs.appendChild(tabEl);
      });

      // Render boards
      const folders = bookmarkService.getAllFolders();
      this.dom.newtabWorkspaceBoards.innerHTML = '';
      folders.forEach(f => {
        const children = bookmarkService.getFolderChildren(f.id).filter(c => !c.isFolder);
        const card = document.createElement('div');
        card.className = 'ws-board-card';
        card.innerHTML = `
          <div class="ws-board-title">📁 ${this.escapeHtml(f.title)} (${children.length})</div>
          <div class="ws-board-favicons-row">
            ${children.slice(0, 6).map(c => c.favicon ? `<img src="${c.favicon}" alt="" title="${this.escapeHtml(c.title)}">` : `<span style="font-size: 11px;">🔗</span>`).join('')}
            ${children.length === 0 ? '<span style="font-size: 11px; color: #94a3b8;">Empty folder</span>' : ''}
          </div>
        `;
        card.addEventListener('click', () => {
          this.currentBmFilter.folderId = f.id;
          this.openBookmarksTab();
        });
        this.dom.newtabWorkspaceBoards.appendChild(card);
      });
    }
  }

  openAddShortcutModal(existing = null) {
    if (!this.dom.modalAddShortcut) return;
    const activeTab = tabManager.getActiveTab();
    const isSpecial = !activeTab || !activeTab.url || activeTab.url.startsWith('mynetwork://') || activeTab.url.startsWith('about:') || activeTab.url.startsWith('chrome://');

    const defaultTitle = existing ? existing.title : (!isSpecial ? (activeTab.title || '') : '');
    const defaultUrl = existing ? existing.url : (!isSpecial ? activeTab.url : '');

    if (this.dom.shortcutEditId) this.dom.shortcutEditId.value = existing ? existing.id : '';
    if (this.dom.shortcutInputTitle) this.dom.shortcutInputTitle.value = defaultTitle;
    if (this.dom.shortcutInputUrl) this.dom.shortcutInputUrl.value = defaultUrl;
    
    // Populate Folder Dropdown
    if (this.dom.shortcutInputFolder) {
      const folders = bookmarkService.getAllFolders();
      this.dom.shortcutInputFolder.innerHTML = '';
      folders.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = `📁 ${f.title}`;
        if (existing && f.id === existing.parentId) {
          opt.selected = true;
        } else if (!existing && f.id === (this.currentBmFilter.folderId || 'root_bar')) {
          opt.selected = true;
        }
        this.dom.shortcutInputFolder.appendChild(opt);
      });
    }

    if (this.dom.shortcutInputWs) {
      this.dom.shortcutInputWs.value = existing ? (existing.workspaceId || 'auto') : 'auto';
    }
    if (this.dom.shortcutInputTags) {
      this.dom.shortcutInputTags.value = (existing && Array.isArray(existing.tags)) ? existing.tags.join(', ') : '';
    }
    if (this.dom.btnDeleteShortcut) this.dom.btnDeleteShortcut.style.display = existing ? 'block' : 'none';
    const titleEl = document.getElementById('shortcut-modal-title');
    if (titleEl) titleEl.textContent = existing ? 'Edit Bookmark' : 'Add Bookmark';
    this.dom.modalAddShortcut.showModal();
    if (this.dom.shortcutInputTitle) this.dom.shortcutInputTitle.focus();
  }

  openAddBookmarkFolderModal(existing = null) {
    if (!this.dom.modalAddBmFolder) return;
    if (this.dom.bmFolderEditId) this.dom.bmFolderEditId.value = existing ? existing.id : '';
    if (this.dom.bmFolderInputTitle) this.dom.bmFolderInputTitle.value = existing ? existing.title : '';
    
    // Populate parent dropdown
    if (this.dom.bmFolderInputParent) {
      const folders = bookmarkService.getAllFolders();
      this.dom.bmFolderInputParent.innerHTML = '';
      folders.forEach(f => {
        if (!existing || f.id !== existing.id) {
          const opt = document.createElement('option');
          opt.value = f.id;
          opt.textContent = `📁 ${f.title}`;
          if (existing && f.id === existing.parentId) opt.selected = true;
          this.dom.bmFolderInputParent.appendChild(opt);
        }
      });
    }

    if (this.dom.btnDeleteBmFolder) {
      this.dom.btnDeleteBmFolder.style.display = existing ? 'block' : 'none';
    }

    const titleEl = document.getElementById('bm-folder-modal-title');
    if (titleEl) titleEl.textContent = existing ? 'Edit Folder' : 'New Folder';
    this.dom.modalAddBmFolder.showModal();
    if (this.dom.bmFolderInputTitle) this.dom.bmFolderInputTitle.focus();
  }

  renderBookmarksManager() {
    this.renderBookmarksSidebar();
    this.renderBookmarksList();
    this.renderBmBatchBar();
  }

  renderBookmarksSidebar() {
    // 1. Workspaces
    if (this.dom.bmMgrWorkspacesList) {
      const workspaces = workspaceService.getWorkspaces();
      const activeWsId = workspaceService.getActiveWorkspaceId();
      const wsIconMap = { globe: '🌐', code: '💻', user: '👤' };

      this.dom.bmMgrWorkspacesList.innerHTML = '';
      workspaces.forEach(ws => {
        const item = document.createElement('div');
        item.className = `bm-ws-item ${ws.id === activeWsId && !this.currentBmFilter.rootId ? 'active' : ''}`;
        const iconDisplay = wsIconMap[ws.icon] || ws.icon || '💼';
        item.innerHTML = `
          <span style="font-size: 13px;">${iconDisplay}</span>
          <span>${this.escapeHtml(ws.name)}</span>
        `;
        item.addEventListener('click', () => {
          workspaceService.setActiveWorkspace(ws.id);
          this.currentBmFilter = { rootId: null, workspaceId: ws.id, folderId: null, tag: null, isRead: null, query: '' };
          this.renderBookmarksManager();
        });
        this.dom.bmMgrWorkspacesList.appendChild(item);
      });
    }

    // 2. Collection count badges
    const allCount = bookmarkService.getAllBookmarks().length;
    const barCount = bookmarkService.getFavoritesBarItems().length;
    const readingCount = bookmarkService.getReadingList().length;
    const trashCount = bookmarkService.getTrashItems().length;

    const badgeAll = document.getElementById('badge-count-all');
    if (badgeAll) badgeAll.textContent = allCount;
    const badgeBar = document.getElementById('badge-count-bar');
    if (badgeBar) badgeBar.textContent = barCount;
    const badgeReading = document.getElementById('badge-count-reading');
    if (badgeReading) badgeReading.textContent = readingCount;
    const badgeTrash = document.getElementById('badge-count-trash');
    if (badgeTrash) badgeTrash.textContent = trashCount;

    // Collection click listeners
    document.querySelectorAll('.bookmarks-sidebar .bm-nav-item').forEach(nav => {
      nav.onclick = () => {
        document.querySelectorAll('.bookmarks-sidebar .bm-nav-item').forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        const target = nav.getAttribute('data-nav');
        this.bmSelectedIds.clear();
        if (target === 'all') {
          this.currentBmFilter = { rootId: null, workspaceId: null, folderId: null, tag: null, isRead: null, query: '' };
        } else if (target === 'bar') {
          this.currentBmFilter = { rootId: 'root_bar', workspaceId: null, folderId: null, tag: null, isRead: null, query: '' };
        } else if (target === 'reading') {
          this.currentBmFilter = { rootId: 'root_reading', workspaceId: null, folderId: null, tag: null, isRead: false, query: '' };
        } else if (target === 'trash') {
          this.currentBmFilter = { rootId: 'root_trash', workspaceId: null, folderId: null, tag: null, isRead: null, query: '' };
        }
        this.renderBookmarksList();
      };
    });

    // 3. Folder Tree
    if (this.dom.bmMgrFolderTree) {
      const folders = bookmarkService.getAllFolders();
      this.dom.bmMgrFolderTree.innerHTML = '';
      folders.forEach(f => {
        const item = document.createElement('div');
        item.className = `bm-tree-item ${this.currentBmFilter.folderId === f.id ? 'active' : ''}`;
        item.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${f.color || '#f59e0b'}" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>${this.escapeHtml(f.title)}</span>
        `;
        item.addEventListener('click', () => {
          document.querySelectorAll('.bookmarks-sidebar .bm-nav-item, .bm-tree-item').forEach(n => n.classList.remove('active'));
          item.classList.add('active');
          this.bmSelectedIds.clear();
          this.currentBmFilter = { rootId: null, workspaceId: null, folderId: f.id, tag: null, isRead: null, query: '' };
          this.renderBookmarksList();
        });
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.showBookmarkContextMenu(e, f);
        });
        this.dom.bmMgrFolderTree.appendChild(item);
      });
    }

    // 4. Tags cloud
    if (this.dom.bmMgrTagsCloud) {
      const tags = bookmarkService.getAllTags();
      this.dom.bmMgrTagsCloud.innerHTML = '';
      tags.forEach(tObj => {
        const tagName = typeof tObj === 'object' ? tObj.name : tObj;
        if (!tagName) return;
        const tagEl = document.createElement('span');
        tagEl.className = `bm-tag-pill ${this.currentBmFilter.tag === tagName ? 'active' : ''}`;
        tagEl.textContent = `#${this.escapeHtml(tagName)}`;
        tagEl.addEventListener('click', () => {
          this.bmSelectedIds.clear();
          if (this.currentBmFilter.tag === tagName) {
            this.currentBmFilter.tag = null;
          } else {
            this.currentBmFilter.tag = tagName;
          }
          this.renderBookmarksList();
        });
        this.dom.bmMgrTagsCloud.appendChild(tagEl);
      });
    }
  }

  renderBookmarksList() {
    if (!this.dom.bmMgrItemsContainer) return;
    let items = [];
    const isTrashView = this.currentBmFilter.rootId === 'root_trash';

    if (this.currentBmFilter.query) {
      items = bookmarkService.search(this.currentBmFilter.query);
    } else if (this.currentBmFilter.tag) {
      items = bookmarkService.searchByTag(this.currentBmFilter.tag);
    } else if (this.currentBmFilter.folderId) {
      items = bookmarkService.getFolderChildren(this.currentBmFilter.folderId);
    } else if (this.currentBmFilter.rootId === 'root_bar') {
      items = bookmarkService.getFavoritesBarItems();
    } else if (this.currentBmFilter.rootId === 'root_reading') {
      items = bookmarkService.getReadingList();
    } else if (isTrashView) {
      items = bookmarkService.getTrashItems();
    } else {
      items = bookmarkService.getAllBookmarks();
    }

    // Update Empty Trash visibility
    if (this.dom.btnBmEmptyTrash) {
      this.dom.btnBmEmptyTrash.style.display = isTrashView ? 'block' : 'none';
    }

    // Update Status Bar text
    if (this.dom.bmStatusText) {
      const folderCount = items.filter(i => i.isFolder || i.type === 'folder').length;
      const bmCount = items.filter(i => !i.isFolder && i.type !== 'folder').length;
      this.dom.bmStatusText.textContent = `${bmCount} Bookmark${bmCount === 1 ? '' : 's'}${folderCount > 0 ? ` • ${folderCount} Folder${folderCount === 1 ? '' : 's'}` : ''} • Synced locally`;
    }

    // Update Breadcrumbs
    if (this.dom.bmMgrBreadcrumbs) {
      let label = 'All Bookmarks';
      if (this.currentBmFilter.query) label = `Search: "${this.currentBmFilter.query}"`;
      else if (this.currentBmFilter.tag) label = `Tag: #${this.currentBmFilter.tag}`;
      else if (this.currentBmFilter.folderId) {
        const folder = bookmarkService.getBookmark(this.currentBmFilter.folderId);
        label = folder ? `Folder: ${folder.title}` : 'Folder';
      } else if (this.currentBmFilter.rootId === 'root_bar') label = 'Favorites Bar';
      else if (this.currentBmFilter.rootId === 'root_reading') label = 'Reading List';
      else if (isTrashView) label = 'Trash';

      this.dom.bmMgrBreadcrumbs.innerHTML = `<span class="breadcrumb-item active">${this.escapeHtml(label)}</span>`;
    }

    // Render items Container
    this.dom.bmMgrItemsContainer.className = `bm-items-container ${this.currentBmViewMode === 'list' ? 'list-view' : 'grid-view'}`;
    this.dom.bmMgrItemsContainer.innerHTML = '';

    if (items.length === 0) {
      this.dom.bmMgrItemsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px; color: #94a3b8; gap: 8px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span style="font-size: 13px; font-weight: 500;">${isTrashView ? 'Trash is empty' : 'No bookmarks found'}</span>
        </div>
      `;
      this.renderBmBatchBar();
      return;
    }

    items.forEach(item => {
      if (!item) return;
      const isFolder = item.type === 'folder' || !!item.isFolder;
      const wsId = item.workspaceId || (item.url ? workspaceService.detectWorkspaceForUrl(item.url) : 'ws_default');
      const wsObj = workspaceService.getWorkspace(wsId);
      const wsIcon = wsObj?.icon === 'globe' ? '🌐' : (wsObj?.icon === 'code' ? '💻' : (wsObj?.icon === 'user' ? '👤' : '💼'));
      const wsBadgeHtml = `<span class="bm-card-ws-badge ws-badge-${wsId}">${wsIcon} ${this.escapeHtml(wsObj?.name || 'General')}</span>`;
      const displayUrl = isFolder ? 'Folder' : (item.url ? item.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '');

      if (this.currentBmViewMode === 'grid') {
        const card = document.createElement('div');
        card.className = 'bm-card';
        const faviconHtml = item.favicon 
          ? `<img src="${item.favicon}" alt="" class="bm-card-favicon" onerror="this.outerHTML='<svg width=\\'18\\' height=\\'18\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'#64748b\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\' r=\\'10\\'/></svg>'">`
          : (isFolder ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${item.color || '#f59e0b'}" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>` : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`);

        const tagsHtml = (item.tags && item.tags.length > 0)
          ? `<div class="bm-card-tags">${item.tags.map(t => `<span class="bm-card-tag">#${this.escapeHtml(t)}</span>`).join('')}</div>`
          : '';

        const hasBottom = (item.tags && item.tags.length > 0) || wsBadgeHtml;

        card.innerHTML = `
          <div class="bm-card-main">
            <div class="bm-card-icon-wrap">
              ${faviconHtml}
            </div>
            <div class="bm-card-meta">
              <span class="bm-card-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</span>
              <span class="bm-card-url">${this.escapeHtml(displayUrl)}</span>
            </div>
            <button type="button" class="bm-card-more-btn" title="Options">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>
            </button>
          </div>
          ${hasBottom ? `
          <div class="bm-card-footer">
            ${tagsHtml}
            ${wsBadgeHtml}
          </div>` : ''}
        `;

        // More options button click -> Open context menu
        const moreBtn = card.querySelector('.bm-card-more-btn');
        if (moreBtn) {
          moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showBookmarkContextMenu(e, item);
          });
        }

        // Left click on card -> Open bookmark / folder
        card.addEventListener('click', (e) => {
          if (e.target.closest('.bm-card-more-btn')) return;
          if (isTrashView) {
            this.showToast('Item is in Trash. Click options (···) to restore.');
            return;
          }
          if (isFolder) {
            this.currentBmFilter.folderId = item.id;
            this.renderBookmarksList();
          } else if (item.url && item.url !== 'undefined') {
            this.openBookmarkUrl(item.url, e.ctrlKey || e.metaKey);
          }
        });

        // Right click on card -> Open context menu
        card.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.showBookmarkContextMenu(e, item);
        });

        this.dom.bmMgrItemsContainer.appendChild(card);

      } else {
        // List View Row
        const row = document.createElement('div');
        row.className = 'bm-list-row';
        const faviconHtml = item.favicon 
          ? `<img src="${item.favicon}" alt="" class="bm-list-favicon">`
          : (isFolder ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${item.color || '#f59e0b'}" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>` : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`);

        row.innerHTML = `
          ${faviconHtml}
          <span class="bm-list-title" title="${this.escapeHtml(item.title)}">${this.escapeHtml(item.title)}</span>
          <span class="bm-list-url">${this.escapeHtml(displayUrl)}</span>
          ${wsBadgeHtml}
          <button type="button" class="bm-row-more-btn" title="Options">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/></svg>
          </button>
        `;

        const moreBtn = row.querySelector('.bm-row-more-btn');
        if (moreBtn) {
          moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showBookmarkContextMenu(e, item);
          });
        }

        row.addEventListener('click', (e) => {
          if (e.target.closest('.bm-row-more-btn')) return;
          if (isTrashView) {
            this.showToast('Item is in Trash. Click options (···) to restore.');
            return;
          }
          if (isFolder) {
            this.currentBmFilter.folderId = item.id;
            this.renderBookmarksList();
          } else if (item.url && item.url !== 'undefined') {
            this.openBookmarkUrl(item.url, e.ctrlKey || e.metaKey);
          }
        });

        row.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.showBookmarkContextMenu(e, item);
        });

        this.dom.bmMgrItemsContainer.appendChild(row);
      }
    });

    this.renderBmBatchBar();
  }

  handleBookmarkAction(action, item) {
    if (!item) return;
    const isFolder = item.type === 'folder' || !!item.isFolder;

    if (action === 'edit') {
      if (isFolder) {
        this.openAddBookmarkFolderModal(item);
      } else {
        this.openAddShortcutModal(item);
      }
    } else if (action === 'copy') {
      if (item.url) {
        navigator.clipboard.writeText(item.url);
        this.showToast('Copied bookmark URL');
      }
    } else if (action === 'trash') {
      bookmarkService.moveToTrash(item.id);
      this.showToast(`Moved "${item.title}" to Trash`);
      this.renderBookmarksManager();
      this.renderBookmarksBar();
      this.renderNewTabShortcuts();
    } else if (action === 'restore') {
      bookmarkService.restoreFromTrash(item.id);
      this.showToast(`Restored "${item.title}"`);
      this.renderBookmarksManager();
      this.renderBookmarksBar();
      this.renderNewTabShortcuts();
    } else if (action === 'delete-perm') {
      if (confirm(`Permanently delete "${item.title}"? This cannot be undone.`)) {
        if (isFolder) {
          bookmarkService.deleteFolder(item.id, true);
        } else {
          bookmarkService.deleteBookmark(item.id, true);
        }
        this.showToast(`Permanently deleted "${item.title}"`);
        this.renderBookmarksManager();
        this.renderBookmarksBar();
        this.renderNewTabShortcuts();
      }
    }
  }

  renderBmBatchBar() {
    if (!this.dom.bmBatchBar) return;
    const count = this.bmSelectedIds.size;
    if (count === 0) {
      this.dom.bmBatchBar.style.display = 'none';
      return;
    }

    const isTrashView = this.currentBmFilter.rootId === 'root_trash';
    this.dom.bmBatchBar.style.display = 'flex';
    if (this.dom.bmBatchCount) this.dom.bmBatchCount.textContent = count;

    if (this.dom.btnBmBatchRestore) {
      this.dom.btnBmBatchRestore.style.display = isTrashView ? 'inline-flex' : 'none';
    }
    if (this.dom.bmBatchTrashLabel) {
      this.dom.bmBatchTrashLabel.textContent = isTrashView ? 'Delete Permanently' : 'Move to Trash';
    }
  }

  showBookmarkContextMenu(e, item) {
    if (!this.dom.bookmarkContextMenu || !item) return;
    this.activeBmContextItem = item;
    const isFolder = item.type === 'folder' || !!item.isFolder;
    const isTrash = this.currentBmFilter.rootId === 'root_trash' || item.parentId === 'root_trash';

    const ctxOpenTab = document.getElementById('ctx-bm-open-tab');
    const ctxOpenSplit = document.getElementById('ctx-bm-open-split');
    const ctxCopyLink = document.getElementById('ctx-bm-copy-link');
    const ctxEdit = document.getElementById('ctx-bm-edit');
    const ctxRestore = document.getElementById('ctx-bm-restore');
    const ctxDeleteLabel = document.getElementById('ctx-bm-delete-label');
    const ctxEditLabel = document.getElementById('ctx-bm-edit-label');

    if (ctxOpenTab) ctxOpenTab.style.display = isTrash ? 'none' : 'flex';
    if (ctxOpenSplit) ctxOpenSplit.style.display = (isTrash || isFolder) ? 'none' : 'flex';
    if (ctxCopyLink) ctxCopyLink.style.display = (isTrash || isFolder) ? 'none' : 'flex';
    if (ctxEdit) ctxEdit.style.display = isTrash ? 'none' : 'flex';
    if (ctxEditLabel) ctxEditLabel.textContent = isFolder ? 'Edit Folder' : 'Edit Bookmark';

    if (ctxRestore) ctxRestore.style.display = isTrash ? 'flex' : 'none';
    if (ctxDeleteLabel) ctxDeleteLabel.textContent = isTrash ? 'Delete Permanently' : 'Move to Trash';

    let posX = e.clientX;
    let posY = e.clientY;
    const triggerBtn = e.target ? e.target.closest('.bm-card-more-btn, .bm-row-more-btn') : null;
    if (triggerBtn) {
      const rect = triggerBtn.getBoundingClientRect();
      posX = rect.right - 180;
      posY = rect.bottom + 4;
    }

    this.dom.bookmarkContextMenu.style.left = `${Math.max(10, Math.min(posX, window.innerWidth - 200))}px`;
    this.dom.bookmarkContextMenu.style.top = `${Math.max(10, Math.min(posY, window.innerHeight - 240))}px`;
    this.dom.bookmarkContextMenu.style.display = 'block';
  }

  importBookmarksHtml() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const html = event.target.result;
        const imported = bookmarkService.importNetscapeHtml(html, 'root_bar');
        this.showToast(`Imported ${imported.length} bookmarks successfully!`);
      };
      reader.readAsText(file);
    };
    input.click();
  }

  exportBookmarksHtml() {
    const html = bookmarkService.exportNetscapeHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mynetwork-bookmarks-${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Bookmarks backup exported');
  }

  initBookmarkSettings() {
    if (this.dom.settingBookmarksBarMode) {
      this.dom.settingBookmarksBarMode.addEventListener('change', (e) => {
        settingsService.set('bookmarksBarMode', e.target.value);
        this.renderBookmarksBar();
      });
    }

    if (this.dom.settingNewtabBookmarksLayout) {
      this.dom.settingNewtabBookmarksLayout.addEventListener('change', (e) => {
        settingsService.set('newtabBookmarksLayout', e.target.value);
        this.renderNewTabShortcuts();
      });
    }

    if (this.dom.settingDefaultBookmarkFolder) {
      this.dom.settingDefaultBookmarkFolder.addEventListener('change', (e) => {
        settingsService.set('defaultBookmarkFolder', e.target.value);
      });
    }

    if (this.dom.settingBookmarkOpenTarget) {
      this.dom.settingBookmarkOpenTarget.addEventListener('change', (e) => {
        settingsService.set('bookmarkOpenTarget', e.target.value);
      });
    }

    // Widget Toggles
    const bindWidgetToggle = (el, settingKey, widgetId) => {
      if (!el) return;
      el.addEventListener('change', (e) => {
        settingsService.set(settingKey, e.target.checked);
        const w = document.getElementById(widgetId);
        if (w) w.style.display = e.target.checked ? 'flex' : 'none';
      });
    };

    bindWidgetToggle(this.dom.settingToggleWidgetScratchpad, 'widgetScratchpadVisible', 'widget-scratchpad');
    bindWidgetToggle(this.dom.settingToggleWidgetTasks, 'widgetTasksVisible', 'widget-tasks');
    bindWidgetToggle(this.dom.settingToggleWidgetTimer, 'widgetTimerVisible', 'widget-timer');
    bindWidgetToggle(this.dom.settingToggleWidgetRecent, 'widgetRecentVisible', 'widget-recent');

    if (this.dom.btnSettingsImportBm) {
      this.dom.btnSettingsImportBm.addEventListener('click', () => this.importBookmarksHtml());
    }
    if (this.dom.btnSettingsExportBm) {
      this.dom.btnSettingsExportBm.addEventListener('click', () => this.exportBookmarksHtml());
    }
  }

  populateBookmarkSettings() {
    const s = settingsService.getAll();
    if (this.dom.settingBookmarksBarMode) this.dom.settingBookmarksBarMode.value = s.bookmarksBarMode || 'never';
    if (this.dom.settingNewtabBookmarksLayout) this.dom.settingNewtabBookmarksLayout.value = s.newtabBookmarksLayout || 'spotlight';
    if (this.dom.settingDefaultBookmarkFolder) this.dom.settingDefaultBookmarkFolder.value = s.defaultBookmarkFolder || 'root_bar';
    if (this.dom.settingBookmarkOpenTarget) this.dom.settingBookmarkOpenTarget.value = s.bookmarkOpenTarget || 'current';
    if (this.dom.settingToggleWidgetScratchpad) this.dom.settingToggleWidgetScratchpad.checked = s.widgetScratchpadVisible !== false;
    if (this.dom.settingToggleWidgetTasks) this.dom.settingToggleWidgetTasks.checked = s.widgetTasksVisible !== false;
    if (this.dom.settingToggleWidgetTimer) this.dom.settingToggleWidgetTimer.checked = s.widgetTimerVisible !== false;
    if (this.dom.settingToggleWidgetRecent) this.dom.settingToggleWidgetRecent.checked = s.widgetRecentVisible !== false;
  }

  initBookmarksController() {
    // 1. Omnibox Star Button -> Toggle Popover
    if (this.dom.btnBookmark) {
      this.dom.btnBookmark.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleBookmarkPopover();
      });
    }

    // 2. Star Popover Close & Cancel
    if (this.dom.btnBmPopoverClose) {
      this.dom.btnBmPopoverClose.addEventListener('click', () => this.closeBookmarkPopover());
    }
    if (this.dom.btnBmPopoverCancel) {
      this.dom.btnBmPopoverCancel.addEventListener('click', () => this.closeBookmarkPopover());
    }

    // 3. Star Popover Save & Remove
    if (this.dom.btnBmPopoverSave) {
      this.dom.btnBmPopoverSave.addEventListener('click', () => this.saveBookmarkFromPopover());
    }
    if (this.dom.btnBmPopoverRemove) {
      this.dom.btnBmPopoverRemove.addEventListener('click', () => this.removeBookmarkFromPopover());
    }

    // 4. Star Popover Tag Input (Enter adds chip)
    if (this.dom.bmPopoverTagsInput) {
      this.dom.bmPopoverTagsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const val = this.dom.bmPopoverTagsInput.value.trim().replace(/^#/, '');
          if (val && !this.popoverActiveTags.includes(val)) {
            this.popoverActiveTags.push(val);
            this.renderPopoverTags();
          }
          this.dom.bmPopoverTagsInput.value = '';
        }
      });
    }

    // 5. Star Popover New Folder inline button
    if (this.dom.btnBmPopoverNewFolder) {
      this.dom.btnBmPopoverNewFolder.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.dom.bmPopoverNewFolderRow) {
          const isVisible = this.dom.bmPopoverNewFolderRow.style.display === 'flex';
          this.dom.bmPopoverNewFolderRow.style.display = isVisible ? 'none' : 'flex';
          if (!isVisible && this.dom.bmPopoverNewFolderInput) {
            this.dom.bmPopoverNewFolderInput.value = '';
            this.dom.bmPopoverNewFolderInput.focus();
          }
        }
      });
    }

    if (this.dom.btnBmPopoverCreateFolderCancel) {
      this.dom.btnBmPopoverCreateFolderCancel.addEventListener('click', () => {
        if (this.dom.bmPopoverNewFolderRow) this.dom.bmPopoverNewFolderRow.style.display = 'none';
      });
    }

    const handleConfirmCreateInlineFolder = () => {
      const name = this.dom.bmPopoverNewFolderInput ? this.dom.bmPopoverNewFolderInput.value.trim() : '';
      if (!name) return;
      const folder = bookmarkService.createFolder(name, 'root_bar');
      this.populatePopoverFolders(folder.id);
      if (this.dom.bmPopoverNewFolderRow) this.dom.bmPopoverNewFolderRow.style.display = 'none';
      this.showToast(`Folder "${name}" created`);
    };

    if (this.dom.btnBmPopoverCreateFolderConfirm) {
      this.dom.btnBmPopoverCreateFolderConfirm.addEventListener('click', handleConfirmCreateInlineFolder);
    }

    if (this.dom.bmPopoverNewFolderInput) {
      this.dom.bmPopoverNewFolderInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirmCreateInlineFolder();
        } else if (e.key === 'Escape') {
          if (this.dom.bmPopoverNewFolderRow) this.dom.bmPopoverNewFolderRow.style.display = 'none';
        }
      });
    }

    // 6. Favorites Top Bar Add button
    if (this.dom.btnBookmarksBarAdd) {
      this.dom.btnBookmarksBarAdd.addEventListener('click', () => {
        const activeTab = tabManager.getActiveTab();
        if (activeTab && activeTab.url && !activeTab.url.startsWith('mynetwork://')) {
          this.toggleBookmarkPopover();
        } else {
          this.openAddShortcutModal();
        }
      });
    }

    // 7. Dedicated Bookmarks Manager View (mynetwork://bookmarks)
    // Back button
    if (this.dom.btnBookmarksBack) {
      this.dom.btnBookmarksBack.addEventListener('click', () => {
        const active = tabManager.getActiveTab();
        const nonBmTab = tabManager.getTabs().find(t => t.url !== BOOKMARKS_URL && t.url !== LEGACY_BOOKMARKS_URL && t.url !== SETTINGS_URL && t.url !== HISTORY_URL);
        if (nonBmTab) {
          tabManager.activateTab(nonBmTab.id);
        } else {
          tabManager.createTab(DEFAULT_NEWTAB_URL, 'New Tab');
          if (active) tabManager.closeTab(active.id);
        }
      });
    }

    // Search Input in Bookmarks Manager
    if (this.dom.macBookmarksSearch) {
      this.dom.macBookmarksSearch.addEventListener('input', (e) => {
        this.currentBmFilter.query = e.target.value.trim();
        if (this.dom.btnBookmarksClearSearch) {
          this.dom.btnBookmarksClearSearch.style.display = this.currentBmFilter.query ? 'flex' : 'none';
        }
        this.renderBookmarksList();
      });
    }

    if (this.dom.btnBookmarksClearSearch) {
      this.dom.btnBookmarksClearSearch.addEventListener('click', () => {
        if (this.dom.macBookmarksSearch) {
          this.dom.macBookmarksSearch.value = '';
          this.dom.macBookmarksSearch.focus();
        }
        this.currentBmFilter.query = '';
        this.dom.btnBookmarksClearSearch.style.display = 'none';
        this.renderBookmarksList();
      });
    }

    // Add New Folder button in Manager
    if (this.dom.btnBmAddNewFolder) {
      this.dom.btnBmAddNewFolder.addEventListener('click', () => {
        this.openAddBookmarkFolderModal();
      });
    }

    // Add New Bookmark button in Manager
    if (this.dom.btnBmAddNewBookmark) {
      this.dom.btnBmAddNewBookmark.addEventListener('click', () => {
        this.openAddShortcutModal();
      });
    }

    // View Mode Toggle (Grid vs List)
    if (this.dom.btnBmViewGrid) {
      this.dom.btnBmViewGrid.addEventListener('click', () => {
        this.currentBmViewMode = 'grid';
        if (this.dom.btnBmViewGrid) this.dom.btnBmViewGrid.classList.add('active');
        if (this.dom.btnBmViewList) this.dom.btnBmViewList.classList.remove('active');
        this.renderBookmarksList();
      });
    }
    if (this.dom.btnBmViewList) {
      this.dom.btnBmViewList.addEventListener('click', () => {
        this.currentBmViewMode = 'list';
        if (this.dom.btnBmViewList) this.dom.btnBmViewList.classList.add('active');
        if (this.dom.btnBmViewGrid) this.dom.btnBmViewGrid.classList.remove('active');
        this.renderBookmarksList();
      });
    }

    // Empty Trash button
    if (this.dom.btnBmEmptyTrash) {
      this.dom.btnBmEmptyTrash.addEventListener('click', () => {
        if (confirm('Permanently delete all bookmarks in Trash?')) {
          bookmarkService.emptyTrash();
          this.showToast('Trash emptied');
        }
      });
    }

    // Import / Export HTML buttons
    if (this.dom.btnBmImportHtml) {
      this.dom.btnBmImportHtml.addEventListener('click', () => this.importBookmarksHtml());
    }
    if (this.dom.btnBmExportHtml) {
      this.dom.btnBmExportHtml.addEventListener('click', () => this.exportBookmarksHtml());
    }

    // Modals: Add Shortcut / Bookmark Form Submit
    if (this.dom.formAddShortcut) {
      this.dom.formAddShortcut.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = this.dom.shortcutEditId ? this.dom.shortcutEditId.value : null;
        const title = this.dom.shortcutInputTitle.value.trim();
        const url = this.dom.shortcutInputUrl.value.trim();
        const parentId = this.dom.shortcutInputFolder ? this.dom.shortcutInputFolder.value : 'root_bar';
        const wsVal = this.dom.shortcutInputWs ? this.dom.shortcutInputWs.value : 'auto';
        const tagsRaw = this.dom.shortcutInputTags ? this.dom.shortcutInputTags.value : '';
        const tags = tagsRaw.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);

        if (!title || !url) return;

        if (id) {
          const updates = { title, url, parentId, tags };
          if (wsVal && wsVal !== 'auto') updates.workspaceId = wsVal;
          bookmarkService.updateBookmark(id, updates);
          this.showToast(`Updated "${title}"`);
        } else {
          bookmarkService.createBookmark({
            title,
            url,
            parentId,
            workspaceId: wsVal,
            tags
          });
          this.showToast(`Added "${title}" to Bookmarks`);
        }
        if (this.dom.modalAddShortcut) this.dom.modalAddShortcut.close();
        this.renderBookmarksManager();
        this.renderBookmarksBar();
        this.renderNewTabShortcuts();
      });
    }

    if (this.dom.btnCloseShortcutModal) {
      this.dom.btnCloseShortcutModal.addEventListener('click', () => {
        if (this.dom.modalAddShortcut) this.dom.modalAddShortcut.close();
      });
    }
    if (this.dom.btnCancelShortcutModal) {
      this.dom.btnCancelShortcutModal.addEventListener('click', () => {
        if (this.dom.modalAddShortcut) this.dom.modalAddShortcut.close();
      });
    }
    if (this.dom.btnDeleteShortcut) {
      this.dom.btnDeleteShortcut.addEventListener('click', () => {
        const id = this.dom.shortcutEditId ? this.dom.shortcutEditId.value : null;
        if (id) {
          bookmarkService.moveToTrash(id);
          this.showToast('Bookmark moved to Trash');
          this.renderBookmarksManager();
          this.renderBookmarksBar();
          this.renderNewTabShortcuts();
        }
        if (this.dom.modalAddShortcut) this.dom.modalAddShortcut.close();
      });
    }

    // Modals: Add Bookmark Folder Form Submit
    if (this.dom.formAddBmFolder) {
      this.dom.formAddBmFolder.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = this.dom.bmFolderEditId ? this.dom.bmFolderEditId.value : null;
        const title = this.dom.bmFolderInputTitle.value.trim();
        const parentId = this.dom.bmFolderInputParent ? this.dom.bmFolderInputParent.value : 'root_bar';
        const activeColorEl = document.querySelector('#bm-folder-color-options .color-dot.active');
        const color = activeColorEl ? activeColorEl.getAttribute('data-color') : '#f59e0b';
        if (!title) return;

        if (id) {
          bookmarkService.updateFolder(id, { title, parentId, color });
          this.showToast(`Updated folder "${title}"`);
        } else {
          bookmarkService.createFolder({ title, parentId, color });
          this.showToast(`Created folder "${title}"`);
        }
        if (this.dom.modalAddBmFolder) this.dom.modalAddBmFolder.close();
        this.renderBookmarksManager();
        this.renderBookmarksBar();
      });
    }

    if (this.dom.btnCloseBmFolderModal) {
      this.dom.btnCloseBmFolderModal.addEventListener('click', () => {
        if (this.dom.modalAddBmFolder) this.dom.modalAddBmFolder.close();
      });
    }
    if (this.dom.btnCancelBmFolderModal) {
      this.dom.btnCancelBmFolderModal.addEventListener('click', () => {
        if (this.dom.modalAddBmFolder) this.dom.modalAddBmFolder.close();
      });
    }
    if (this.dom.btnDeleteBmFolder) {
      this.dom.btnDeleteBmFolder.addEventListener('click', () => {
        const id = this.dom.bmFolderEditId ? this.dom.bmFolderEditId.value : null;
        if (id) {
          if (confirm('Move folder and all its contents to Trash?')) {
            bookmarkService.moveToTrash(id);
            this.showToast('Folder moved to Trash');
            this.renderBookmarksManager();
            this.renderBookmarksBar();
            this.renderNewTabShortcuts();
          }
        }
        if (this.dom.modalAddBmFolder) this.dom.modalAddBmFolder.close();
      });
    }

    // Color picker in folder modal
    document.querySelectorAll('#bm-folder-color-options .color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        document.querySelectorAll('#bm-folder-color-options .color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });

    // Batch Action Bar Listeners
    if (this.dom.btnBmBatchSelectAll) {
      this.dom.btnBmBatchSelectAll.addEventListener('click', () => {
        let items = [];
        if (this.currentBmFilter.rootId === 'root_trash') items = bookmarkService.getTrashItems();
        else if (this.currentBmFilter.folderId) items = bookmarkService.getFolderChildren(this.currentBmFilter.folderId);
        else if (this.currentBmFilter.rootId === 'root_bar') items = bookmarkService.getFavoritesBarItems();
        else if (this.currentBmFilter.rootId === 'root_reading') items = bookmarkService.getReadingList();
        else items = bookmarkService.getAllBookmarks();

        items.forEach(i => {
          if (i && i.id) this.bmSelectedIds.add(i.id);
        });
        this.renderBookmarksList();
      });
    }

    if (this.dom.btnBmBatchTrash) {
      this.dom.btnBmBatchTrash.addEventListener('click', () => {
        const ids = Array.from(this.bmSelectedIds);
        if (ids.length === 0) return;
        const isTrash = this.currentBmFilter.rootId === 'root_trash';
        if (isTrash) {
          if (confirm(`Permanently delete ${ids.length} selected items? This cannot be undone.`)) {
            bookmarkService.batchDelete(ids, true);
            this.showToast(`Permanently deleted ${ids.length} items`);
            this.bmSelectedIds.clear();
            this.renderBookmarksManager();
          }
        } else {
          bookmarkService.batchMoveToTrash(ids);
          this.showToast(`Moved ${ids.length} items to Trash`);
          this.bmSelectedIds.clear();
          this.renderBookmarksManager();
          this.renderBookmarksBar();
          this.renderNewTabShortcuts();
        }
      });
    }

    if (this.dom.btnBmBatchRestore) {
      this.dom.btnBmBatchRestore.addEventListener('click', () => {
        const ids = Array.from(this.bmSelectedIds);
        if (ids.length === 0) return;
        bookmarkService.batchRestore(ids);
        this.showToast(`Restored ${ids.length} items from Trash`);
        this.bmSelectedIds.clear();
        this.renderBookmarksManager();
        this.renderBookmarksBar();
        this.renderNewTabShortcuts();
      });
    }

    if (this.dom.btnBmBatchClear) {
      this.dom.btnBmBatchClear.addEventListener('click', () => {
        this.bmSelectedIds.clear();
        this.renderBookmarksList();
      });
    }

    // Bookmark Context Menu Items
    const ctxBmOpenTab = document.getElementById('ctx-bm-open-tab');
    if (ctxBmOpenTab) {
      ctxBmOpenTab.addEventListener('click', () => {
        if (this.activeBmContextItem && this.activeBmContextItem.url) {
          tabManager.createTab(this.activeBmContextItem.url, this.activeBmContextItem.title, this.activeBmContextItem.favicon);
        }
        if (this.dom.bookmarkContextMenu) this.dom.bookmarkContextMenu.style.display = 'none';
      });
    }

    const ctxBmOpenSplit = document.getElementById('ctx-bm-open-split');
    if (ctxBmOpenSplit) {
      ctxBmOpenSplit.addEventListener('click', () => {
        if (this.activeBmContextItem && this.activeBmContextItem.url) {
          browserContext.toggleSplitView(true);
          tabManager.createTab(this.activeBmContextItem.url, this.activeBmContextItem.title, this.activeBmContextItem.favicon);
        }
        if (this.dom.bookmarkContextMenu) this.dom.bookmarkContextMenu.style.display = 'none';
      });
    }

    const ctxBmEdit = document.getElementById('ctx-bm-edit');
    if (ctxBmEdit) {
      ctxBmEdit.addEventListener('click', () => {
        if (this.activeBmContextItem) {
          if (this.activeBmContextItem.isFolder || this.activeBmContextItem.type === 'folder') {
            this.openAddBookmarkFolderModal(this.activeBmContextItem);
          } else {
            this.openAddShortcutModal(this.activeBmContextItem);
          }
        }
        if (this.dom.bookmarkContextMenu) this.dom.bookmarkContextMenu.style.display = 'none';
      });
    }

    const ctxBmCopyLink = document.getElementById('ctx-bm-copy-link');
    if (ctxBmCopyLink) {
      ctxBmCopyLink.addEventListener('click', () => {
        if (this.activeBmContextItem && this.activeBmContextItem.url) {
          navigator.clipboard.writeText(this.activeBmContextItem.url);
          this.showToast('Copied bookmark URL');
        }
        if (this.dom.bookmarkContextMenu) this.dom.bookmarkContextMenu.style.display = 'none';
      });
    }

    const ctxBmRestore = document.getElementById('ctx-bm-restore');
    if (ctxBmRestore) {
      ctxBmRestore.addEventListener('click', () => {
        if (this.activeBmContextItem) {
          bookmarkService.restoreFromTrash(this.activeBmContextItem.id);
          this.showToast(`Restored "${this.activeBmContextItem.title}"`);
          this.renderBookmarksManager();
          this.renderBookmarksBar();
          this.renderNewTabShortcuts();
        }
        if (this.dom.bookmarkContextMenu) this.dom.bookmarkContextMenu.style.display = 'none';
      });
    }

    const ctxBmDelete = document.getElementById('ctx-bm-delete');
    if (ctxBmDelete) {
      ctxBmDelete.addEventListener('click', async () => {
        if (this.activeBmContextItem) {
          const isTrash = this.currentBmFilter.rootId === 'root_trash' || this.activeBmContextItem.parentId === 'root_trash';
          if (isTrash) {
            const confirmed = await this.showMacConfirm({
              title: `Delete "${this.activeBmContextItem.title}"?`,
              message: 'This item will be permanently removed from your bookmarks.',
              confirmText: 'Delete Permanently',
              isDanger: true
            });
            if (confirmed) {
              if (this.activeBmContextItem.type === 'folder' || this.activeBmContextItem.isFolder) {
                bookmarkService.deleteFolder(this.activeBmContextItem.id, true);
              } else {
                bookmarkService.deleteBookmark(this.activeBmContextItem.id, true);
              }
              this.showToast(`Permanently deleted "${this.activeBmContextItem.title}"`);
              this.renderBookmarksManager();
            }
          } else {
            bookmarkService.moveToTrash(this.activeBmContextItem.id);
            this.showToast(`Moved "${this.activeBmContextItem.title}" to Trash`);
            this.renderBookmarksManager();
            this.renderBookmarksBar();
            this.renderNewTabShortcuts();
          }
        }
        if (this.dom.bookmarkContextMenu) this.dom.bookmarkContextMenu.style.display = 'none';
      });
    }

    // Global click dismisses bookmark dropdowns & context menus
    document.addEventListener('click', (e) => {
      if (this.dom.bookmarkStarPopover && !this.dom.bookmarkStarPopover.contains(e.target) && !e.target.closest('#btn-bookmark')) {
        this.closeBookmarkPopover();
      }
      if (this.dom.bookmarksBarDropdown && !this.dom.bookmarksBarDropdown.contains(e.target) && !e.target.closest('.bm-bar-item.folder')) {
        this.dom.bookmarksBarDropdown.style.display = 'none';
      }
      if (this.dom.bookmarkContextMenu && !this.dom.bookmarkContextMenu.contains(e.target)) {
        this.dom.bookmarkContextMenu.style.display = 'none';
      }
    });

    // Settings Bookmarks Integration
    this.initBookmarkSettings();
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
        this.openHistoryTab();
        if (this.dom.appDropdownMenu) this.dom.appDropdownMenu.classList.remove('active');
      });
    }

    const menuItemBookmarks = document.getElementById('menu-item-bookmarks');
    if (menuItemBookmarks) {
      menuItemBookmarks.addEventListener('click', () => {
        this.openBookmarksTab();
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
      const btnReveal = row.querySelector('.btn-reveal-pwd');
      if (btnReveal) {
        btnReveal.addEventListener('click', () => {
          this.ensureVaultUnlocked(() => {
            if (this.revealedPasswords.has(c.id)) {
              this.revealedPasswords.delete(c.id);
            } else {
              this.revealedPasswords.add(c.id);
            }
            this.renderPasswordsList();
          });
        });
      }

      // Copy password
      const btnCopy = row.querySelector('.btn-copy-pwd');
      if (btnCopy) {
        btnCopy.addEventListener('click', () => {
          this.ensureVaultUnlocked(() => {
            if (navigator.clipboard && c.password) {
              navigator.clipboard.writeText(c.password);
              this.showToast('Password copied to clipboard');
            }
          });
        });
      }

      // Copy username
      const btnCopyUser = row.querySelector('.btn-copy-user');
      if (btnCopyUser) {
        btnCopyUser.addEventListener('click', () => {
          if (navigator.clipboard && c.username) {
            navigator.clipboard.writeText(c.username);
            this.showToast('Username copied to clipboard');
          }
        });
      }

      // Edit
      const btnEdit = row.querySelector('.btn-edit-pwd');
      if (btnEdit) {
        btnEdit.addEventListener('click', () => {
          this.openPasswordModal(c);
        });
      }

      // Delete
      const btnDel = row.querySelector('.btn-del-pwd');
      if (btnDel) {
        btnDel.addEventListener('click', () => {
          this.ensureVaultUnlocked(() => {
            if (confirm(`Delete password for "${c.title || c.domain || c.username}"?`)) {
              passwordService.deleteCredential(c.id);
              this.showToast('Password removed');
              this.renderPasswordsList();
              this.renderPasswordHealth();
            }
          });
        });
      }

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
     PROJECT WORKSPACES CONTROLLER
     ========================================================================== */
  initWorkspaceController() {
    // 1. Toggle Workspace Dropdown
    if (this.dom.sidebarWsSelect) {
      this.dom.sidebarWsSelect.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = this.dom.sidebarWsDropdown && this.dom.sidebarWsDropdown.style.display !== 'none';
        this.toggleWorkspaceDropdown(!isOpen);
      });
    }

    // 2. Add New Project buttons
    if (this.dom.btnSidebarNewWs) {
      this.dom.btnSidebarNewWs.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleWorkspaceDropdown(false);
        this.openWorkspaceModal();
      });
    }

    if (this.dom.btnCreateProjectModalTrigger) {
      this.dom.btnCreateProjectModalTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleWorkspaceDropdown(false);
        this.openWorkspaceModal();
      });
    }

    // 3. Projects Dashboard Nav Button
    if (this.dom.btnManageProjectsNav) {
      this.dom.btnManageProjectsNav.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleWorkspaceDropdown(false);
        this.openProjectsTab();
      });
    }

    if (this.dom.btnWorkspaces) {
      this.dom.btnWorkspaces.addEventListener('click', () => {
        this.openProjectsTab();
      });
    }

    // Close dropdown on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#sidebar-workspace-header') && !e.target.closest('#sidebar-ws-dropdown')) {
        this.toggleWorkspaceDropdown(false);
      }
    });

    this.renderWorkspaceSidebar();
  }

  toggleWorkspaceDropdown(open) {
    if (!this.dom.sidebarWsDropdown) return;
    this.dom.sidebarWsDropdown.style.display = open ? 'block' : 'none';
    if (this.dom.sidebarWsSelect) {
      this.dom.sidebarWsSelect.classList.toggle('open', open);
    }
  }

  renderWorkspaceSidebar() {
    const activeWs = workspaceService.getActiveWorkspace();
    if (!activeWs) return;

    // Update active pill in sidebar
    if (this.dom.sidebarActiveWsDot) {
      this.dom.sidebarActiveWsDot.style.background = activeWs.color || '#007aff';
    }
    if (this.dom.sidebarActiveWsName) {
      this.dom.sidebarActiveWsName.textContent = activeWs.name || 'General';
    }

    const allWorkspaces = workspaceService.getAllWorkspaces();

    // Render Quick Chips Row
    if (this.dom.workspaceQuickChips) {
      this.dom.workspaceQuickChips.innerHTML = '';
      allWorkspaces.forEach(ws => {
        const chip = document.createElement('div');
        const isActive = ws.id === activeWs.id;
        chip.className = `ws-quick-dot ${isActive ? 'active' : ''}`;
        chip.title = `${ws.name} - ${tabManager.getTabsForWorkspace(ws.id).length} open tabs`;
        chip.innerHTML = `
          <span class="ws-color-dot" style="background: ${ws.color || '#007aff'}; width: 6px; height: 6px;"></span>
          <span>${ws.name}</span>
        `;
        chip.addEventListener('click', () => {
          this.switchWorkspace(ws.id);
        });
        this.dom.workspaceQuickChips.appendChild(chip);
      });
    }

    // Render Dropdown List
    if (this.dom.sidebarWsDropdownList) {
      this.dom.sidebarWsDropdownList.innerHTML = '';
      allWorkspaces.forEach(ws => {
        const item = document.createElement('div');
        const isActive = ws.id === activeWs.id;
        const tabCount = tabManager.getTabsForWorkspace(ws.id).length;
        item.className = `sidebar-ws-item ${isActive ? 'active' : ''}`;
        item.innerHTML = `
          <div class="sidebar-ws-item-left">
            <span class="ws-color-dot" style="background: ${ws.color || '#007aff'};"></span>
            <span>${ws.name}</span>
          </div>
          <span class="sidebar-ws-item-badge">${tabCount} ${tabCount === 1 ? 'tab' : 'tabs'}</span>
        `;
        item.addEventListener('click', () => {
          this.toggleWorkspaceDropdown(false);
          this.switchWorkspace(ws.id);
        });
        this.dom.sidebarWsDropdownList.appendChild(item);
      });
    }
  }

  switchWorkspace(workspaceId) {
    if (!workspaceId) return;
    workspaceService.setActiveWorkspace(workspaceId);
    this.renderWorkspaceSidebar();
    this.renderWorkspaceTabs();
    this.showToast(`Switched to "${workspaceService.getActiveWorkspace()?.name || 'Project'}"`);
  }

  cycleWorkspace(direction = 1) {
    const all = workspaceService.getAllWorkspaces();
    if (all.length <= 1) return;
    const currentId = workspaceService.getActiveWorkspaceId();
    const idx = all.findIndex(w => w.id === currentId);
    let nextIdx = (idx + direction + all.length) % all.length;
    this.switchWorkspace(all[nextIdx].id);
  }

  switchToWorkspaceByIndex(index) {
    const all = workspaceService.getAllWorkspaces();
    if (all[index]) {
      this.switchWorkspace(all[index].id);
    }
  }

  /* ==========================================================================
     DEDICATED macOS PROJECTS OVERVIEW CONTROLLER (mynetwork://projects)
     ========================================================================== */
  initProjectsOverviewController() {
    if (this.dom.btnProjectsBack) {
      this.dom.btnProjectsBack.addEventListener('click', () => {
        const nonProjectsTab = tabManager.getTabs().find(t => 
          t.url !== PROJECTS_URL && 
          t.url !== LEGACY_PROJECTS_URL && 
          t.url !== SETTINGS_URL && 
          t.url !== LEGACY_SETTINGS_URL && 
          t.url !== HISTORY_URL && 
          t.url !== LEGACY_HISTORY_URL && 
          t.url !== BOOKMARKS_URL && 
          t.url !== LEGACY_BOOKMARKS_URL
        );
        if (nonProjectsTab) {
          tabManager.activateTab(nonProjectsTab.id);
        } else {
          tabManager.createTab(DEFAULT_NEWTAB_URL, 'New Tab', null, workspaceService.getActiveWorkspaceId());
        }
      });
    }

    if (this.dom.btnProjectsAddNew) {
      this.dom.btnProjectsAddNew.addEventListener('click', () => {
        this.openWorkspaceModal();
      });
    }

    if (this.dom.macProjectsSearch) {
      this.dom.macProjectsSearch.addEventListener('input', (e) => {
        this.projectsSearchQuery = (e.target.value || '').trim().toLowerCase();
        this.renderProjectsDashboard();
      });
    }
  }

  openProjectsTab() {
    const existing = tabManager.getTabs().find(t => t.url === PROJECTS_URL || t.url === LEGACY_PROJECTS_URL);
    if (existing) {
      tabManager.activateTab(existing.id);
    } else {
      tabManager.createTab(PROJECTS_URL, 'Projects', null, workspaceService.getActiveWorkspaceId());
    }
    this.renderProjectsDashboard();
  }

  renderProjectsDashboard() {
    if (!this.dom.projectsCardsContainer) return;
    this.dom.projectsCardsContainer.innerHTML = '';

    const allWorkspaces = workspaceService.getAllWorkspaces();
    const allTabs = tabManager.getAllTabs();
    const activeWsId = workspaceService.getActiveWorkspaceId();

    if (this.dom.projectsStatsBadge) {
      this.dom.projectsStatsBadge.textContent = `${allWorkspaces.length} Projects • ${allTabs.length} Tabs`;
    }

    const iconMap = {
      globe: '🌐',
      code: '💻',
      user: '👤',
      briefcase: '💼',
      rocket: '🚀',
      star: '⭐',
      folder: '📁'
    };

    const filtered = allWorkspaces.filter(ws => {
      if (!this.projectsSearchQuery) return true;
      const q = this.projectsSearchQuery;
      const matchName = (ws.name || '').toLowerCase().includes(q);
      const matchDesc = (ws.description || '').toLowerCase().includes(q);
      const matchDev = (ws.devUrl || '').toLowerCase().includes(q);
      const wsTabs = tabManager.getTabsForWorkspace(ws.id);
      const matchTabs = wsTabs.some(t => (t.title || '').toLowerCase().includes(q) || (t.url || '').toLowerCase().includes(q));
      return matchName || matchDesc || matchDev || matchTabs;
    });

    if (filtered.length === 0) {
      this.dom.projectsCardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: #86868b; font-size: 13px;">
          No projects match your search query.
        </div>
      `;
      return;
    }

    filtered.forEach(ws => {
      const wsTabs = tabManager.getTabsForWorkspace(ws.id);
      const isActive = ws.id === activeWsId;
      const emojiIcon = iconMap[ws.icon] || '📁';
      const wsColor = ws.color || '#007aff';

      const card = document.createElement('div');
      card.className = `project-card ${isActive ? 'active' : ''}`;
      card.setAttribute('data-workspace-id', ws.id);
      
      let tabsHtml = '';
      if (wsTabs.length === 0) {
        tabsHtml = `<div class="project-empty-tabs">No open tabs in this project</div>`;
      } else {
        tabsHtml = wsTabs.slice(0, 4).map(t => {
          const faviconHtml = t.favicon 
            ? `<img src="${t.favicon}" width="13" height="13" style="border-radius: 2.5px;" onerror="this.outerHTML='<svg width=\\'12\\' height=\\'12\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><circle cx=\\'12\\' cy=\\'12\\'/></svg>'">`
            : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12"/></svg>`;
          return `
            <div class="project-tab-row" data-tab-id="${t.id}" title="${this.escapeHtml(t.url)}">
              <span class="project-tab-favicon">${faviconHtml}</span>
              <span class="project-tab-title">${this.escapeHtml(t.title || t.url || 'New Tab')}</span>
            </div>
          `;
        }).join('');

        if (wsTabs.length > 4) {
          tabsHtml += `<div style="font-size: 10.5px; color: #86868b; padding: 3px 6px; text-align: center;">+${wsTabs.length - 4} more tabs</div>`;
        }
      }

      card.innerHTML = `
        <div class="project-card-header">
          <div class="project-card-main-info">
            <div class="project-card-icon-badge" style="background: ${wsColor}18; border: 1px solid ${wsColor}33;">
              ${emojiIcon}
            </div>
            <div class="project-card-titles">
              <h4 class="project-card-title">${this.escapeHtml(ws.name)}</h4>
              ${ws.description ? `<p class="project-card-desc">${this.escapeHtml(ws.description)}</p>` : ''}
            </div>
          </div>
          <div class="project-card-header-actions">
            ${isActive ? `
              <div class="project-active-indicator">
                <span class="project-active-dot"></span>
                <span>Active</span>
              </div>
            ` : ''}
            <button class="mac-icon-btn-subtle btn-project-edit" title="Edit Project Settings">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
            </button>
          </div>
        </div>

        <div class="project-card-body">
          <div class="project-tabs-preview-header">
            <span>OPEN TABS</span>
            <span>${wsTabs.length}</span>
          </div>
          <div class="project-card-tabs-list">
            ${tabsHtml}
          </div>
        </div>

        <div class="project-card-footer">
          <div class="project-card-left-tags">
            ${ws.devUrl ? `
              <button class="project-dev-tag btn-project-dev-launch" title="Launch Dev URL: ${this.escapeHtml(ws.devUrl)}" data-url="${this.escapeHtml(ws.devUrl)}">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>${this.escapeHtml(ws.devUrl.replace(/^https?:\/\//, ''))}</span>
              </button>
            ` : `<span style="font-size: 11px; color: #86868b;">${ws.isDefault ? 'Default Space' : 'Custom Workspace'}</span>`}
          </div>

          <div>
            ${isActive ? `
              <span class="project-switch-btn active-status">● Current Space</span>
            ` : `
              <button class="project-switch-btn primary btn-project-switch">
                Switch Space
              </button>
            `}
          </div>
        </div>
      `;

      // Entire card left-click switches workspace
      card.addEventListener('click', (e) => {
        if (ws.id !== activeWsId) {
          this.switchWorkspace(ws.id);
          this.renderProjectsDashboard();
        }
      });

      // Bind Tab Rows to open/activate directly
      card.querySelectorAll('.project-tab-row').forEach(row => {
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          const tabId = row.getAttribute('data-tab-id');
          if (ws.id !== activeWsId) {
            this.switchWorkspace(ws.id);
          }
          tabManager.activateTab(tabId);
        });
      });

      // Bind Dev URL Launch
      const btnDev = card.querySelector('.btn-project-dev-launch');
      if (btnDev) {
        btnDev.addEventListener('click', (e) => {
          e.stopPropagation();
          const devUrl = btnDev.getAttribute('data-url');
          if (ws.id !== activeWsId) {
            this.switchWorkspace(ws.id);
          }
          tabManager.createTab(devUrl, 'Dev Server', null, ws.id);
        });
      }

      // Bind Edit Project Modal
      const btnEdit = card.querySelector('.btn-project-edit');
      if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openWorkspaceModal(ws.id);
        });
      }

      // Bind Switch Workspace Button
      const btnSwitch = card.querySelector('.btn-project-switch');
      if (btnSwitch) {
        btnSwitch.addEventListener('click', (e) => {
          e.stopPropagation();
          this.switchWorkspace(ws.id);
          this.renderProjectsDashboard();
        });
      }

      this.dom.projectsCardsContainer.appendChild(card);
    });
  }

  /* ==========================================================================
     PROJECT WORKSPACE CREATE / EDIT MODAL CONTROLLER
     ========================================================================== */
  initWorkspaceModal() {
    if (this.dom.btnCloseWorkspaceModal) {
      this.dom.btnCloseWorkspaceModal.addEventListener('click', () => {
        this.closeWorkspaceModal();
      });
    }

    if (this.dom.btnCancelWorkspaceModal) {
      this.dom.btnCancelWorkspaceModal.addEventListener('click', () => {
        this.closeWorkspaceModal();
      });
    }

    if (this.dom.modalCreateWorkspace) {
      this.dom.modalCreateWorkspace.addEventListener('click', (e) => {
        if (e.target === this.dom.modalCreateWorkspace) {
          this.closeWorkspaceModal();
        }
      });
    }

    if (this.dom.formCreateWorkspace) {
      this.dom.formCreateWorkspace.addEventListener('submit', (e) => {
        this.handleWorkspaceSubmit(e);
      });
    }

    if (this.dom.btnDeleteWorkspace) {
      this.dom.btnDeleteWorkspace.addEventListener('click', () => {
        const id = this.dom.workspaceFormId?.value;
        if (id) this.handleWorkspaceDelete(id);
      });
    }

    // Color Pickers
    if (this.dom.workspaceColorPicker) {
      this.dom.workspaceColorPicker.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          this.dom.workspaceColorPicker.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
        });
      });
    }

    // Icon Selector
    if (this.dom.workspaceIconSelector) {
      this.dom.workspaceIconSelector.querySelectorAll('.project-icon-choice').forEach(btn => {
        btn.addEventListener('click', () => {
          this.dom.workspaceIconSelector.querySelectorAll('.project-icon-choice').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    }
  }

  openWorkspaceModal(workspaceId = null) {
    if (!this.dom.modalCreateWorkspace) return;

    const isEdit = !!workspaceId;
    let wsData = null;
    if (isEdit) {
      wsData = workspaceService.getWorkspace(workspaceId);
    }

    if (this.dom.workspaceModalTitle) {
      this.dom.workspaceModalTitle.textContent = isEdit ? 'Edit Project Workspace' : 'New Project Workspace';
    }

    if (this.dom.workspaceFormId) this.dom.workspaceFormId.value = isEdit ? workspaceId : '';
    if (this.dom.workspaceFormName) this.dom.workspaceFormName.value = wsData ? wsData.name : '';
    if (this.dom.workspaceFormDevUrl) this.dom.workspaceFormDevUrl.value = wsData ? (wsData.devUrl || '') : '';
    if (this.dom.workspaceFormDesc) this.dom.workspaceFormDesc.value = wsData ? (wsData.description || '') : '';

    // Set Color
    const activeColor = wsData ? (wsData.color || '#007aff') : '#007aff';
    if (this.dom.workspaceColorPicker) {
      this.dom.workspaceColorPicker.querySelectorAll('.color-dot').forEach(dot => {
        dot.classList.toggle('active', dot.getAttribute('data-color') === activeColor);
      });
    }

    // Set Icon
    const activeIcon = wsData ? (wsData.icon || 'globe') : 'globe';
    if (this.dom.workspaceIconSelector) {
      this.dom.workspaceIconSelector.querySelectorAll('.project-icon-choice').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-icon') === activeIcon);
      });
    }

    // Toggle delete button
    if (this.dom.btnDeleteWorkspace) {
      this.dom.btnDeleteWorkspace.style.display = (isEdit && workspaceId !== 'ws_default') ? 'block' : 'none';
    }

    this.dom.modalCreateWorkspace.showModal();
    setTimeout(() => {
      if (this.dom.workspaceFormName) {
        this.dom.workspaceFormName.focus();
        this.dom.workspaceFormName.select();
      }
    }, 50);
  }

  closeWorkspaceModal() {
    if (this.dom.modalCreateWorkspace) {
      this.dom.modalCreateWorkspace.close();
    }
  }

  handleWorkspaceSubmit(e) {
    e.preventDefault();
    const id = this.dom.workspaceFormId?.value;
    const name = this.dom.workspaceFormName?.value?.trim();
    if (!name) return;

    const devUrl = this.dom.workspaceFormDevUrl?.value?.trim() || '';
    const description = this.dom.workspaceFormDesc?.value?.trim() || '';
    const color = this.dom.workspaceColorPicker?.querySelector('.color-dot.active')?.getAttribute('data-color') || '#007aff';
    const icon = this.dom.workspaceIconSelector?.querySelector('.project-icon-choice.active')?.getAttribute('data-icon') || 'globe';

    try {
      if (id) {
        workspaceService.updateWorkspace(id, { name, color, icon, description, devUrl });
        this.showToast(`Updated project "${name}"`);
      } else {
        const newWs = workspaceService.createWorkspace({ name, color, icon, description, devUrl });
        this.showToast(`Created project "${name}"`);
        this.switchWorkspace(newWs.id);
      }
      this.closeWorkspaceModal();
      this.renderWorkspaceSidebar();
      if (this.dom.projectsView && this.dom.projectsView.style.display !== 'none') {
        this.renderProjectsDashboard();
      }
    } catch (err) {
      console.error('[WorkspaceModal] Failed to save workspace:', err);
    }
  }

  showMacConfirm({ title = 'Are you sure?', message = '', confirmText = 'Confirm', isDanger = false } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('modal-mac-confirm');
      const titleEl = document.getElementById('mac-confirm-title');
      const msgEl = document.getElementById('mac-confirm-message');
      const okBtn = document.getElementById('btn-mac-confirm-ok');
      const cancelBtn = document.getElementById('btn-mac-confirm-cancel');

      if (!modal || !okBtn || !cancelBtn) {
        resolve(window.confirm(message || title));
        return;
      }

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      okBtn.textContent = confirmText;
      okBtn.className = `mac-sheet-btn ${isDanger ? 'mac-sheet-btn-danger' : 'mac-sheet-btn-primary'}`;

      const cleanup = () => {
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('cancel', onCancel);
        try { modal.close(); } catch (e) {}
      };

      const onOk = (e) => {
        e.preventDefault();
        cleanup();
        resolve(true);
      };

      const onCancel = (e) => {
        e.preventDefault();
        cleanup();
        resolve(false);
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      modal.addEventListener('cancel', onCancel);

      modal.showModal();
    });
  }

  async handleWorkspaceDelete(workspaceId) {
    const ws = workspaceService.getWorkspace(workspaceId);
    const wsName = ws ? ws.name : 'this project';
    const confirmed = await this.showMacConfirm({
      title: `Delete "${wsName}" Project?`,
      message: 'All open tabs and project state in this workspace will be closed. This action cannot be undone.',
      confirmText: 'Delete Project',
      isDanger: true
    });

    if (!confirmed) return;

    try {
      tabManager.closeWorkspaceTabs(workspaceId);
      workspaceService.deleteWorkspace(workspaceId);
      this.closeWorkspaceModal();
      this.renderWorkspaceSidebar();
      this.renderWorkspaceTabs();
      this.showToast(`Deleted "${wsName}" project workspace.`);
      if (this.dom.projectsView && this.dom.projectsView.style.display !== 'none') {
        this.renderProjectsDashboard();
      }
    } catch (err) {
      console.error('[WorkspaceModal] Failed to delete workspace:', err);
    }
  }

  /* ==========================================================================
     MAC OS TAB CONTEXT MENU CONTROLLER (With Move-to-Project Submenu)
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
          this.renderWorkspaceTabs();
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

    if (this.dom.ctxReopenGhostTab) {
      this.dom.ctxReopenGhostTab.addEventListener('click', () => {
        if (this.currentContextTabId) {
          const tab = tabManager.getTab(this.currentContextTabId);
          if (tab) {
            tabManager.createTab(tab.url, tab.title, tab.favicon, tab.workspaceId, null, true);
            this.showToast('👻 Reopened in Disposable Ghost Tab');
          }
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

    // Populate Move to Project Submenu
    if (this.dom.ctxWorkspaceSubmenu) {
      this.dom.ctxWorkspaceSubmenu.innerHTML = '';
      const allWorkspaces = workspaceService.getAllWorkspaces();
      const currentTabWsId = tab.workspaceId || 'ws_default';

      allWorkspaces.forEach(ws => {
        const isCurrent = ws.id === currentTabWsId;
        const item = document.createElement('div');
        item.className = `context-submenu-item ${isCurrent ? 'active' : ''}`;
        item.innerHTML = `
          <span class="ws-color-dot" style="background: ${ws.color || '#007aff'};"></span>
          <span style="flex: 1;">${this.escapeHtml(ws.name)}</span>
          ${isCurrent ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        `;
        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.closeTabContextMenu();
          if (!isCurrent) {
            tabManager.moveTabToWorkspace(tabId, ws.id);
            this.showToast(`Moved tab to "${ws.name}"`);
          }
        });
        this.dom.ctxWorkspaceSubmenu.appendChild(item);
      });

      // + Create New Project option
      const newWsItem = document.createElement('div');
      newWsItem.className = 'context-submenu-item new-project';
      newWsItem.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>New Project...</span>
      `;
      newWsItem.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.closeTabContextMenu();
        this.openWorkspaceModal();
      });
      this.dom.ctxWorkspaceSubmenu.appendChild(newWsItem);
    }

    // Populate Container Profile Submenu
    if (this.dom.ctxContainerSubmenu) {
      this.dom.ctxContainerSubmenu.innerHTML = '';
      const allContainers = containerService.getAllContainers();

      // Default Session Item
      const isDefault = !tab.containerId && !tab.isGhost;
      const defItem = document.createElement('div');
      defItem.className = `context-submenu-item ${isDefault ? 'active' : ''}`;
      defItem.innerHTML = `
        <span class="ws-color-dot" style="background: #8e8e93;"></span>
        <span style="flex: 1;">Default Session</span>
        ${isDefault ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      `;
      defItem.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.closeTabContextMenu();
        tab.containerId = null;
        tab.isGhost = false;
        this.reloadTabWithNewPartition(tab);
        this.renderWorkspaceTabs();
        this.showToast('Switched to Default Session');
      });
      this.dom.ctxContainerSubmenu.appendChild(defItem);

      // Named Container Items
      allContainers.forEach(container => {
        const isCurrent = tab.containerId === container.id;
        const item = document.createElement('div');
        item.className = `context-submenu-item ${isCurrent ? 'active' : ''}`;
        item.innerHTML = `
          <span class="ws-color-dot" style="background: ${container.color};"></span>
          <span style="flex: 1;">${this.escapeHtml(container.name)}</span>
          ${isCurrent ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        `;
        item.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.closeTabContextMenu();
          tab.containerId = container.id;
          tab.isGhost = false;
          this.reloadTabWithNewPartition(tab);
          this.renderWorkspaceTabs();
          this.showToast(`Switched to container "${container.name}"`);
        });
        this.dom.ctxContainerSubmenu.appendChild(item);
      });
    }

    const menu = this.dom.tabContextMenu;
    menu.style.display = 'flex';

    // Position menu safely inside window viewport
    const menuWidth = 200;
    const menuHeight = 320;
    let left = e.clientX;
    let top = e.clientY;

    if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 10;
    if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 10;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  reloadTabWithNewPartition(tab) {
    const oldWv = this.engineAdapter.webviewMap.get(tab.id);
    if (oldWv) {
      try {
        oldWv.remove();
      } catch (e) {}
      this.engineAdapter.webviewMap.delete(tab.id);
    }
    const newWv = this.engineAdapter.createWebview(tab);
    if (tabManager.getActiveTabId() === tab.id) {
      this.updateActiveTabUi(tab.id, tab);
    }
  }

  closeTabContextMenu() {
    if (this.dom.tabContextMenu) {
      this.dom.tabContextMenu.style.display = 'none';
      this.currentContextTabId = null;
    }
  }

  rebuildTabLists() {
    this.renderWorkspaceTabs();
  }

  /* ==========================================================================
     MULTI-PANE SPLIT SCREEN WEBVIEW CONTROLLER
     ========================================================================== */
  updateSplitViewWebviews(isSplit, layout = 'dual', tabIds = null) {
    const activeWsId = workspaceService.getActiveWorkspaceId();
    const wsTabs = tabManager.getTabsForWorkspace(activeWsId);
    const activeTabId = tabManager.getActiveTabId();

    // Reset split styles on all webviews
    this.engineAdapter.webviewMap.forEach((wv) => {
      wv.classList.remove('split-pane-visible', 'active-pane');
      wv.style.display = 'none';
    });

    // Reset split styles on tab pills
    document.querySelectorAll('.tab-item').forEach(el => {
      el.classList.remove('split-grouped', 'split-active');
    });

    if (!isSplit) {
      const activeTab = tabManager.getActiveTab();
      if (activeTab) {
        this.engineAdapter.showWebview(activeTab.id);
      }
      return;
    }

    let panes = [];
    if (tabIds && Array.isArray(tabIds) && tabIds.length >= 2) {
      panes = tabIds.map(id => tabManager.getTab(id)).filter(Boolean);
    }

    if (panes.length < 2) {
      let paneCount = 2;
      if (layout === 'triple') paneCount = 3;
      if (layout === 'quad') paneCount = 4;

      while (wsTabs.length < paneCount) {
        const newT = tabManager.createTab(DEFAULT_NEWTAB_URL, 'New Tab', null, activeWsId);
        wsTabs.push(newT);
      }
      panes = wsTabs.slice(0, paneCount);
    }

    panes.forEach(tab => {
      let wv = this.engineAdapter.webviewMap.get(tab.id);
      if (!wv) {
        wv = this.engineAdapter.createWebview(tab);
      }
      wv.style.display = 'flex';
      wv.classList.add('split-pane-visible');
      if (tab.id === activeTabId) {
        wv.classList.add('active-pane');
      }

      // Mark tab pills in sidebar as part of the split group
      const pill1 = document.getElementById(`tab-pill-${tab.id}`);
      if (pill1) {
        pill1.classList.add('split-grouped');
        if (tab.id === activeTabId) pill1.classList.add('split-active');
      }
      const pill2 = document.getElementById(`h-tab-pill-${tab.id}`);
      if (pill2) {
        pill2.classList.add('split-grouped');
        if (tab.id === activeTabId) pill2.classList.add('split-active');
      }

      wv.onmousedown = () => {
        if (tabManager.getActiveTabId() !== tab.id) {
          tabManager.activateTab(tab.id);
          this.updateSplitViewWebviews(true, layout, panes.map(p => p.id));
        }
      };
    });
  }

  /* ==========================================================================
     SMART OMNIBOX & COMMAND PALETTE HYBRID CONTROLLER
     ========================================================================== */
  initSmartOmnibox() {
    if (!this.dom.urlInput || !this.dom.omniboxDropdown) return;

    this.omniboxSelectedIndex = -1;
    this.currentOmniboxResults = [];

    // Hints Chips Click (@tabs, @history, @bookmark, >)
    this.dom.omniboxDropdown.querySelectorAll('.omnibox-hint-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const prefix = chip.getAttribute('data-prefix');
        this.dom.urlInput.value = prefix;
        this.dom.urlInput.focus();
        this.triggerOmniboxSearch(prefix);
      });
    });

    // Input Search Listener
    this.dom.urlInput.addEventListener('input', (e) => {
      const query = e.target.value;
      if (query.trim()) {
        this.triggerOmniboxSearch(query);
      } else {
        this.closeOmniboxDropdown();
      }
    });

    // Keyboard Navigation (ArrowUp, ArrowDown, Enter, Escape)
    this.dom.urlInput.addEventListener('keydown', (e) => {
      if (!this.dom.omniboxDropdown || this.dom.omniboxDropdown.style.display === 'none') {
        if (e.key === 'Enter') {
          const val = this.dom.urlInput.value.trim();
          if (val) this.navigateCurrentTab(val);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.moveOmniboxSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.moveOmniboxSelection(-1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeOmniboxDropdown();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.omniboxSelectedIndex >= 0 && this.currentOmniboxResults[this.omniboxSelectedIndex]) {
          this.executeOmniboxResult(this.currentOmniboxResults[this.omniboxSelectedIndex]);
        } else {
          const val = this.dom.urlInput.value.trim();
          if (val) this.navigateCurrentTab(val);
          this.closeOmniboxDropdown();
        }
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.omnibox-wrapper')) {
        this.closeOmniboxDropdown();
      }
    });
  }

  triggerOmniboxSearch(query) {
    if (!this.dom.omniboxDropdown || !this.dom.omniboxResultsList) return;
    const results = omniboxService.query(query);
    this.currentOmniboxResults = results;
    this.omniboxSelectedIndex = results.length > 0 ? 0 : -1;

    if (results.length === 0) {
      this.closeOmniboxDropdown();
      return;
    }

    this.dom.omniboxResultsList.innerHTML = '';
    results.forEach((res, idx) => {
      const item = document.createElement('div');
      item.className = `omnibox-result-item ${idx === 0 ? 'selected' : ''}`;
      item.setAttribute('data-index', idx);

      let iconHtml = '';
      if (res.isFaviconUrl) {
        iconHtml = `<img src="${res.icon}" width="14" height="14" style="border-radius: 3px;" onerror="this.outerHTML='<span>🌐</span>'">`;
      } else {
        iconHtml = `<span>${res.icon || '🔍'}</span>`;
      }

      let badgeHtml = '';
      if (res.type === 'tab') badgeHtml = '<span class="omnibox-result-badge">TAB</span>';
      else if (res.type === 'command') badgeHtml = `<span class="omnibox-result-badge" style="color: #007aff;">${res.shortcut || 'ACTION'}</span>`;
      else if (res.type === 'bookmark') badgeHtml = '<span class="omnibox-result-badge" style="color: #f59e0b;">BOOKMARK</span>';
      else if (res.type === 'history') badgeHtml = '<span class="omnibox-result-badge">HISTORY</span>';

      item.innerHTML = `
        <div class="omnibox-result-icon">${iconHtml}</div>
        <div class="omnibox-result-info">
          <div class="omnibox-result-title">${this.escapeHtml(res.title)}</div>
          <div class="omnibox-result-subtitle">${this.escapeHtml(res.subtitle)}</div>
        </div>
        ${badgeHtml}
      `;

      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.executeOmniboxResult(res);
      });

      this.dom.omniboxResultsList.appendChild(item);
    });

    this.dom.omniboxDropdown.style.display = 'flex';
  }

  moveOmniboxSelection(dir) {
    if (!this.currentOmniboxResults.length) return;
    this.omniboxSelectedIndex = (this.omniboxSelectedIndex + dir + this.currentOmniboxResults.length) % this.currentOmniboxResults.length;
    
    const items = this.dom.omniboxResultsList.querySelectorAll('.omnibox-result-item');
    items.forEach((it, idx) => {
      it.classList.toggle('selected', idx === this.omniboxSelectedIndex);
      if (idx === this.omniboxSelectedIndex) {
        it.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  executeOmniboxResult(res) {
    this.closeOmniboxDropdown();
    if (!res) return;

    if (res.type === 'tab') {
      const { tabId, workspaceId } = res.payload;
      if (workspaceId && workspaceId !== workspaceService.getActiveWorkspaceId()) {
        this.switchWorkspace(workspaceId);
      }
      tabManager.activateTab(tabId);
    } else if (res.type === 'command') {
      const cmd = res.payload;
      if (cmd && typeof cmd.handler === 'function') {
        cmd.handler(this);
      }
    } else if (res.type === 'bookmark' || res.type === 'history' || res.type === 'url') {
      this.navigateCurrentTab(res.payload);
    } else if (res.type === 'search') {
      this.navigateCurrentTab(res.payload);
    }
  }

  closeOmniboxDropdown() {
    if (this.dom.omniboxDropdown) {
      this.dom.omniboxDropdown.style.display = 'none';
      this.omniboxSelectedIndex = -1;
      this.currentOmniboxResults = [];
    }
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

