// Tab Intelligence Service - Analytics, Duplicate Detection, and Smart Organization
const { eventBus } = require('../../shared/events/event-bus');
const { tabManager } = require('../../core/tabs/tab-manager');

class TabIntelligenceService {
  constructor() {
    this.memoryBasePerTabMb = 85; // Base estimated MB per active Chromium webview
  }

  getTabInsights(workspaceId = null) {
    const tabs = workspaceId ? tabManager.getTabsForWorkspace(workspaceId) : tabManager.getAllTabs();
    const duplicates = this.findDuplicateTabs(workspaceId);
    const domainGroups = this.groupTabsByDomain(workspaceId);
    const hibernatedCount = tabs.filter(t => t.isHibernated).length;
    const activeCount = tabs.length - hibernatedCount;

    // Estimate memory saved and used
    const estimatedMemoryUsedMb = Math.round((activeCount * this.memoryBasePerTabMb) + (hibernatedCount * 4));
    const estimatedMemorySavedMb = Math.round(hibernatedCount * (this.memoryBasePerTabMb - 4));

    return {
      totalTabs: tabs.length,
      activeCount,
      hibernatedCount,
      duplicateCount: duplicates.length,
      duplicates,
      domainGroupCount: Object.keys(domainGroups).length,
      domainGroups,
      estimatedMemoryUsedMb,
      estimatedMemorySavedMb
    };
  }

  findDuplicateTabs(workspaceId = null) {
    const tabs = workspaceId ? tabManager.getTabsForWorkspace(workspaceId) : tabManager.getAllTabs();
    const seenUrls = new Map();
    const duplicates = [];

    tabs.forEach(tab => {
      if (!tab.url || tab.url.startsWith('mynetwork://') || tab.url.startsWith('about:')) return;
      
      const normalizedUrl = this.normalizeUrl(tab.url);
      if (seenUrls.has(normalizedUrl)) {
        duplicates.push({
          duplicateTab: tab,
          originalTab: seenUrls.get(normalizedUrl)
        });
      } else {
        seenUrls.set(normalizedUrl, tab);
      }
    });

    return duplicates;
  }

  normalizeUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      // Remove trailing slashes and hash for fuzzy deduplication
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
    } catch (e) {
      return (rawUrl || '').trim().toLowerCase();
    }
  }

  closeDuplicateTabs(workspaceId = null) {
    const duplicates = this.findDuplicateTabs(workspaceId);
    let closedCount = 0;

    duplicates.forEach(d => {
      // Don't close if it's pinned or active
      if (d.duplicateTab.id !== tabManager.activeTabId && !d.duplicateTab.isPinned) {
        tabManager.closeTab(d.duplicateTab.id);
        closedCount++;
      }
    });

    return closedCount;
  }

  groupTabsByDomain(workspaceId = null) {
    const tabs = workspaceId ? tabManager.getTabsForWorkspace(workspaceId) : tabManager.getAllTabs();
    const groups = {};

    tabs.forEach(tab => {
      let domain = 'Internal';
      try {
        if (tab.url && !tab.url.startsWith('mynetwork://') && !tab.url.startsWith('about:')) {
          const parsed = new URL(tab.url);
          domain = parsed.hostname.replace(/^www\./, '');
        }
      } catch (e) {
        domain = 'Other';
      }

      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(tab);
    });

    return groups;
  }

  organizeTabsIntoTreesByDomain(workspaceId = null) {
    const groups = this.groupTabsByDomain(workspaceId);
    let organizedCount = 0;

    Object.entries(groups).forEach(([domain, tabs]) => {
      if (tabs.length > 1 && domain !== 'Internal') {
        const rootTab = tabs[0];
        for (let i = 1; i < tabs.length; i++) {
          const childTab = tabs[i];
          childTab.parentId = rootTab.id;
          childTab.depth = 1;
          organizedCount++;
        }
      }
    });

    eventBus.emit('tabs:organized-by-domain', { organizedCount });
    return organizedCount;
  }
}

const tabIntelligenceService = new TabIntelligenceService();

module.exports = { TabIntelligenceService, tabIntelligenceService };
