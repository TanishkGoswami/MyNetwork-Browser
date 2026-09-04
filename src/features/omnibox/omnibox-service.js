// OmniboxService - Intelligent Omnibox Prefix Parser & Command Dispatcher
const { tabManager } = require('../../core/tabs/tab-manager');
const { bookmarkService, workspaceService } = require('../../features/bookmarks');
const { historyService } = require('../../features/history/history-service');
const { containerService } = require('../../features/containers/container-service');

const ICONS = {
  tab: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>',
  ghost: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  workspaces: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  bookmark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  history: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  passwords: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5M19 5l-2.5 2.5M9 11l-7 7v4h4l7-7"/><circle cx="16" cy="8" r="5"/></svg>',
  split: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
  theme: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/></svg>',
  brush: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 2-2.7 2.7a2.5 2.5 0 0 0 0 3.5l1.5 1.5a2.5 2.5 0 0 1 0 3.5L17 17l-4-4 3.8-3.8a2.5 2.5 0 0 1 3.5 0l1.5 1.5a2.5 2.5 0 0 0 3.5 0L22 8V2z"/></svg>',
  layers: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
  tree: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
  hibernate: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  dev: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  phone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  github: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>',
  mock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  vault: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  macro: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  globe: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
};

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
        icon: ICONS.ghost,
        shortcut: 'Ctrl+Shift+G',
        category: 'Tabs',
        handler: (shell) => {
          tabManager.createTab('https://www.google.com', 'Ghost Tab', null, null, null, true);
          shell.showToast('Opened Ghost Tab');
        }
      },
      {
        id: 'cmd_new_tab',
        title: 'New Tab',
        desc: 'Create a new tab in current workspace',
        icon: ICONS.plus,
        shortcut: 'Ctrl+T',
        category: 'Tabs',
        handler: () => tabManager.createTab()
      },
      {
        id: 'cmd_projects',
        title: 'Open Project Workspaces Board',
        desc: 'Manage isolated workspaces and contexts',
        icon: ICONS.workspaces,
        shortcut: 'Ctrl+Shift+P',
        category: 'Workspaces',
        handler: (shell) => shell.openProjectsTab()
      },
      {
        id: 'cmd_bookmarks',
        title: 'Open Bookmarks Manager',
        desc: 'Organize bookmarks, tags, and folders',
        icon: ICONS.bookmark,
        shortcut: 'Ctrl+Shift+O',
        category: 'Navigation',
        handler: (shell) => shell.openBookmarksTab()
      },
      {
        id: 'cmd_history',
        title: 'Open History',
        desc: 'View and search browsing history',
        icon: ICONS.history,
        shortcut: 'Ctrl+H',
        category: 'Navigation',
        handler: (shell) => shell.openHistoryTab()
      },
      {
        id: 'cmd_passwords',
        title: 'Open Passwords Vault',
        desc: 'Manage saved credentials and logins',
        icon: ICONS.passwords,
        shortcut: 'Ctrl+Shift+L',
        category: 'Security',
        handler: (shell) => shell.openPasswordsTab()
      },
      {
        id: 'cmd_split_view',
        title: 'Toggle Split Screen View',
        desc: 'View multiple sites side by side',
        icon: ICONS.split,
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
        icon: ICONS.theme,
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
        icon: ICONS.brush,
        shortcut: '',
        category: 'Privacy',
        handler: (shell) => {
          historyService.clearAll();
          shell.showToast('Browsing cache and history cleared');
        }
      },
      {
        id: 'cmd_close_duplicates',
        title: 'Close Duplicate Tabs',
        desc: 'Detect and close all redundant tabs',
        icon: ICONS.layers,
        shortcut: '',
        category: 'Tab Intelligence',
        handler: (shell) => {
          const { tabIntelligenceService } = require('../intelligence/tab-intelligence');
          const count = tabIntelligenceService.closeDuplicateTabs();
          shell.renderWorkspaceTabs();
          shell.showToast(count > 0 ? `Closed ${count} duplicate tabs` : 'No duplicate tabs found');
        }
      },
      {
        id: 'cmd_group_domains',
        title: 'Group Tabs by Domain (Tree)',
        desc: 'Organize related domain tabs into tree hierarchies',
        icon: ICONS.tree,
        shortcut: '',
        category: 'Tab Intelligence',
        handler: (shell) => {
          const { tabIntelligenceService } = require('../intelligence/tab-intelligence');
          const count = tabIntelligenceService.organizeTabsIntoTreesByDomain();
          shell.renderWorkspaceTabs();
          shell.showToast(`Organized tabs into domain trees (${count} nested)`);
        }
      },
      {
        id: 'cmd_hibernate_inactive',
        title: 'Hibernate Inactive Tabs',
        desc: 'Suspend background tabs to free CPU & RAM',
        icon: ICONS.hibernate,
        shortcut: '',
        category: 'Performance',
        handler: (shell) => {
          const { tabHibernateService } = require('../performance/tab-hibernate');
          const count = tabHibernateService.hibernateAllInactive();
          shell.renderWorkspaceTabs();
          shell.showToast(count > 0 ? `Suspended ${count} idle tabs to free memory` : 'All tabs are active');
        }
      },
      {
        id: 'cmd_dev_tools',
        title: 'Open Developer Toolbox',
        desc: 'REST client, JWT decoder, Regex playground, JSON formatter',
        icon: ICONS.dev,
        shortcut: 'Ctrl+Shift+I',
        category: 'Developer',
        handler: (shell) => {
          shell.openDevToolboxModal();
        }
      },
      {
        id: 'cmd_phone_sync',
        title: 'Push Tab to Phone (QR Code)',
        desc: 'Scan QR code on mobile camera to instantly continue browsing',
        icon: ICONS.phone,
        shortcut: '',
        category: 'Continuity',
        handler: (shell) => {
          shell.openContinuityModal();
        }
      },
      {
        id: 'cmd_adblock_shield',
        title: 'Ad & Tracker Shield Settings',
        desc: 'Toggle privacy blocking and tracker protections',
        icon: ICONS.shield,
        shortcut: '',
        category: 'Privacy',
        handler: (shell) => {
          shell.openShieldModal();
        }
      },
      {
        id: 'cmd_github_hub',
        title: 'GitHub Developer Hub & PR Glance',
        desc: 'Review open PRs, track issues, create instant Gists',
        icon: ICONS.github,
        shortcut: 'Ctrl+G',
        category: 'Developer',
        handler: (shell) => {
          if (typeof shell.openGitHubHubModal === 'function') {
            shell.openGitHubHubModal();
          }
        }
      },
      {
        id: 'cmd_mock_server',
        title: 'API Mock Server & Latency Simulator',
        desc: 'Intercept endpoints, stub JSON payloads, test slow networks',
        icon: ICONS.mock,
        shortcut: 'Ctrl+M',
        category: 'Developer',
        handler: (shell) => {
          if (typeof shell.openMockServerModal === 'function') {
            shell.openMockServerModal();
          }
        }
      },
      {
        id: 'cmd_workspace_vault',
        title: 'Workspace Secrets & .env Vault',
        desc: 'Manage environment variables, API keys, and workspace tokens',
        icon: ICONS.vault,
        shortcut: 'Ctrl+Shift+E',
        category: 'Developer',
        handler: (shell) => {
          if (typeof shell.openWorkspaceVaultModal === 'function') {
            shell.openWorkspaceVaultModal();
          }
        }
      },
      {
        id: 'cmd_macro_record',
        title: 'Record Browser Macro',
        desc: 'Record clicks and form fills to automate repetitive workflows',
        icon: ICONS.macro,
        shortcut: 'Ctrl+Shift+R',
        category: 'Automation',
        handler: (shell) => {
          if (typeof shell.toggleMacroRecording === 'function') {
            shell.toggleMacroRecording();
          }
        }
      },
      {
        id: 'cmd_macro_library',
        title: 'Macro Library & Playback',
        desc: 'View, edit, and run saved automation scripts',
        icon: ICONS.macro,
        shortcut: '',
        category: 'Automation',
        handler: (shell) => {
          if (typeof shell.openMacroLibraryModal === 'function') {
            shell.openMacroLibraryModal();
          }
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
      icon: isUrl ? ICONS.globe : ICONS.search,
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
          icon: t.isGhost ? ICONS.ghost : (t.favicon || ICONS.tab),
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
        subtitle: `Bookmark • ${b.url}`,
        icon: b.favicon || ICONS.bookmark,
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
        subtitle: `History • ${h.url}`,
        icon: h.favicon || ICONS.history,
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
