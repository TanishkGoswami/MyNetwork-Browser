// HistoryService - Visited links tracker and history store
const { storage } = require('../../infrastructure/storage/storage-adapter');
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS, DEFAULT_NEWTAB_URL, LEGACY_NEWTAB_URL, SETTINGS_URL, LEGACY_SETTINGS_URL, HISTORY_URL, LEGACY_HISTORY_URL, BLANK_URL } = require('../../shared/constants');

class HistoryService {
  constructor() {
    this.storageKey = 'mynetwork_browser_history_v2';
    this.legacyStorageKey = 'recents';
    this.maxEntries = 5000;
    this.history = this.loadHistory();
  }

  loadHistory() {
    let list = storage.get(this.storageKey, null);
    if (!list || !Array.isArray(list)) {
      // Migrate from legacy storage key if present
      const legacyList = storage.get(this.legacyStorageKey, []);
      if (Array.isArray(legacyList) && legacyList.length > 0) {
        list = legacyList.map((item, idx) => ({
          id: `hist_mig_${Date.now()}_${idx}`,
          url: item.url,
          title: item.title || item.url,
          domain: this.extractDomain(item.url),
          favicon: item.favicon || null,
          visitedAt: item.timestamp || (Date.now() - idx * 60000),
          visitCount: 1,
          time: item.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
      } else {
        list = [];
      }
      this.saveHistory(list);
    }
    return list;
  }

  saveHistory(data = this.history) {
    storage.set(this.storageKey, data);
  }

  extractDomain(urlStr) {
    if (!urlStr) return '';
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace(/^www\./i, '');
    } catch {
      const match = urlStr.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/i);
      return match ? match[1] : urlStr;
    }
  }

  formatDateHeader(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    
    // Check if Today
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      const dayName = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return `Today - ${dayName}`;
    }

    // Check if Yesterday
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      const dayName = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return `Yesterday - ${dayName}`;
    }

    // Otherwise standard full date
    return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  formatDateKey(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  addRecord(title, url, favicon = null) {
    if (!url) return;
    
    // Ignore internal scheme URLs
    if (
      url.startsWith('mynetwork://') ||
      url.startsWith('zen://') ||
      url.startsWith('about:') ||
      url === BLANK_URL ||
      url === DEFAULT_NEWTAB_URL ||
      url === LEGACY_NEWTAB_URL ||
      url === SETTINGS_URL ||
      url === LEGACY_SETTINGS_URL ||
      url === HISTORY_URL ||
      url === LEGACY_HISTORY_URL
    ) {
      return;
    }

    const domain = this.extractDomain(url);
    const cleanTitle = (title && title !== 'about:blank' && title.trim()) ? title.trim() : (domain || url);
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const existingIndex = this.history.findIndex(item => item.url === url);
    let visitCount = 1;
    let savedFavicon = favicon;

    if (existingIndex !== -1) {
      const existing = this.history[existingIndex];
      visitCount = (existing.visitCount || 1) + 1;
      if (!savedFavicon && existing.favicon) {
        savedFavicon = existing.favicon;
      }
      this.history.splice(existingIndex, 1);
    }

    const newRecord = {
      id: `hist_${now}_${Math.random().toString(36).substring(2, 8)}`,
      url: url,
      title: cleanTitle,
      domain: domain,
      favicon: savedFavicon || null,
      visitedAt: now,
      visitCount: visitCount,
      time: timeStr
    };

    this.history.unshift(newRecord);

    if (this.history.length > this.maxEntries) {
      this.history = this.history.slice(0, this.maxEntries);
    }

    this.saveHistory();
    eventBus.emit(EVENTS.HISTORY_UPDATED, { entries: this.getRecent(12) });
  }

  getHistory(options = {}) {
    let result = [...this.history];
    const { query = '', sortBy = 'date-desc', filterDomain = '' } = options;

    if (filterDomain) {
      const domainLower = filterDomain.toLowerCase().trim();
      result = result.filter(item => item.domain && item.domain.toLowerCase() === domainLower);
    }

    if (query) {
      const q = query.toLowerCase().trim();
      result = result.filter(item => 
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.url && item.url.toLowerCase().includes(q)) ||
        (item.domain && item.domain.toLowerCase().includes(q))
      );
    }

    switch (sortBy) {
      case 'date-asc':
        result.sort((a, b) => a.visitedAt - b.visitedAt);
        break;
      case 'visits-desc':
      case 'most-visited':
        result.sort((a, b) => (b.visitCount || 1) - (a.visitCount || 1) || b.visitedAt - a.visitedAt);
        break;
      case 'site-asc':
      case 'by-site':
        result.sort((a, b) => (a.domain || '').localeCompare(b.domain || '') || b.visitedAt - a.visitedAt);
        break;
      case 'date-desc':
      case 'last-visited':
      default:
        result.sort((a, b) => b.visitedAt - a.visitedAt);
        break;
    }

    return result;
  }

  getRecent(limit = 8) {
    return this.history.slice(0, limit);
  }

  getGroupedByDate(query = '', sortBy = 'date-desc') {
    const list = this.getHistory({ query, sortBy: sortBy === 'most-visited' ? 'most-visited' : 'date-desc' });
    const groups = [];
    const groupMap = new Map();

    list.forEach(item => {
      const dateKey = this.formatDateKey(item.visitedAt);
      if (!groupMap.has(dateKey)) {
        const header = this.formatDateHeader(item.visitedAt);
        const groupObj = {
          dateKey: dateKey,
          header: header,
          timestamp: item.visitedAt,
          items: []
        };
        groupMap.set(dateKey, groupObj);
        groups.push(groupObj);
      }
      groupMap.get(dateKey).items.push(item);
    });

    return groups;
  }

  getGroupedByDomain(query = '') {
    const list = this.getHistory({ query, sortBy: 'date-desc' });
    const domainMap = new Map();

    list.forEach(item => {
      const domain = item.domain || 'other';
      if (!domainMap.has(domain)) {
        domainMap.set(domain, {
          domain: domain,
          favicon: item.favicon || null,
          totalVisits: 0,
          latestVisit: item.visitedAt,
          items: []
        });
      }
      const grp = domainMap.get(domain);
      grp.totalVisits += (item.visitCount || 1);
      if (item.visitedAt > grp.latestVisit) grp.latestVisit = item.visitedAt;
      if (!grp.favicon && item.favicon) grp.favicon = item.favicon;
      grp.items.push(item);
    });

    const groups = Array.from(domainMap.values());
    groups.sort((a, b) => b.totalVisits - a.totalVisits || b.latestVisit - a.latestVisit);
    return groups;
  }

  getTreeStructure(query = '') {
    const list = this.getHistory({ query, sortBy: 'date-desc' });
    const now = new Date();
    const todayStr = this.formatDateKey(now.getTime());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = this.formatDateKey(yesterdayDate.getTime());
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    const buckets = [
      { id: 'today', title: 'Today', items: [], domainMap: new Map() },
      { id: 'yesterday', title: 'Yesterday', items: [], domainMap: new Map() },
      { id: 'last7days', title: 'Last 7 days', items: [], domainMap: new Map() },
      { id: 'last30days', title: 'Last 30 days', items: [], domainMap: new Map() },
      { id: 'older', title: 'Older', items: [], domainMap: new Map() }
    ];

    list.forEach(item => {
      const itemDateStr = this.formatDateKey(item.visitedAt);
      let targetBucket;
      if (itemDateStr === todayStr) {
        targetBucket = buckets[0];
      } else if (itemDateStr === yesterdayStr) {
        targetBucket = buckets[1];
      } else if (item.visitedAt >= sevenDaysAgo) {
        targetBucket = buckets[2];
      } else if (item.visitedAt >= thirtyDaysAgo) {
        targetBucket = buckets[3];
      } else {
        targetBucket = buckets[4];
      }

      targetBucket.items.push(item);
      const dom = item.domain || 'other';
      if (!targetBucket.domainMap.has(dom)) {
        targetBucket.domainMap.set(dom, {
          domain: dom,
          favicon: item.favicon,
          items: []
        });
      }
      targetBucket.domainMap.get(dom).items.push(item);
    });

    return buckets
      .filter(b => b.items.length > 0)
      .map(b => ({
        id: b.id,
        title: b.title,
        totalItems: b.items.length,
        domains: Array.from(b.domainMap.values()).map(d => ({
          domain: d.domain,
          favicon: d.favicon,
          items: d.items
        }))
      }));
  }

  removeItem(id) {
    if (!id) return;
    this.history = this.history.filter(item => item.id !== id);
    this.saveHistory();
    eventBus.emit(EVENTS.HISTORY_UPDATED, { entries: this.getRecent(12) });
  }

  removeItems(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const idSet = new Set(ids);
    this.history = this.history.filter(item => !idSet.has(item.id));
    this.saveHistory();
    eventBus.emit(EVENTS.HISTORY_UPDATED, { entries: this.getRecent(12) });
  }

  removeDomain(domain) {
    if (!domain) return;
    const d = domain.toLowerCase();
    this.history = this.history.filter(item => (item.domain || '').toLowerCase() !== d);
    this.saveHistory();
    eventBus.emit(EVENTS.HISTORY_UPDATED, { entries: this.getRecent(12) });
  }

  clearRange(range = 'all') {
    const now = Date.now();
    let threshold = 0;

    if (range === 'hour') {
      threshold = now - (60 * 60 * 1000);
      this.history = this.history.filter(item => item.visitedAt < threshold);
    } else if (range === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      threshold = todayStart.getTime();
      this.history = this.history.filter(item => item.visitedAt < threshold);
    } else if (range === 'week') {
      threshold = now - (7 * 24 * 60 * 60 * 1000);
      this.history = this.history.filter(item => item.visitedAt < threshold);
    } else {
      // 'all'
      this.history = [];
    }

    this.saveHistory();
    eventBus.emit(EVENTS.HISTORY_UPDATED, { entries: this.getRecent(12) });
  }

  clear() {
    this.history = [];
    this.saveHistory();
    eventBus.emit(EVENTS.HISTORY_UPDATED, { entries: [] });
  }
}

const historyService = new HistoryService();

module.exports = { HistoryService, historyService };
