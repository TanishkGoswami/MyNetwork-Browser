// SettingsService - Browser Configuration & Preferences Manager
const { storageAdapter } = require('../storage/storage-adapter');
const { eventBus } = require('../../shared/events/event-bus');

const SETTINGS_STORAGE_KEY = 'mynetwork_browser_settings';

const DEFAULT_SETTINGS = {
  // General & Search
  defaultSearchEngine: 'duckduckgo',
  startupBehavior: 'dashboard', // 'dashboard' | 'blank'
  homePageUrl: 'mynetwork://newtab',

  // Appearance & Layout
  compactSidebarOnStart: false,
  tabLayout: 'vertical', // 'vertical' | 'horizontal'
  accentTheme: 'blue', // 'blue' | 'indigo' | 'purple' | 'emerald' | 'slate'
  showTabFavicons: true,

  // Productivity & Copilot
  focusDurationMinutes: 25,
  breakDurationMinutes: 5,
  aiDefaultQuickAction: 'summarize',
  scratchpadAutoSave: true,

  // Privacy & Security
  trackingProtectionLevel: 'standard', // 'standard' | 'strict'
  saveBrowsingHistory: true,

  // Bookmarks & Workspaces
  bookmarksBarMode: 'always', // 'always' | 'newtab' | 'never'
  newtabBookmarksLayout: 'spotlight', // 'spotlight' | 'boards' | 'minimal'
  defaultBookmarkFolder: 'root_bar',
  bookmarkOpenTarget: 'current' // 'current' | 'new' | 'background'
};

class SettingsService {
  constructor() {
    this.settings = this.loadSettings();
  }

  loadSettings() {
    const saved = storageAdapter.get(SETTINGS_STORAGE_KEY, null);
    if (!saved) {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...saved };
  }

  get(key, defaultValue = null) {
    if (key in this.settings) {
      return this.settings[key];
    }
    return defaultValue;
  }

  getAll() {
    return { ...this.settings };
  }

  set(key, value) {
    this.settings[key] = value;
    this.persist();
    eventBus.emit('settings:changed', { key, value, settings: this.getAll() });
  }

  update(updates) {
    this.settings = { ...this.settings, ...updates };
    this.persist();
    eventBus.emit('settings:changed', { updates, settings: this.getAll() });
  }

  resetToDefaults() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.persist();
    eventBus.emit('settings:changed', { reset: true, settings: this.getAll() });
  }

  persist() {
    storageAdapter.set(SETTINGS_STORAGE_KEY, this.settings);
  }
}

const settingsService = new SettingsService();
module.exports = { SettingsService, settingsService, DEFAULT_SETTINGS };
