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
          isDefault: true,
          createdAt: Date.now()
        },
        {
          id: 'ws_work',
          name: 'Work & Dev',
          icon: 'code',
          color: '#10b981',
          isDefault: false,
          createdAt: Date.now()
        },
        {
          id: 'ws_personal',
          name: 'Personal',
          icon: 'user',
          color: '#8b5cf6',
          isDefault: false,
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
    if (!ws || this.activeWorkspaceId === id) return ws;
    
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

  createWorkspace({ name, icon = 'folder', color = '#007aff' }) {
    const trimmedName = (name || '').trim();
    if (!trimmedName) throw new Error('Workspace name cannot be empty');

    const id = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newWs = {
      id,
      name: trimmedName,
      icon: icon || 'folder',
      color: color || '#007aff',
      isDefault: false,
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

    this.workspaces[idx] = ws;
    this.saveWorkspaces();

    eventBus.emit(EVENTS.WORKSPACE_CHANGED, {
      action: 'updated',
      workspace: ws
    });

    return ws;
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
}

const workspaceService = new WorkspaceService();
module.exports = { workspaceService, WorkspaceService };
