// SessionService - Manages Tab Session Persistence and Restore on Browser Launch
const fs = require('fs');
const path = require('path');
const { eventBus } = require('../../shared/events/event-bus');
const { DEFAULT_NEWTAB_URL } = require('../../shared/constants');

const SESSION_FILE = 'session_state.json';

class SessionService {
  constructor() {
    this.storageDir = path.join(process.env.APPDATA || process.env.HOME || '.', '.mynetwork_browser');
    this.sessionPath = path.join(this.storageDir, SESSION_FILE);
    this.saveTimeout = null;
    this.initStorage();
  }

  initStorage() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (e) {
      console.error('[SessionService] Error creating storage dir:', e);
    }
  }

  saveSession(tabs, activeTabId) {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      try {
        const cleanTabs = tabs
          .filter(t => t.url && !t.url.startsWith('mynetwork://settings'))
          .map(t => ({
            url: t.url,
            title: t.title,
            favicon: t.favicon,
            isPinned: !!t.isPinned
          }));

        const data = {
          lastSaved: Date.now(),
          activeTabUrl: tabs.find(t => t.id === activeTabId)?.url || DEFAULT_NEWTAB_URL,
          tabs: cleanTabs.length > 0 ? cleanTabs : [{ url: DEFAULT_NEWTAB_URL, title: 'New Tab', isPinned: false }]
        };

        fs.writeFileSync(this.sessionPath, JSON.stringify(data, null, 2), 'utf8');
      } catch (e) {
        console.error('[SessionService] Failed to save session:', e);
      }
    }, 500);
  }

  loadSession() {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const content = fs.readFileSync(this.sessionPath, 'utf8');
        const data = JSON.parse(content);
        if (data && Array.isArray(data.tabs) && data.tabs.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.error('[SessionService] Failed to load session:', e);
    }
    return null;
  }

  clearSession() {
    try {
      if (fs.existsSync(this.sessionPath)) {
        fs.unlinkSync(this.sessionPath);
      }
    } catch (e) {
      console.error('[SessionService] Failed to clear session:', e);
    }
  }
}

const sessionService = new SessionService();

module.exports = { SessionService, sessionService };
