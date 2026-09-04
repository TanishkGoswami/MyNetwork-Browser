// Workspace Secrets & API Keys Vault Service
const { eventBus } = require('../../shared/events/event-bus');

class WorkspaceVaultService {
  constructor() {
    this.secretsByWorkspace = new Map(); // wsId -> array of { id, key, value, description, isSecret }
    this.init();
  }

  init() {
    this.loadState();
  }

  loadState() {
    try {
      const raw = localStorage.getItem('workspace_vault_secrets');
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [wsId, list] of Object.entries(parsed)) {
          this.secretsByWorkspace.set(wsId, list);
        }
      }
    } catch (e) {
      console.warn('[WorkspaceVaultService] Load error:', e);
    }
  }

  saveState() {
    try {
      const obj = {};
      for (const [wsId, list] of this.secretsByWorkspace.entries()) {
        obj[wsId] = list;
      }
      localStorage.setItem('workspace_vault_secrets', JSON.stringify(obj));
      eventBus.emit('vault:secrets-updated');
    } catch (e) {}
  }

  getSecretsForWorkspace(wsId = 'ws_default') {
    return this.secretsByWorkspace.get(wsId) || [];
  }

  addSecret(wsId, key, value, description = '') {
    const list = this.getSecretsForWorkspace(wsId);
    const item = {
      id: 'sec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      key: key ? key.trim().toUpperCase() : 'NEW_SECRET',
      value: value || '',
      description: description || '',
      createdAt: new Date().toISOString()
    };
    list.unshift(item);
    this.secretsByWorkspace.set(wsId, list);
    this.saveState();
    return item;
  }

  updateSecret(wsId, secretId, updates) {
    const list = this.getSecretsForWorkspace(wsId);
    const index = list.findIndex(s => s.id === secretId);
    if (index !== -1) {
      list[index] = { ...list[index], ...updates };
      this.secretsByWorkspace.set(wsId, list);
      this.saveState();
      return list[index];
    }
    return null;
  }

  deleteSecret(wsId, secretId) {
    const list = this.getSecretsForWorkspace(wsId);
    const filtered = list.filter(s => s.id !== secretId);
    this.secretsByWorkspace.set(wsId, filtered);
    this.saveState();
  }

  exportEnvFormat(wsId) {
    const list = this.getSecretsForWorkspace(wsId);
    return list.map(s => `${s.key}=${s.value}`).join('\n');
  }

  importEnvFormat(wsId, envText) {
    if (!envText) return 0;
    const lines = envText.split('\n');
    let count = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();
        if (key) {
          this.addSecret(wsId, key, val);
          count++;
        }
      }
    }
    return count;
  }
}

const workspaceVaultService = new WorkspaceVaultService();

module.exports = { WorkspaceVaultService, workspaceVaultService };
