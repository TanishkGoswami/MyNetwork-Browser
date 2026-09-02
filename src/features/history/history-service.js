// HistoryService - Visited links tracker and history store
const { storage } = require('../../infrastructure/storage/storage-adapter');
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS, DEFAULT_NEWTAB_URL, LEGACY_NEWTAB_URL, BLANK_URL } = require('../../shared/constants');

class HistoryService {
  constructor() {
    this.storageKey = 'recents';
    this.maxEntries = 12;
    this.history = storage.get(this.storageKey, []);
  }

  getRecent(limit = 8) {
    return this.history.slice(0, limit);
  }

  addRecord(title, url) {
    if (!url || url.startsWith('mynetwork://') || url.startsWith('zen://') || url === BLANK_URL) {
      return;
    }

    const cleanTitle = title || url;
    // Filter out duplicates
    this.history = this.history.filter(item => item.url !== url);
    
    this.history.unshift({
      title: cleanTitle,
      url: url,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });

    if (this.history.length > this.maxEntries) {
      this.history = this.history.slice(0, this.maxEntries);
    }

    storage.set(this.storageKey, this.history);
    eventBus.emit(EVENTS.HISTORY_UPDATED, { entries: this.getRecent() });
  }

  clear() {
    this.history = [];
    storage.remove(this.storageKey);
    eventBus.emit(EVENTS.HISTORY_UPDATED, { entries: [] });
  }
}

const historyService = new HistoryService();

module.exports = { HistoryService, historyService };
