// Tab Hibernate Service - Memory & CPU Suspension Engine
const { eventBus } = require('../../shared/events/event-bus');
const { tabManager } = require('../../core/tabs/tab-manager');

class TabHibernateService {
  constructor() {
    this.idleThresholdMs = 20 * 60 * 1000; // 20 minutes idle threshold
    this.checkInterval = null;
    this.isEnabled = true;
    this.init();
  }

  init() {
    // Listen for tab activation to wake up hibernated tabs instantly
    eventBus.on('tab:activated', ({ tabId }) => {
      const tab = tabManager.getTab(tabId);
      if (tab) {
        tab.lastActiveAt = Date.now();
        if (tab.isHibernated) {
          this.wakeTab(tabId);
        }
      }
    });

    // Start background idle checker every 2 minutes
    this.startAutoHibernateChecker();
  }

  startAutoHibernateChecker() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => {
      if (!this.isEnabled) return;
      this.checkAndHibernateIdleTabs();
    }, 2 * 60 * 1000);
  }

  checkAndHibernateIdleTabs() {
    const activeTab = tabManager.getActiveTab();
    const activeId = activeTab ? activeTab.id : null;
    const now = Date.now();
    const tabs = tabManager.getAllTabs();

    tabs.forEach(tab => {
      // Don't hibernate active tab, pinned tabs, audible tabs, or internal config pages
      if (tab.id === activeId || tab.isPinned || tab.isAudible) return;
      if (tab.url && (tab.url.startsWith('mynetwork://') || tab.url.startsWith('about:'))) return;

      const idleDuration = now - (tab.lastActiveAt || tab.createdAt || now);
      if (idleDuration >= this.idleThresholdMs && !tab.isHibernated) {
        this.hibernateTab(tab.id);
      }
    });
  }

  hibernateTab(tabId) {
    const tab = tabManager.getTab(tabId);
    if (!tab || tab.isHibernated || tab.id === tabManager.activeTabId) return;

    tabManager.hibernateTab(tabId);
    console.log(`[TabHibernate] Suspended tab ${tabId} (${tab.title}) to reclaim memory.`);
  }

  wakeTab(tabId) {
    const tab = tabManager.getTab(tabId);
    if (!tab) return;
    tabManager.wakeTab(tabId);
    console.log(`[TabHibernate] Woke tab ${tabId} (${tab.title}).`);
  }

  hibernateAllInactive(workspaceId = null) {
    const activeTab = tabManager.getActiveTab();
    const activeId = activeTab ? activeTab.id : null;
    const tabs = workspaceId ? tabManager.getTabsForWorkspace(workspaceId) : tabManager.getAllTabs();
    let hibernatedCount = 0;

    tabs.forEach(tab => {
      if (tab.id === activeId || tab.isPinned || tab.isAudible || tab.isHibernated) return;
      this.hibernateTab(tab.id);
      hibernatedCount++;
    });

    return hibernatedCount;
  }

  getHibernatedCount(workspaceId = null) {
    const tabs = workspaceId ? tabManager.getTabsForWorkspace(workspaceId) : tabManager.getAllTabs();
    return tabs.filter(t => t.isHibernated).length;
  }
}

const tabHibernateService = new TabHibernateService();

module.exports = { TabHibernateService, tabHibernateService };
