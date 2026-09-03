// TabManager - Core Tab Model and Collection State
const { eventBus } = require('../../shared/events/event-bus');
const { DEFAULT_NEWTAB_URL, LEGACY_NEWTAB_URL, BLANK_URL, EVENTS } = require('../../shared/constants');

class TabManager {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
  }

  createTab(url = DEFAULT_NEWTAB_URL, title = 'New Tab', favicon = null) {
    const tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    
    // Normalize new tab scheme or invalid undefined
    if (!url || url === 'undefined' || url === LEGACY_NEWTAB_URL || url === BLANK_URL) {
      url = DEFAULT_NEWTAB_URL;
    }

    const tab = {
      id: tabId,
      url: url,
      title: title,
      favicon: favicon,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isPinned: false,
      isAudible: false,
      isMuted: false,
      createdAt: Date.now()
    };

    this.tabs.push(tab);
    eventBus.emit(EVENTS.TAB_CREATED, { tab });
    
    // Activate newly created tab
    this.activateTab(tabId);
    return tab;
  }

  activateTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return null;

    this.activeTabId = tabId;
    eventBus.emit(EVENTS.TAB_ACTIVATED, { tabId, tab });
    return tab;
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    this.tabs.splice(index, 1);
    eventBus.emit(EVENTS.TAB_CLOSED, { tabId });

    // Handle active tab change if closed tab was active
    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const nextIndex = Math.max(0, index - 1);
        this.activateTab(this.tabs[nextIndex].id);
      } else {
        // Always maintain at least one tab
        this.createTab(DEFAULT_NEWTAB_URL, 'New Tab');
      }
    }
  }

  updateTab(tabId, updates) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    Object.assign(tab, updates);
    eventBus.emit(EVENTS.TAB_UPDATED, { tabId, updates, tab });
  }

  pinTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || tab.isPinned) return;
    tab.isPinned = true;
    // Move pinned tab to front of pinned group
    this.reorderTabs();
    eventBus.emit(EVENTS.TAB_UPDATED, { tabId, updates: { isPinned: true }, tab });
  }

  unpinTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || !tab.isPinned) return;
    tab.isPinned = false;
    this.reorderTabs();
    eventBus.emit(EVENTS.TAB_UPDATED, { tabId, updates: { isPinned: false }, tab });
  }

  togglePinTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    if (tab.isPinned) this.unpinTab(tabId);
    else this.pinTab(tabId);
  }

  duplicateTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return null;
    return this.createTab(tab.url, tab.title, tab.favicon);
  }

  closeOtherTabs(tabId) {
    const tabsToClose = this.tabs.filter(t => t.id !== tabId && !t.isPinned);
    tabsToClose.forEach(t => this.closeTab(t.id));
    this.activateTab(tabId);
  }

  closeTabsToRight(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;
    const tabsToClose = this.tabs.slice(index + 1).filter(t => !t.isPinned);
    tabsToClose.forEach(t => this.closeTab(t.id));
  }

  toggleMuteTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    tab.isMuted = !tab.isMuted;
    eventBus.emit(EVENTS.TAB_UPDATED, { tabId, updates: { isMuted: tab.isMuted }, tab });
  }

  reorderTabs() {
    const pinned = this.tabs.filter(t => t.isPinned);
    const unpinned = this.tabs.filter(t => !t.isPinned);
    this.tabs = [...pinned, ...unpinned];
  }

  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  }

  getTabs() {
    return [...this.tabs];
  }

  getAllTabs() {
    return [...this.tabs];
  }

  getTab(tabId) {
    return this.tabs.find(t => t.id === tabId);
  }

  getTabCount() {
    return this.tabs.length;
  }
}

const tabManager = new TabManager();

module.exports = { TabManager, tabManager };
