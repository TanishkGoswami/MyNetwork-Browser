// BrowserContext - Core Application Context (Search engine, Split view, Rail mode)
const { eventBus } = require('../../shared/events/event-bus');
const searchEngines = require('../../infrastructure/config/search-engines');

class BrowserContext {
  constructor() {
    this.currentEngineKey = 'google';
    this.isSplitView = false;
    this.splitTabIds = [];
    this.isSidebarRail = false;
    this.isAiDrawerOpen = false;
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

  setSplitView(isSplit, tabIds = []) {
    this.isSplitView = !!isSplit;
    this.splitTabIds = isSplit ? (Array.isArray(tabIds) ? tabIds : []) : [];
    eventBus.emit('ui:splitview-toggled', { isSplit: this.isSplitView, tabIds: this.splitTabIds });
    return this.isSplitView;
  }

  toggleSplitView() {
    this.isSplitView = !this.isSplitView;
    if (!this.isSplitView) this.splitTabIds = [];
    eventBus.emit('ui:splitview-toggled', { isSplit: this.isSplitView, tabIds: this.splitTabIds });
    return this.isSplitView;
  }

  toggleSplitTab(tabId) {
    const { tabManager } = require('../tabs/tab-manager');
    const activeTabId = tabManager.getActiveTabId();

    if (!this.isSplitView) {
      if (tabId && tabId !== activeTabId) {
        this.isSplitView = true;
        this.splitTabIds = [activeTabId, tabId];
        eventBus.emit('ui:splitview-toggled', { isSplit: true, tabIds: this.splitTabIds });
        return true;
      }
    } else {
      // If already in split view
      if (this.splitTabIds && this.splitTabIds.includes(tabId)) {
        // Exit split view and restore single tab mode for this tab
        this.isSplitView = false;
        this.splitTabIds = [];
        tabManager.activateTab(tabId);
        eventBus.emit('ui:splitview-toggled', { isSplit: false, tabIds: [] });
        return false;
      } else if (tabId) {
        // Replace or extend pane with clicked tab
        if (this.splitTabIds.length >= 2) {
          this.splitTabIds = [this.splitTabIds[0], tabId];
        } else {
          this.splitTabIds.push(tabId);
        }
        eventBus.emit('ui:splitview-toggled', { isSplit: true, tabIds: this.splitTabIds });
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
