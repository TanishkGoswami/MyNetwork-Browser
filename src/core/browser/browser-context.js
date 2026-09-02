// BrowserContext - Core Application Context (Search engine, Split view, Rail mode)
const { eventBus } = require('../../shared/events/event-bus');
const searchEngines = require('../../infrastructure/config/search-engines');

class BrowserContext {
  constructor() {
    this.currentEngineKey = 'google';
    this.isSplitView = false;
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

  toggleSplitView() {
    this.isSplitView = !this.isSplitView;
    eventBus.emit('ui:splitview-toggled', { isSplit: this.isSplitView });
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
