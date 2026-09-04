// ContainerService - Multi-Profile Containers & Ghost Session Partitions
const { storage } = require('../../infrastructure/storage/storage-adapter');
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS } = require('../../shared/constants');

class ContainerService {
  constructor() {
    this.storageKey = 'mynetwork_containers_v1';
    this.containers = this.loadContainers();
  }

  loadContainers() {
    let list = storage.get(this.storageKey, null);
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = [
        {
          id: 'container_personal',
          name: 'Personal',
          color: '#007aff', // Apple Blue
          icon: 'user',
          partition: 'persist:container_personal',
          isDefault: true,
          createdAt: Date.now()
        },
        {
          id: 'container_work',
          name: 'Work',
          color: '#ff9500', // Apple Orange
          icon: 'briefcase',
          partition: 'persist:container_work',
          isDefault: false,
          createdAt: Date.now()
        },
        {
          id: 'container_dev',
          name: 'Dev & API',
          color: '#34c759', // Apple Green
          icon: 'code',
          partition: 'persist:container_dev',
          isDefault: false,
          createdAt: Date.now()
        },
        {
          id: 'container_client_a',
          name: 'Client A',
          color: '#af52de', // Apple Purple
          icon: 'users',
          partition: 'persist:container_client_a',
          isDefault: false,
          createdAt: Date.now()
        }
      ];
      this.saveContainers(list);
    }
    return list;
  }

  saveContainers(data = this.containers) {
    this.containers = data;
    storage.set(this.storageKey, data);
  }

  getAllContainers() {
    return [...this.containers];
  }

  getContainer(id) {
    if (!id) return null;
    return this.containers.find(c => c.id === id) || null;
  }

  createContainer({ name, color = '#007aff', icon = 'folder' }) {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('Container name cannot be empty');

    const id = `container_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newContainer = {
      id,
      name: trimmed,
      color,
      icon,
      partition: `persist:${id}`,
      isDefault: false,
      createdAt: Date.now()
    };

    this.containers.push(newContainer);
    this.saveContainers();
    return newContainer;
  }

  updateContainer(id, updates = {}) {
    const idx = this.containers.findIndex(c => c.id === id);
    if (idx === -1) return null;

    const c = this.containers[idx];
    if (updates.name) c.name = updates.name.trim();
    if (updates.color) c.color = updates.color;
    if (updates.icon) c.icon = updates.icon;

    this.containers[idx] = c;
    this.saveContainers();
    return c;
  }

  deleteContainer(id) {
    const idx = this.containers.findIndex(c => c.id === id);
    if (idx === -1 || this.containers[idx].isDefault) return false;

    this.containers.splice(idx, 1);
    this.saveContainers();
    return true;
  }

  // --- Session Partition Resolver ---

  /**
   * Resolves the Electron webview partition string for a tab.
   * @param {Object} options
   * @param {string} options.containerId - Named container ID (e.g. 'container_work')
   * @param {boolean} options.isGhost - If true, generates ephemeral in-memory partition
   * @param {string} options.tabId - Unique tab ID
   */
  resolvePartition({ containerId = null, isGhost = false, tabId = null }) {
    if (isGhost) {
      // Memory-only partition (no 'persist:' prefix) - immediately discarded on tab close
      return `ghost_${tabId || Date.now()}`;
    }

    if (containerId) {
      const container = this.getContainer(containerId);
      if (container) {
        return container.partition;
      }
    }

    // Default persistent partition
    return 'persist:default';
  }
}

const containerService = new ContainerService();

module.exports = {
  ContainerService,
  containerService
};
