// TabManager - Core Tab Model and Collection State
const { eventBus } = require('../../shared/events/event-bus');
const { DEFAULT_NEWTAB_URL, LEGACY_NEWTAB_URL, BLANK_URL, EVENTS } = require('../../shared/constants');

class TabManager {
  constructor() {
    this.tabs = [];
    this.activeTabId = null;
  }

  createTab(url = DEFAULT_NEWTAB_URL, title = 'New Tab', favicon = null, workspaceId = null, containerId = null, isGhost = false, parentId = null) {
    const tabId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    
    // Normalize new tab scheme or invalid undefined
    if (!url || url === 'undefined' || url === LEGACY_NEWTAB_URL || url === BLANK_URL) {
      url = DEFAULT_NEWTAB_URL;
    }

    // Resolve workspace ID
    let wsId = workspaceId;
    if (!wsId) {
      try {
        const { workspaceService } = require('../../features/bookmarks/workspace-service');
        wsId = workspaceService.getActiveWorkspaceId() || 'ws_default';
      } catch (e) {
        wsId = 'ws_default';
      }
    }

    // Calculate depth if parent exists
    let depth = 0;
    if (parentId) {
      const parentTab = this.tabs.find(t => t.id === parentId);
      if (parentTab) {
        depth = Math.min((parentTab.depth || 0) + 1, 4); // Max 4 levels of nesting
      }
    }

    const tab = {
      id: tabId,
      workspaceId: wsId,
      containerId: containerId || null,
      parentId: parentId || null,
      depth: depth,
      isCollapsed: false,
      isGhost: !!isGhost,
      isHibernated: false,
      url: url,
      title: isGhost && title === 'New Tab' ? 'Ghost Tab' : title,
      favicon: favicon,
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      isPinned: false,
      isAudible: false,
      isMuted: false,
      lastActiveAt: Date.now(),
      createdAt: Date.now()
    };

    // If parent exists, insert tab right after parent or its last descendant
    if (parentId) {
      const parentIdx = this.tabs.findIndex(t => t.id === parentId);
      if (parentIdx !== -1) {
        let insertIdx = parentIdx + 1;
        while (insertIdx < this.tabs.length && this.tabs[insertIdx].depth > (this.tabs[parentIdx].depth || 0)) {
          insertIdx++;
        }
        this.tabs.splice(insertIdx, 0, tab);
      } else {
        this.tabs.push(tab);
      }
    } else {
      this.tabs.push(tab);
    }

    eventBus.emit(EVENTS.TAB_CREATED, { tab });
    
    // Activate newly created tab
    this.activateTab(tabId);
    return tab;
  }

  activateTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return null;

    this.activeTabId = tabId;

    // Track active tab on workspace
    try {
      const { workspaceService } = require('../../features/bookmarks/workspace-service');
      if (tab.workspaceId) {
        workspaceService.updateWorkspace(tab.workspaceId, { activeTabId: tabId });
      }
    } catch (e) {}

    eventBus.emit(EVENTS.TAB_ACTIVATED, { tabId, tab });
    return tab;
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const closingTab = this.tabs[index];
    const wsId = closingTab.workspaceId || 'ws_default';

    this.tabs.splice(index, 1);
    eventBus.emit(EVENTS.TAB_CLOSED, { tabId, workspaceId: wsId });

    // Handle active tab change if closed tab was active
    if (this.activeTabId === tabId) {
      const wsTabs = this.getTabsForWorkspace(wsId);
      if (wsTabs.length > 0) {
        const nextTab = wsTabs[Math.max(0, wsTabs.length - 1)];
        this.activateTab(nextTab.id);
      } else {
        // Always maintain at least one tab in the current workspace
        this.createTab(DEFAULT_NEWTAB_URL, 'New Tab', null, wsId);
      }
    }
  }

  getTabsForWorkspace(workspaceId) {
    const targetWsId = workspaceId || 'ws_default';
    return this.tabs.filter(t => (t.workspaceId || 'ws_default') === targetWsId);
  }

  moveTabToWorkspace(tabId, targetWorkspaceId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || tab.workspaceId === targetWorkspaceId) return null;

    const previousWorkspaceId = tab.workspaceId || 'ws_default';
    tab.workspaceId = targetWorkspaceId;

    eventBus.emit(EVENTS.TAB_UPDATED, {
      tabId,
      updates: { workspaceId: targetWorkspaceId },
      previousWorkspaceId,
      tab
    });

    // If active tab was moved and current active workspace was previous, switch active tab to remaining ws tabs
    if (this.activeTabId === tabId) {
      const remaining = this.getTabsForWorkspace(previousWorkspaceId);
      if (remaining.length > 0) {
        this.activateTab(remaining[remaining.length - 1].id);
      } else {
        this.createTab(DEFAULT_NEWTAB_URL, 'New Tab', null, previousWorkspaceId);
      }
    }

    return tab;
  }

  closeWorkspaceTabs(workspaceId) {
    const tabsToClose = this.getTabsForWorkspace(workspaceId);
    tabsToClose.forEach(t => this.closeTab(t.id));
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

  moveTab(sourceTabId, targetTabId, insertBefore = true) {
    const sourceIndex = this.tabs.findIndex(t => t.id === sourceTabId);
    const targetIndex = this.tabs.findIndex(t => t.id === targetTabId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    const [movedTab] = this.tabs.splice(sourceIndex, 1);
    let newTargetIndex = this.tabs.findIndex(t => t.id === targetTabId);
    if (!insertBefore) newTargetIndex += 1;
    this.tabs.splice(newTargetIndex, 0, movedTab);

    eventBus.emit(EVENTS.TAB_UPDATED, { tabId: sourceTabId, tab: movedTab });
  }

  // --- Tree Tab Hierarchy Methods ---
  getChildTabs(parentId) {
    return this.tabs.filter(t => t.parentId === parentId);
  }

  hasChildTabs(tabId) {
    return this.tabs.some(t => t.parentId === tabId);
  }

  getSubtreeTabs(tabId) {
    const results = [];
    const collect = (pId) => {
      const children = this.getChildTabs(pId);
      for (const child of children) {
        results.push(child);
        collect(child.id);
      }
    };
    collect(tabId);
    return results;
  }

  toggleCollapseBranch(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    tab.isCollapsed = !tab.isCollapsed;
    eventBus.emit(EVENTS.TAB_UPDATED, { tabId, updates: { isCollapsed: tab.isCollapsed }, tab });
  }

  closeSubtree(tabId) {
    const descendants = this.getSubtreeTabs(tabId);
    descendants.forEach(d => this.closeTab(d.id));
    this.closeTab(tabId);
  }

  // --- Tab Hibernation State ---
  hibernateTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || tab.isHibernated || tab.id === this.activeTabId) return;
    tab.isHibernated = true;
    eventBus.emit(EVENTS.TAB_UPDATED, { tabId, updates: { isHibernated: true }, tab });
    eventBus.emit('tab-hibernated', { tabId, tab });
  }

  wakeTab(tabId) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || !tab.isHibernated) return;
    tab.isHibernated = false;
    tab.lastActiveAt = Date.now();
    eventBus.emit(EVENTS.TAB_UPDATED, { tabId, updates: { isHibernated: false }, tab });
    eventBus.emit('tab-woken', { tabId, tab });
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

