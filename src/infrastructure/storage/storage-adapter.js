// StorageAdapter - Safe wrapper around browser localStorage with memory fallback
class StorageAdapter {
  constructor(prefix = 'mynetwork_') {
    this.prefix = prefix;
    this.memoryStore = new Map();
  }

  get(key, defaultValue = null) {
    const fullKey = this.prefix + key;
    try {
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(fullKey);
        if (item === null) {
          // Check legacy key if exists
          const legacyItem = localStorage.getItem('zen_' + key);
          if (legacyItem !== null) return JSON.parse(legacyItem);
          return defaultValue;
        }
        return JSON.parse(item);
      }
    } catch (e) {
      console.warn(`[StorageAdapter] Failed reading ${fullKey}:`, e);
    }
    return this.memoryStore.has(fullKey) ? this.memoryStore.get(fullKey) : defaultValue;
  }

  set(key, value) {
    const fullKey = this.prefix + key;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(fullKey, JSON.stringify(value));
      }
    } catch (e) {
      console.warn(`[StorageAdapter] Failed writing ${fullKey}:`, e);
    }
    this.memoryStore.set(fullKey, value);
  }

  remove(key) {
    const fullKey = this.prefix + key;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(fullKey);
        localStorage.removeItem('zen_' + key);
      }
    } catch (e) {}
    this.memoryStore.delete(fullKey);
  }
}

const storage = new StorageAdapter();

module.exports = { StorageAdapter, storage, storageAdapter: storage };
