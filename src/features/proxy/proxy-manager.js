// Workspace Proxy Manager - Custom SOCKS5/HTTP Proxy routing
const { eventBus } = require('../../shared/events/event-bus');

class ProxyManager {
  constructor() {
    this.profiles = [];
    this.workspaceProxyMap = new Map(); // workspaceId -> profileId
    this.init();
  }

  init() {
    try {
      const savedProfiles = localStorage.getItem('proxy_profiles');
      if (savedProfiles) {
        this.profiles = JSON.parse(savedProfiles);
      } else {
        this.profiles = [
          { id: 'proxy_direct', name: 'Direct (No Proxy)', type: 'direct', host: '', port: '', flag: '⚡' },
          { id: 'proxy_us', name: 'US Gateway (Demo)', type: 'http', host: 'us-proxy.mynetwork.internal', port: '8080', flag: '🇺🇸' },
          { id: 'proxy_in', name: 'India Gateway (Demo)', type: 'http', host: 'in-proxy.mynetwork.internal', port: '8080', flag: '🇮🇳' },
          { id: 'proxy_sg', name: 'Singapore Gateway (Demo)', type: 'socks5', host: 'sg-proxy.mynetwork.internal', port: '1080', flag: '🇸🇬' }
        ];
        this.save();
      }

      const savedMap = localStorage.getItem('workspace_proxy_map');
      if (savedMap) {
        this.workspaceProxyMap = new Map(JSON.parse(savedMap));
      }
    } catch (e) {
      this.profiles = [{ id: 'proxy_direct', name: 'Direct (No Proxy)', type: 'direct', host: '', port: '', flag: '⚡' }];
    }
  }

  save() {
    try {
      localStorage.setItem('proxy_profiles', JSON.stringify(this.profiles));
      localStorage.setItem('workspace_proxy_map', JSON.stringify([...this.workspaceProxyMap]));
      eventBus.emit('proxy:updated', { profiles: this.profiles });
    } catch (e) {}
  }

  getProfiles() {
    return [...this.profiles];
  }

  getProfile(id) {
    return this.profiles.find(p => p.id === id) || this.profiles[0];
  }

  getProxyForWorkspace(workspaceId) {
    const profileId = this.workspaceProxyMap.get(workspaceId || 'ws_default') || 'proxy_direct';
    return this.getProfile(profileId);
  }

  setProxyForWorkspace(workspaceId, profileId) {
    this.workspaceProxyMap.set(workspaceId || 'ws_default', profileId);
    this.save();

    const profile = this.getProfile(profileId);
    eventBus.emit('proxy:workspace-bound', { workspaceId, profile });
    return profile;
  }

  createProfile({ name, type = 'http', host, port, username = '', password = '', flag = '🌐' }) {
    const profile = {
      id: 'proxy_' + Date.now(),
      name: name || `${host}:${port}`,
      type,
      host,
      port,
      username,
      password,
      flag
    };
    this.profiles.push(profile);
    this.save();
    return profile;
  }

  deleteProfile(id) {
    if (id === 'proxy_direct') return false;
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.profiles.splice(idx, 1);
    this.save();
    return true;
  }
}

const proxyManager = new ProxyManager();

module.exports = { ProxyManager, proxyManager };
