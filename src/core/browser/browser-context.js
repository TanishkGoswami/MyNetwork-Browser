// BrowserContext - Core Application Context (Search engine, Split view, Rail mode)
const { eventBus } = require('../../shared/events/event-bus');
const searchEngines = require('../../infrastructure/config/search-engines');

class BrowserContext {
  constructor() {
    this.currentEngineKey = 'google';
    this.isSplitView = false;
    this.splitTabIds = []; // [leftTabId, rightTabId]
    this.splitRatio = 50; // percentage for left pane
    this.focusedSplitPane = 0; // 0 for left, 1 for right
    this.isSidebarRail = false;
    this.isAiDrawerOpen = false;
  }

  get isSplit() {
    return this.isSplitView;
  }

  set isSplit(val) {
    this.isSplitView = !!val;
  }

  setSearchEngine(engineKey) {
    if (searchEngines[engineKey]) {
      this.currentEngineKey = engineKey;
      eventBus.emit('context:engine-changed', { engineKey, engine: searchEngines[engineKey] });
    }
  }

  getCurrentEngine() {
    return searchEngines[this.currentEngineKey] || searchEngines.google;
  }

  setSplitRatio(ratio) {
    const clamped = Math.max(20, Math.min(80, Number(ratio) || 50));
    this.splitRatio = clamped;
    eventBus.emit('ui:splitview-resized', { splitRatio: this.splitRatio });
  }

  setFocusedSplitPane(paneIndex) {
    this.focusedSplitPane = paneIndex === 1 ? 1 : 0;
    eventBus.emit('ui:splitview-focus-changed', {
      focusedIndex: this.focusedSplitPane,
      tabId: this.splitTabIds[this.focusedSplitPane] || null
    });
  }

  setSplitView(isSplit, tabIds = [], splitRatio = 50) {
    this.isSplitView = !!isSplit;
    this.splitTabIds = isSplit ? (Array.isArray(tabIds) ? tabIds : []) : [];
    if (splitRatio) this.splitRatio = Math.max(20, Math.min(80, splitRatio));
    eventBus.emit('ui:splitview-toggled', {
      isSplit: this.isSplitView,
      tabIds: this.splitTabIds,
      splitRatio: this.splitRatio
    });
    return this.isSplitView;
  }

  toggleSplitView(target = null) {
    const { tabManager } = require('../tabs/tab-manager');
    const { workspaceService } = require('../../features/bookmarks/workspace-service');

    let shouldBeSplit;
    let targetTabIds = null;

    if (typeof target === 'boolean') {
      shouldBeSplit = target;
    } else if (Array.isArray(target)) {
      shouldBeSplit = true;
      targetTabIds = target;
    } else {
      shouldBeSplit = !this.isSplitView;
    }

    if (!shouldBeSplit) {
      // Exit split view
      this.isSplitView = false;
      const focusedTabId = (this.splitTabIds && this.splitTabIds[this.focusedSplitPane]) || (this.splitTabIds && this.splitTabIds[0]) || tabManager.getActiveTabId();
      this.splitTabIds = [];
      if (focusedTabId) tabManager.activateTab(focusedTabId);
      eventBus.emit('ui:splitview-toggled', { isSplit: false, tabIds: [], splitRatio: this.splitRatio });
      return false;
    }

    // Entering split view
    this.isSplitView = true;
    const activeTabId = tabManager.getActiveTabId();
    const activeWsId = workspaceService.getActiveWorkspaceId();
    const wsTabs = tabManager.getTabsForWorkspace(activeWsId);

    if (targetTabIds && Array.isArray(targetTabIds) && targetTabIds.length >= 2) {
      this.splitTabIds = targetTabIds;
    } else {
      // Look for a companion tab in the same workspace (prefer real pages over new tabs)
      const companion = wsTabs.find(t => t.id !== activeTabId && t.url && !t.url.startsWith('mynetwork://') && !t.url.startsWith('about:'));
      if (companion) {
        this.splitTabIds = [activeTabId, companion.id];
      } else {
        const anyOther = wsTabs.find(t => t.id !== activeTabId);
        if (anyOther) {
          this.splitTabIds = [activeTabId, anyOther.id];
        } else {
          // Only 1 tab exists -> Left is active tab, right is null (Embedded New Tab / Quick Search)
          this.splitTabIds = [activeTabId, null];
        }
      }
    }

    this.focusedSplitPane = 0;
    eventBus.emit('ui:splitview-toggled', {
      isSplit: true,
      tabIds: this.splitTabIds,
      splitRatio: this.splitRatio
    });
    return true;
  }

  splitWithTab(primaryTabId, secondaryTabId) {
    this.isSplitView = true;
    this.splitTabIds = [primaryTabId, secondaryTabId];
    this.focusedSplitPane = 1;
    eventBus.emit('ui:splitview-toggled', {
      isSplit: true,
      tabIds: this.splitTabIds,
      splitRatio: this.splitRatio
    });
    return true;
  }

  closeSplitPane(paneIndex) {
    const { tabManager } = require('../tabs/tab-manager');
    const remainingIndex = paneIndex === 0 ? 1 : 0;
    const remainingTabId = this.splitTabIds[remainingIndex];

    this.isSplitView = false;
    this.splitTabIds = [];
    if (remainingTabId) {
      tabManager.activateTab(remainingTabId);
    }
    eventBus.emit('ui:splitview-toggled', { isSplit: false, tabIds: [], splitRatio: this.splitRatio });
  }

  toggleSplitTab(tabId) {
    const { tabManager } = require('../tabs/tab-manager');
    const activeTabId = tabManager.getActiveTabId();

    if (!this.isSplitView) {
      if (tabId && tabId !== activeTabId) {
        return this.splitWithTab(activeTabId, tabId);
      } else {
        return this.toggleSplitView();
      }
    } else {
      // If already in split view and user clicks one of the active split tabs
      if (this.splitTabIds.includes(tabId)) {
        // If clicking the current tab, exit split view and maximize it
        return this.closeSplitPane(this.splitTabIds.indexOf(tabId) === 0 ? 1 : 0);
      } else if (tabId) {
        // Replace secondary pane with clicked tab
        this.splitTabIds[1] = tabId;
        this.focusedSplitPane = 1;
        eventBus.emit('ui:splitview-toggled', {
          isSplit: true,
          tabIds: this.splitTabIds,
          splitRatio: this.splitRatio
        });
        return true;
      }
    }
    return this.isSplitView;
  }

  toggleSidebarRail() {
    this.isSidebarRail = !this.isSidebarRail;
    eventBus.emit('ui:sidebar-toggled', { isRail: this.isSidebarRail });
    return this.isSidebarRail;
  }

  toggleAiDrawer(openState = null) {
    this.isAiDrawerOpen = openState !== null ? openState : !this.isAiDrawerOpen;
    eventBus.emit('ui:ai-drawer-toggled', { isOpen: this.isAiDrawerOpen });
    return this.isAiDrawerOpen;
  }
}

const browserContext = new BrowserContext();

module.exports = { BrowserContext, browserContext };
