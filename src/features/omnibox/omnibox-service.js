// OmniboxService - Intelligent Omnibox Prefix Parser & Command Dispatcher
const { tabManager } = require('../../core/tabs/tab-manager');
const { bookmarkService, workspaceService } = require('../../features/bookmarks');
const { historyService } = require('../../features/history/history-service');
const { containerService } = require('../../features/containers/container-service');

class OmniboxService {
  constructor() {
    this.commands = this.initDefaultCommands();
  }

  initDefaultCommands() {
    return [
      {
        id: 'cmd_ghost_tab',
        title: 'New Disposable Ghost Tab',
        desc: 'Open ephemeral session that destroys on close',
        icon: '👻',
        shortcut: 'Ctrl+Shift+G',
        category: 'Tabs',
        handler: (shell) => {
          tabManager.createTab('https://www.google.com', 'Ghost Tab', null, null, null, true);
          shell.showToast('👻 Opened Ghost Tab');
        }
      },
      {
        id: 'cmd_new_tab',
        title: 'New Tab',
        desc: 'Create a new tab in current workspace',
        icon: '➕',
        shortcut: 'Ctrl+T',
        category: 'Tabs',
        handler: () => tabManager.createTab()
      },
      {
        id: 'cmd_projects',
        title: 'Open Project Workspaces Board',
        desc: 'Manage isolated workspaces and contexts',
        icon: '🗂️',
        shortcut: 'Ctrl+Shift+P',
        category: 'Workspaces',
        handler: (shell) => shell.openProjectsTab()
      },
      {
        id: 'cmd_bookmarks',
        title: 'Open Bookmarks Manager',
        desc: 'Organize bookmarks, tags, and folders',
        icon: '⭐',
        shortcut: 'Ctrl+Shift+O',
        category: 'Navigation',
        handler: (shell) => shell.openBookmarksTab()
      },
      {
        id: 'cmd_history',
        title: 'Open History',
        desc: 'View and search browsing history',
        icon: '🕒',
        shortcut: 'Ctrl+H',
        category: 'Navigation',
        handler: (shell) => shell.openHistoryTab()
      },
      {
        id: 'cmd_passwords',
        title: 'Open Passwords Vault',
        desc: 'Manage saved credentials and logins',
        icon: '🔑',
        shortcut: 'Ctrl+Shift+L',
        category: 'Security',
        handler: (shell) => shell.openPasswordsTab()
      },
      {
        id: 'cmd_split_view',
        title: 'Toggle Split Screen View',
        desc: 'View multiple sites side by side',
        icon: '🪟',
        shortcut: 'Ctrl+Alt+S',
        category: 'View',
        handler: (shell) => {
          const { browserContext } = require('../../core/browser/browser-context');
          browserContext.toggleSplitView();
        }
      },
      {
        id: 'cmd_theme',
        title: 'Toggle Dark / Light Mode',
        desc: 'Switch between macOS light and dark themes',
        icon: '🌓',
        shortcut: 'Ctrl+Shift+D',
        category: 'Preferences',
        handler: (shell) => {
          const { settingsService } = require('../../infrastructure/config/settings-service');
          const current = settingsService.get('theme', 'light');
          const next = current === 'dark' ? 'light' : 'dark';
          settingsService.set('theme', next);
          document.documentElement.setAttribute('data-theme', next);
          shell.showToast(`Theme switched to ${next} mode`);
        }
      },
      {
        id: 'cmd_clear_cache',
        title: 'Clear Browsing Cache',
        desc: 'Wipe temporary cached network data',
        icon: '🧹',
        shortcut: '',
        category: 'Privacy',
        handler: (shell) => {
          historyService.clearAll();
          shell.showToast('🧹 Browsing cache and history cleared');
        }
      }
    ];
  }

  /**
   * Parses input string and queries tabs, history, bookmarks, or system actions
   * @param {string} rawInput 
   * @returns {Array<{ type, title, subtitle, icon, action, payload }>}
   */
  query(rawInput) {
    const input = (rawInput || '').trim();
    if (!input) return [];

    const lower = input.toLowerCase();

    // 1. Explicit @tabs Prefix
    if (lower.startsWith('@tabs') || lower.startsWith('@tab')) {
      const q = lower.replace(/^@tabs?\s*/, '').trim();
      return this.searchTabs(q);
    }

    // 2. Explicit @history Prefix
    if (lower.startsWith('@history') || lower.startsWith('@hist')) {
      const q = lower.replace(/^@hist(ory)?\s*/, '').trim();
      return this.searchHistory(q);
    }

    // 3. Explicit @bookmark Prefix
    if (lower.startsWith('@bookmark') || lower.startsWith('@bm')) {
      const q = lower.replace(/^@b(ook)?m(ark)?s?\s*/, '').trim();
      return this.searchBookmarks(q);
    }

    // 4. Explicit > Command Prefix
    if (lower.startsWith('>')) {
      const q = lower.substring(1).trim();
      return this.searchCommands(q);
    }

    // 5. Intelligent Multi-Source Search (Tabs, Commands, Bookmarks, History, URL/Search)
    const results = [];

    // Search Matching Tabs (Jump to tab)
    const matchingTabs = this.searchTabs(lower).slice(0, 3);
    results.push(...matchingTabs);

    // Search Matching Commands
    const matchingCmds = this.searchCommands(lower).slice(0, 2);
    results.push(...matchingCmds);

    // Search Matching Bookmarks
    const matchingBms = this.searchBookmarks(lower).slice(0, 3);
    results.push(...matchingBms);

    // Search Matching History
    const matchingHist = this.searchHistory(lower).slice(0, 3);
    results.push(...matchingHist);

    // Default Web Search / Direct URL item
    const isUrl = /^https?:\/\//i.test(input) || (input.includes('.') && !input.includes(' '));
    results.unshift({
      type: isUrl ? 'url' : 'search',
      title: isUrl ? `Open ${input}` : `Search "${input}"`,
      subtitle: isUrl ? 'Navigate directly' : 'Search with default engine',
      icon: isUrl ? '🌐' : '🔍',
      payload: input
    });

    return results;
  }

  searchTabs(query = '') {
    const allTabs = tabManager.getAllTabs();
    const activeWsId = workspaceService.getActiveWorkspaceId();

    return allTabs
      .filter(t => {
        if (!query) return true;
        const matchTitle = (t.title || '').toLowerCase().includes(query);
        const matchUrl = (t.url || '').toLowerCase().includes(query);
        return matchTitle || matchUrl;
      })
      .map(t => {
        const ws = workspaceService.getWorkspace(t.workspaceId) || { name: 'General', color: '#007aff' };
        return {
          type: 'tab',
          title: t.title || t.url || 'New Tab',
          subtitle: `${ws.name} • ${t.url || 'Internal Page'}`,
          icon: t.isGhost ? '👻' : (t.favicon || '📄'),
          isFaviconUrl: !!t.favicon && !t.isGhost,
          wsColor: ws.color,
          payload: { tabId: t.id, workspaceId: t.workspaceId }
        };
      });
  }

  searchBookmarks(query = '') {
    const bms = bookmarkService.getAllBookmarks();
    return bms
      .filter(b => {
        if (!query) return true;
        const matchTitle = (b.title || '').toLowerCase().includes(query);
        const matchUrl = (b.url || '').toLowerCase().includes(query);
        const matchTag = (b.tags || []).some(tag => tag.toLowerCase().includes(query));
        return matchTitle || matchUrl || matchTag;
      })
      .map(b => ({
        type: 'bookmark',
        title: b.title || b.url,
        subtitle: `⭐ Bookmark • ${b.url}`,
        icon: b.favicon || '⭐',
        isFaviconUrl: !!b.favicon,
        payload: b.url
      }));
  }

  searchHistory(query = '') {
    const records = historyService.getAllRecords();
    return records
      .filter(h => {
        if (!query) return true;
        const matchTitle = (h.title || '').toLowerCase().includes(query);
        const matchUrl = (h.url || '').toLowerCase().includes(query);
        return matchTitle || matchUrl;
      })
      .slice(0, 8)
      .map(h => ({
        type: 'history',
        title: h.title || h.url,
        subtitle: `🕒 History • ${h.url}`,
        icon: h.favicon || '🕒',
        isFaviconUrl: !!h.favicon,
        payload: h.url
      }));
  }

  searchCommands(query = '') {
    return this.commands
      .filter(c => {
        if (!query) return true;
        const matchTitle = c.title.toLowerCase().includes(query);
        const matchDesc = c.desc.toLowerCase().includes(query);
        const matchCat = c.category.toLowerCase().includes(query);
        return matchTitle || matchDesc || matchCat;
      })
      .map(c => ({
        type: 'command',
        title: c.title,
        subtitle: `${c.desc} ${c.shortcut ? `(${c.shortcut})` : ''}`,
        icon: c.icon,
        shortcut: c.shortcut,
        payload: c
      }));
  }
}

const omniboxService = new OmniboxService();

module.exports = {
  OmniboxService,
  omniboxService
};
