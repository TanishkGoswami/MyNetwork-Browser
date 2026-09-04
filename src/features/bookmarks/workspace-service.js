// WorkspaceService - Manages Project/Context Spaces in MyNetwork Browser
const { storage } = require('../../infrastructure/storage/storage-adapter');
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS } = require('../../shared/constants');

class WorkspaceService {
  constructor() {
    this.storageKey = 'mynetwork_workspaces_v1';
    this.activeWorkspaceKey = 'mynetwork_active_workspace_id';
    this.workspaces = this.loadWorkspaces();
    this.activeWorkspaceId = storage.get(this.activeWorkspaceKey, 'ws_default');
    
    // Ensure active workspace exists
    if (!this.workspaces.find(w => w.id === this.activeWorkspaceId)) {
      this.activeWorkspaceId = this.workspaces[0]?.id || 'ws_default';
      storage.set(this.activeWorkspaceKey, this.activeWorkspaceId);
    }
  }

  loadWorkspaces() {
    let list = storage.get(this.storageKey, null);
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = [
        {
          id: 'ws_default',
          name: 'General',
          icon: 'globe',
          color: '#007aff',
          description: 'Daily browsing, general web, search & utilities',
          isDefault: true,
          activeTabId: null,
          createdAt: Date.now()
        },
        {
          id: 'ws_work',
          name: 'Work & Dev',
          icon: 'code',
          color: '#10b981',
          description: 'Coding repositories, APIs, localhost dev, cloud dashboards',
          isDefault: false,
          activeTabId: null,
          createdAt: Date.now()
        },
        {
          id: 'ws_personal',
          name: 'Personal',
          icon: 'user',
          color: '#8b5cf6',
          description: 'Social feeds, media streaming, shopping & personal reading',
          isDefault: false,
          activeTabId: null,
          createdAt: Date.now()
        }
      ];
      this.saveWorkspaces(list);
    }
    return list;
  }

  saveWorkspaces(data = this.workspaces) {
    this.workspaces = data;
    storage.set(this.storageKey, data);
  }

  getAllWorkspaces() {
    return [...this.workspaces];
  }

  getWorkspaces() {
    return this.getAllWorkspaces();
  }

  getWorkspace(id) {
    return this.workspaces.find(w => w.id === id) || null;
  }

  getActiveWorkspace() {
    return this.getWorkspace(this.activeWorkspaceId) || this.workspaces[0] || null;
  }

  getActiveWorkspaceId() {
    return this.activeWorkspaceId;
  }

  setActiveWorkspace(id) {
    const ws = this.getWorkspace(id);
    if (!ws) return this.getActiveWorkspace();
    if (this.activeWorkspaceId === id) return ws;
    
    const previousId = this.activeWorkspaceId;
    this.activeWorkspaceId = id;
    storage.set(this.activeWorkspaceKey, id);
    
    eventBus.emit(EVENTS.WORKSPACE_CHANGED, {
      previousId,
      currentId: id,
      workspace: ws
    });
    
    return ws;
  }

  createWorkspace({ name, icon = 'folder', color = '#007aff', description = '', devUrl = '' }) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) throw new Error('Workspace name cannot be empty');

    const id = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newWs = {
      id,
      name: trimmedName,
      icon: icon || 'folder',
      color: color || '#007aff',
      description: description.trim(),
      devUrl: devUrl.trim(),
      isDefault: false,
      activeTabId: null,
      createdAt: Date.now()
    };

    this.workspaces.push(newWs);
    this.saveWorkspaces();
    
    eventBus.emit(EVENTS.WORKSPACE_CHANGED, {
      action: 'created',
      workspace: newWs
    });

    return newWs;
  }

  updateWorkspace(id, updates = {}) {
    const idx = this.workspaces.findIndex(w => w.id === id);
    if (idx === -1) return null;

    const ws = this.workspaces[idx];
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (trimmed) ws.name = trimmed;
    }
    if (updates.icon !== undefined) ws.icon = updates.icon;
    if (updates.color !== undefined) ws.color = updates.color;
    if (updates.description !== undefined) ws.description = updates.description.trim();
    if (updates.devUrl !== undefined) ws.devUrl = updates.devUrl.trim();
    if (updates.activeTabId !== undefined) ws.activeTabId = updates.activeTabId;

    this.workspaces[idx] = ws;
    this.saveWorkspaces();

    eventBus.emit(EVENTS.WORKSPACE_CHANGED, {
      action: 'updated',
      workspace: ws
    });

    return ws;
  }

  duplicateWorkspace(id) {
    const source = this.getWorkspace(id);
    if (!source) return null;

    return this.createWorkspace({
      name: `${source.name} (Copy)`,
      icon: source.icon,
      color: source.color,
      description: source.description || '',
      devUrl: source.devUrl || ''
    });
  }

  deleteWorkspace(id) {
    if (id === 'ws_default') {
      throw new Error('Default workspace cannot be deleted');
    }

    const idx = this.workspaces.findIndex(w => w.id === id);
    if (idx === -1) return false;

    this.workspaces.splice(idx, 1);
    this.saveWorkspaces();

    if (this.activeWorkspaceId === id) {
      this.setActiveWorkspace('ws_default');
    } else {
      eventBus.emit(EVENTS.WORKSPACE_CHANGED, {
        action: 'deleted',
        deletedId: id
      });
    }

    return true;
  }

  // --- Smart Classification Engine ---

  classifyUrl(url) {
    if (!url || typeof url !== 'string') {
      return {
        workspaceId: 'ws_default',
        workspaceName: 'General',
        category: 'general',
        suggestedTags: ['general']
      };
    }

    let hostname = '';
    let pathname = '';
    try {
      const u = new URL(url.startsWith('http') ? url : 'https://' + url);
      hostname = u.hostname.toLowerCase().replace(/^www\./, '');
      pathname = u.pathname.toLowerCase();
    } catch (e) {
      hostname = url.toLowerCase().replace(/^www\./, '');
    }

    // 1. Work & Dev Rules (ws_work)
    const devDomains = [
      'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
      'npmjs.com', 'pypi.org', 'crates.io', 'packagist.org', 'rubygems.org',
      'supabase.com', 'firebase.google.com', 'mongodb.com', 'render.com', 'vercel.com',
      'netlify.com', 'railway.app', 'digitalocean.com', 'cloudflare.com', 'sentry.io',
      'postman.com', 'jira.atlassian.com', 'atlassian.net', 'slack.com', 'trello.com',
      'asana.com', 'notion.so', 'figma.com', 'linear.app', 'clickup.com', 'miro.com',
      'openrouter.ai', 'openai.com', 'anthropic.com', 'huggingface.co', 'developers.facebook.com',
      'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com', 'docker.com', 'kubernetes.io',
      'dev.to', 'hashnode.com', 'graphql.org', 'typescriptlang.org', 'react.dev'
    ];

    const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || 
                       hostname.endsWith('.dev') || hostname.endsWith('.local') || hostname.endsWith('.test') ||
                       hostname.includes('replit.com') || hostname.includes('codesandbox.io') || hostname.includes('codepen.io');

    const hasDevKeyword = hostname.includes('github') || hostname.includes('gitlab') || hostname.includes('stack') ||
                          hostname.includes('api.') || hostname.includes('developer') || hostname.includes('console') ||
                          hostname.includes('admin') || hostname.includes('cloud') || hostname.includes('dashboard') ||
                          pathname.includes('/dev') || pathname.includes('/api') || pathname.includes('/docs');

    if (isLocalDev || devDomains.some(d => hostname === d || hostname.endsWith('.' + d)) || hasDevKeyword) {
      const tags = ['dev'];
      if (hostname.includes('ai') || hostname.includes('openai') || hostname.includes('router') || hostname.includes('claude')) tags.push('ai');
      if (hostname.includes('git') || hostname.includes('code')) tags.push('code');
      if (hostname.includes('cloud') || hostname.includes('aws') || hostname.includes('supabase')) tags.push('cloud');
      
      const ws = this.workspaces.find(w => w.id === 'ws_work') || this.workspaces[0];
      return {
        workspaceId: ws?.id || 'ws_work',
        workspaceName: ws?.name || 'Work & Dev',
        category: 'work',
        suggestedTags: tags
      };
    }

    // 2. Personal Rules (ws_personal)
    const personalDomains = [
      'instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'threads.net',
      'tiktok.com', 'snapchat.com', 'pinterest.com', 'reddit.com', 'tumblr.com',
      'youtube.com', 'netflix.com', 'spotify.com', 'primevideo.com', 'disneyplus.com',
      'hulu.com', 'twitch.tv', 'soundcloud.com', 'hotstar.com', 'music.apple.com',
      'amazon.in', 'amazon.com', 'flipkart.com', 'myntra.com', 'ebay.com', 'aliexpress.com',
      'swiggy.com', 'zomato.com', 'uber.com', 'airbnb.com', 'booking.com',
      'web.whatsapp.com', 'telegram.org', 'web.telegram.org', 'discord.com', 'messenger.com'
    ];

    const isSocialOrEntertainment = personalDomains.some(d => hostname === d || hostname.endsWith('.' + d));

    if (isSocialOrEntertainment) {
      const tags = [];
      if (['instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'threads.net', 'reddit.com', 'tiktok.com'].some(d => hostname.includes(d))) {
        tags.push('social');
      }
      if (['youtube.com', 'netflix.com', 'spotify.com', 'twitch.tv', 'primevideo.com'].some(d => hostname.includes(d))) {
        tags.push('media');
      }
      if (['amazon', 'flipkart', 'myntra', 'ebay'].some(d => hostname.includes(d))) {
        tags.push('shopping');
      }
      if (['whatsapp', 'telegram', 'discord'].some(d => hostname.includes(d))) {
        tags.push('chat');
      }
      if (tags.length === 0) tags.push('personal');

      const ws = this.workspaces.find(w => w.id === 'ws_personal') || this.workspaces[0];
      return {
        workspaceId: ws?.id || 'ws_personal',
        workspaceName: ws?.name || 'Personal',
        category: 'personal',
        suggestedTags: tags
      };
    }

    // 3. Default General Rules (ws_default)
    const defaultWs = this.workspaces.find(w => w.id === 'ws_default') || this.workspaces[0];
    return {
      workspaceId: defaultWs?.id || 'ws_default',
      workspaceName: defaultWs?.name || 'General',
      category: 'general',
      suggestedTags: ['general']
    };
  }

  detectWorkspaceForUrl(url) {
    return this.classifyUrl(url).workspaceId;
  }
}

const workspaceService = new WorkspaceService();
module.exports = { workspaceService, WorkspaceService };
