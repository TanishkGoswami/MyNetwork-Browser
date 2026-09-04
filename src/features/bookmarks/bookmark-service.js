// BookmarkService - Comprehensive Bookmark & Folder Tree Store for MyNetwork Browser
const { storage } = require('../../infrastructure/storage/storage-adapter');
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS } = require('../../shared/constants');
const { workspaceService } = require('./workspace-service');

class BookmarkService {
  constructor() {
    this.storageKey = 'mynetwork_bookmarks_v1';
    this.state = this.loadState();
  }

  loadState() {
    let data = storage.get(this.storageKey, null);
    if (!data || !data.roots || !data.items) {
      data = this.createDefaultSeed();
      this.saveState(data);
    } else {
      this.sanitizeState(data);
      this.saveState(data);
    }
    return data;
  }

  sanitizeState(data) {
    if (!data || !data.roots || !data.items) return;
    
    // 1. Prune duplicate bookmarks with identical URLs
    const seenUrls = new Set();
    const duplicateIds = new Set();
    Object.values(data.items).forEach(item => {
      if (item && item.type === 'bookmark') {
        const u = this.normalizeUrl(item.url);
        if (u) {
          if (seenUrls.has(u)) {
            duplicateIds.add(item.id);
          } else {
            seenUrls.add(u);
          }
        }
      }
    });

    duplicateIds.forEach(id => {
      delete data.items[id];
    });

    // 2. Ensure all roots have unique, existing children
    Object.values(data.roots).forEach(r => {
      if (Array.isArray(r.children)) {
        r.children = Array.from(new Set(r.children)).filter(id => !!data.items[id]);
      }
    });

    // 3. Clean up folder children
    Object.values(data.items).forEach(item => {
      if (item && item.type === 'folder' && Array.isArray(item.children)) {
        item.children = Array.from(new Set(item.children)).filter(id => !!data.items[id]);
      }
    });
  }

  saveState(data = this.state) {
    this.state = data;
    storage.set(this.storageKey, data);
    eventBus.emit(EVENTS.BOOKMARKS_UPDATED, { timestamp: Date.now() });
  }

  createDefaultSeed() {
    const now = Date.now();
    const items = {
      'bm_openrouter': {
        id: 'bm_openrouter',
        type: 'bookmark',
        parentId: 'root_bar',
        workspaceId: 'ws_default',
        title: 'OpenRouter: Unified Interface',
        url: 'https://openrouter.ai/',
        favicon: 'https://openrouter.ai/favicon.ico',
        tags: ['ai', 'models', 'api'],
        notes: 'Universal LLM Router & Inference API',
        createdAt: now - 3600000,
        updatedAt: now - 3600000,
        visitCount: 15,
        lastVisitedAt: now,
        isRead: true
      },
      'bm_github': {
        id: 'bm_github',
        type: 'bookmark',
        parentId: 'root_bar',
        workspaceId: 'ws_work',
        title: 'GitHub',
        url: 'https://github.com/',
        favicon: 'https://github.githubassets.com/favicons/favicon.svg',
        tags: ['code', 'git', 'dev'],
        notes: 'Repositories and version control',
        createdAt: now - 7200000,
        updatedAt: now - 7200000,
        visitCount: 28,
        lastVisitedAt: now,
        isRead: true
      },
      'bm_supabase': {
        id: 'bm_supabase',
        type: 'bookmark',
        parentId: 'root_bar',
        workspaceId: 'ws_work',
        title: 'Supabase',
        url: 'https://supabase.com/',
        favicon: 'https://supabase.com/favicon/favicon-196x196.png',
        tags: ['database', 'backend', 'postgres'],
        notes: 'The Open Source Firebase Alternative',
        createdAt: now - 10800000,
        updatedAt: now - 10800000,
        visitCount: 9,
        lastVisitedAt: now,
        isRead: true
      },
      'bm_facebook_dev': {
        id: 'bm_facebook_dev',
        type: 'bookmark',
        parentId: 'root_bar',
        workspaceId: 'ws_work',
        title: 'Meta for Developers',
        url: 'https://developers.facebook.com/apps/',
        favicon: 'https://static.xx.fbcdn.net/rsrc.php/v3/yD/r/D7G1_0M47m_.png',
        tags: ['meta', 'facebook', 'cpaas', 'whatsapp'],
        notes: 'Meta Apps, Graph API & WhatsApp Cloud Dashboard',
        createdAt: now - 14400000,
        updatedAt: now - 14400000,
        visitCount: 22,
        lastVisitedAt: now,
        isRead: true
      },
      'fold_dev': {
        id: 'fold_dev',
        type: 'folder',
        parentId: 'root_bar',
        workspaceId: 'ws_work',
        title: 'Dev Resources',
        color: '#f59e0b',
        children: ['bm_supabase', 'bm_facebook_dev'],
        createdAt: now - 20000000
      }
    };

    return {
      version: 1,
      roots: {
        bar: {
          id: 'root_bar',
          title: 'Favorites Bar',
          children: ['bm_openrouter', 'bm_github', 'fold_dev']
        },
        other: {
          id: 'root_other',
          title: 'Other Bookmarks',
          children: []
        },
        readingList: {
          id: 'root_reading',
          title: 'Reading List',
          children: []
        },
        trash: {
          id: 'root_trash',
          title: 'Trash',
          children: []
        }
      },
      items
    };
  }

  getItem(id) {
    if (!id) return null;
    if (this.state.roots) {
      if (this.state.roots[id]) return this.state.roots[id];
      for (const r of Object.values(this.state.roots)) {
        if (r && r.id === id) return r;
      }
    }
    return this.state.items ? (this.state.items[id] || null) : null;
  }

  isBookmarked(url) {
    if (!url) return false;
    const normalized = this.normalizeUrl(url);
    return Object.values(this.state.items).some(
      item => item.type === 'bookmark' && item.parentId !== 'root_trash' && this.normalizeUrl(item.url) === normalized
    );
  }

  getBookmarkByUrl(url) {
    if (!url) return null;
    const normalized = this.normalizeUrl(url);
    return Object.values(this.state.items).find(
      item => item.type === 'bookmark' && item.parentId !== 'root_trash' && this.normalizeUrl(item.url) === normalized
    ) || null;
  }

  normalizeUrl(urlStr) {
    if (!urlStr) return '';
    try {
      const u = new URL(urlStr);
      let p = u.origin + u.pathname;
      if (p.endsWith('/') && p.length > u.origin.length + 1) p = p.slice(0, -1);
      return p.toLowerCase();
    } catch (e) {
      return (urlStr || '').trim().toLowerCase().replace(/\/+$/, '');
    }
  }

  extractDomain(urlStr) {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  getFavoritesBarItems(workspaceId = null) {
    const barRoot = this.state.roots.bar;
    if (!barRoot) return [];
    
    return barRoot.children
      .map(id => this.state.items[id])
      .filter(item => {
        if (!item || item.parentId === 'root_trash') return false;
        if (workspaceId && item.workspaceId && item.workspaceId !== workspaceId) return false;
        return true;
      });
  }

  getReadingList(workspaceId = null) {
    const readRoot = this.state.roots.readingList;
    if (!readRoot) return [];
    
    return readRoot.children
      .map(id => this.state.items[id])
      .filter(item => {
        if (!item || item.parentId === 'root_trash') return false;
        if (workspaceId && item.workspaceId && item.workspaceId !== workspaceId) return false;
        return true;
      });
  }

  getTrashItems() {
    const trashRoot = this.state.roots.trash;
    if (!trashRoot) return [];
    return trashRoot.children
      .map(id => this.state.items[id])
      .filter(Boolean);
  }

  getAllBookmarks(workspaceId = null) {
    return Object.values(this.state.items).filter(item => {
      if (!item || item.parentId === 'root_trash') return false;
      if (workspaceId && item.workspaceId && item.workspaceId !== workspaceId) return false;
      return true;
    });
  }

  getBookmark(id) {
    return this.getItem(id);
  }

  getFolderChildren(folderId) {
    const folder = this.getItem(folderId);
    if (!folder || !Array.isArray(folder.children)) return [];
    return folder.children
      .map(childId => this.state.items[childId])
      .filter(item => item && item.parentId !== 'root_trash');
  }

  searchByTag(tag, workspaceId = null) {
    if (!tag) return [];
    const t = tag.trim().toLowerCase();
    return this.getAllBookmarks(workspaceId).filter(item => 
      Array.isArray(item.tags) && item.tags.some(tagItem => tagItem.toLowerCase() === t)
    );
  }

  emptyTrash() {
    const trashRoot = this.state.roots.trash;
    if (!trashRoot || !Array.isArray(trashRoot.children)) return;
    
    trashRoot.children.forEach(id => {
      delete this.state.items[id];
    });
    trashRoot.children = [];
    this.saveState();
  }

  getAllFolders() {
    const folders = [];
    // Root folders
    folders.push({ id: 'root_bar', title: 'Favorites Bar', isRoot: true });
    folders.push({ id: 'root_other', title: 'Other Bookmarks', isRoot: true });
    folders.push({ id: 'root_reading', title: 'Reading List', isRoot: true });

    // Custom user created folders
    Object.values(this.state.items).forEach(item => {
      if (item.type === 'folder' && item.parentId !== 'root_trash') {
        folders.push(item);
      }
    });

    return folders;
  }

  getAllTags() {
    const tagMap = new Map();
    Object.values(this.state.items).forEach(item => {
      if (item.type === 'bookmark' && item.parentId !== 'root_trash' && Array.isArray(item.tags)) {
        item.tags.forEach(tag => {
          const t = tag.trim().toLowerCase();
          if (t) tagMap.set(t, (tagMap.get(t) || 0) + 1);
        });
      }
    });
    return Array.from(tagMap.entries()).map(([name, count]) => ({ name, count }));
  }

  getFolderTree(parentId = 'root_bar') {
    const parent = this.getItem(parentId);
    if (!parent) return [];

    const children = (parent.children || []).map(childId => {
      const item = this.state.items[childId];
      if (!item || item.parentId === 'root_trash') return null;
      if (item.type === 'folder') {
        return {
          ...item,
          children: this.getFolderTree(item.id)
        };
      }
      return { ...item };
    }).filter(Boolean);

    return children;
  }

  search({ query = '', rootId = null, folderId = null, workspaceId = null, tag = null, isRead = null } = {}) {
    const q = (query || '').trim().toLowerCase();
    const selectedTag = (tag || '').trim().toLowerCase();

    return Object.values(this.state.items).filter(item => {
      if (!item || item.parentId === 'root_trash') return false;

      // Filter by Workspace
      if (workspaceId && item.workspaceId && item.workspaceId !== workspaceId) return false;

      // Filter by Folder / Parent
      if (folderId && item.parentId !== folderId) return false;
      if (rootId && item.parentId !== rootId) {
        // Also allow items inside subfolders of this root
        if (!this.isDescendantOf(item.parentId, rootId)) return false;
      }

      // Filter by Tag
      if (selectedTag && (!Array.isArray(item.tags) || !item.tags.some(t => t.toLowerCase() === selectedTag))) {
        return false;
      }

      // Filter by Read Status
      if (isRead !== null && item.type === 'bookmark' && item.isRead !== isRead) return false;

      // Query Search
      if (q) {
        const titleMatch = (item.title || '').toLowerCase().includes(q);
        const urlMatch = (item.url || '').toLowerCase().includes(q);
        const notesMatch = (item.notes || '').toLowerCase().includes(q);
        const tagMatch = Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase().includes(q));
        const domainMatch = this.extractDomain(item.url || '').toLowerCase().includes(q);
        if (!titleMatch && !urlMatch && !notesMatch && !tagMatch && !domainMatch) return false;
      }

      return true;
    });
  }

  isDescendantOf(childParentId, ancestorId) {
    if (!childParentId || !ancestorId) return false;
    if (childParentId === ancestorId) return true;
    const parent = this.state.items[childParentId];
    if (!parent) return false;
    return this.isDescendantOf(parent.parentId, ancestorId);
  }

  // --- CRUD Operations ---

  createBookmark({
    title,
    url,
    favicon = null,
    parentId = 'root_bar',
    workspaceId = null,
    tags = [],
    notes = '',
    isRead = false
  }) {
    if (!url || !url.trim()) throw new Error('Bookmark URL is required');
    const trimmedTitle = (title || url).trim();
    
    // Smart Workspace Auto-Detection & Tagging
    const smartClass = workspaceService.classifyUrl(url);
    const activeWorkspace = (workspaceId && workspaceId !== 'auto')
      ? workspaceId 
      : smartClass.workspaceId;

    const finalTags = (Array.isArray(tags) && tags.length > 0)
      ? Array.from(new Set(tags.map(t => t.trim()).filter(Boolean)))
      : (smartClass.suggestedTags || []);

    const id = `bm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newBm = {
      id,
      type: 'bookmark',
      parentId: parentId || 'root_bar',
      workspaceId: activeWorkspace,
      title: trimmedTitle,
      url: url.trim(),
      favicon: favicon || `https://www.google.com/s2/favicons?domain=${this.extractDomain(url)}&sz=64`,
      tags: finalTags,
      notes: (notes || '').trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      visitCount: 0,
      lastVisitedAt: null,
      isRead: !!isRead
    };

    this.state.items[id] = newBm;

    // Attach to parent container
    const parent = this.getItem(newBm.parentId);
    if (parent && Array.isArray(parent.children)) {
      if (!parent.children.includes(id)) {
        parent.children.unshift(id); // Place at top of shelf
      }
    } else {
      newBm.parentId = 'root_bar';
      this.state.roots.bar.children.unshift(id);
    }

    this.saveState();
    return newBm;
  }

  updateBookmark(id, updates = {}) {
    const bm = this.state.items[id];
    if (!bm || bm.type !== 'bookmark') return null;

    if (updates.title !== undefined) bm.title = updates.title.trim() || bm.url;
    if (updates.url !== undefined && updates.url.trim()) {
      bm.url = updates.url.trim();
      if (!updates.favicon) {
        bm.favicon = `https://www.google.com/s2/favicons?domain=${this.extractDomain(bm.url)}&sz=64`;
      }
    }
    if (updates.favicon !== undefined) bm.favicon = updates.favicon;
    if (updates.notes !== undefined) bm.notes = updates.notes;
    if (updates.tags !== undefined && Array.isArray(updates.tags)) {
      bm.tags = updates.tags.map(t => t.trim()).filter(Boolean);
    }
    if (updates.isRead !== undefined) bm.isRead = !!updates.isRead;
    if (updates.workspaceId !== undefined) bm.workspaceId = updates.workspaceId;

    // Handle Move / Reparenting
    if (updates.parentId && updates.parentId !== bm.parentId) {
      this.reparentItem(id, updates.parentId);
    }

    bm.updatedAt = Date.now();
    this.state.items[id] = bm;
    this.saveState();
    return bm;
  }

  createFolder({ title, parentId = 'root_bar', workspaceId = null, color = '#f59e0b' }) {
    const trimmedTitle = (title || 'New Folder').trim();
    const activeWorkspace = workspaceId || workspaceService.getActiveWorkspaceId();

    const id = `fold_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newFolder = {
      id,
      type: 'folder',
      parentId: parentId || 'root_bar',
      workspaceId: activeWorkspace,
      title: trimmedTitle,
      color: color || '#f59e0b',
      children: [],
      createdAt: Date.now()
    };

    this.state.items[id] = newFolder;

    const parent = this.getItem(newFolder.parentId);
    if (parent && Array.isArray(parent.children)) {
      parent.children.push(id);
    } else {
      newFolder.parentId = 'root_bar';
      this.state.roots.bar.children.push(id);
    }

    this.saveState();
    return newFolder;
  }

  updateFolder(id, updates = {}) {
    const fold = this.state.items[id];
    if (!fold || fold.type !== 'folder') return null;

    if (updates.title !== undefined) fold.title = updates.title.trim() || 'Untitled Folder';
    if (updates.color !== undefined) fold.color = updates.color;
    if (updates.workspaceId !== undefined) fold.workspaceId = updates.workspaceId;

    if (updates.parentId && updates.parentId !== fold.parentId) {
      this.reparentItem(id, updates.parentId);
    }

    this.state.items[id] = fold;
    this.saveState();
    return fold;
  }

  reparentItem(itemId, newParentId) {
    const item = this.state.items[itemId];
    if (!item) return;

    // Remove from old parent
    const oldParent = this.getItem(item.parentId);
    if (oldParent && Array.isArray(oldParent.children)) {
      oldParent.children = oldParent.children.filter(cid => cid !== itemId);
    }
    // Also strip from all root children arrays to avoid ghost duplicates
    if (this.state.roots) {
      Object.values(this.state.roots).forEach(r => {
        if (Array.isArray(r.children)) {
          r.children = r.children.filter(cid => cid !== itemId);
        }
      });
    }

    // Add to new parent
    const newParent = this.getItem(newParentId);
    if (newParent && Array.isArray(newParent.children)) {
      if (!newParent.children.includes(itemId)) {
        newParent.children.push(itemId);
      }
      item.parentId = newParent.id || newParentId;
    } else {
      const bar = this.getItem('root_bar');
      if (bar && Array.isArray(bar.children) && !bar.children.includes(itemId)) {
        bar.children.push(itemId);
      }
      item.parentId = 'root_bar';
    }
  }

  deleteBookmark(id, permanent = true) {
    const item = this.state.items[id];
    if (!item) return false;

    // 1. Remove from all parent folder children arrays
    Object.values(this.state.items).forEach(otherItem => {
      if (otherItem && otherItem.type === 'folder' && Array.isArray(otherItem.children)) {
        otherItem.children = otherItem.children.filter(cid => cid !== id);
      }
    });

    // 2. Remove from all root folders
    if (this.state.roots) {
      Object.values(this.state.roots).forEach(r => {
        if (Array.isArray(r.children)) {
          r.children = r.children.filter(cid => cid !== id);
        }
      });
    }

    if (permanent) {
      delete this.state.items[id];
    } else {
      item.parentId = 'root_trash';
      const trash = this.getItem('root_trash');
      if (trash && Array.isArray(trash.children) && !trash.children.includes(id)) {
        trash.children.push(id);
      }
    }

    this.saveState();
    return true;
  }

  deleteFolder(id, permanent = true) {
    const folder = this.state.items[id];
    if (!folder || folder.type !== 'folder') return false;

    // Recursively delete all children
    if (Array.isArray(folder.children)) {
      folder.children.forEach(cid => {
        if (this.state.items[cid]?.type === 'folder') {
          this.deleteFolder(cid, permanent);
        } else {
          this.deleteBookmark(cid, permanent);
        }
      });
    }

    // Remove from all parents and roots
    const parent = this.getItem(folder.parentId);
    if (parent && Array.isArray(parent.children)) {
      parent.children = parent.children.filter(cid => cid !== id);
    }
    if (this.state.roots) {
      Object.values(this.state.roots).forEach(r => {
        if (Array.isArray(r.children)) {
          r.children = r.children.filter(cid => cid !== id);
        }
      });
    }

    if (permanent) {
      delete this.state.items[id];
    } else {
      folder.parentId = 'root_trash';
      const trash = this.getItem('root_trash');
      if (trash && Array.isArray(trash.children) && !trash.children.includes(id)) {
        trash.children.push(id);
      }
    }

    this.saveState();
    return true;
  }

  moveToTrash(id) {
    const item = this.getItem(id);
    if (!item) return false;
    if (item.type === 'folder') {
      return this.deleteFolder(id, false);
    } else {
      return this.deleteBookmark(id, false);
    }
  }

  batchMoveToTrash(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    let count = 0;
    ids.forEach(id => {
      if (this.moveToTrash(id)) count++;
    });
    return count;
  }

  batchDelete(ids = [], permanent = true) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    let count = 0;
    ids.forEach(id => {
      const item = this.getItem(id);
      if (item) {
        if (item.type === 'folder') {
          if (this.deleteFolder(id, permanent)) count++;
        } else {
          if (this.deleteBookmark(id, permanent)) count++;
        }
      }
    });
    return count;
  }

  restoreFromTrash(id, targetParentId = 'root_bar') {
    const item = this.state.items[id];
    if (!item || item.parentId !== 'root_trash') return false;

    this.reparentItem(id, targetParentId || 'root_bar');
    this.saveState();
    return true;
  }

  batchRestore(ids = [], targetParentId = 'root_bar') {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    let count = 0;
    ids.forEach(id => {
      if (this.restoreFromTrash(id, targetParentId)) count++;
    });
    return count;
  }

  emptyTrash() {
    const trash = this.state.roots.trash;
    if (!trash || !Array.isArray(trash.children)) return;

    trash.children.forEach(id => {
      delete this.state.items[id];
    });
    trash.children = [];
    this.saveState();
  }

  recordVisit(urlOrId) {
    let bm = this.state.items[urlOrId];
    if (!bm) {
      bm = this.getBookmarkByUrl(urlOrId);
    }
    if (bm && bm.type === 'bookmark') {
      bm.visitCount = (bm.visitCount || 0) + 1;
      bm.lastVisitedAt = Date.now();
      this.state.items[bm.id] = bm;
      this.saveState();
    }
  }

  // --- Power Tools: Import / Export & Duplicate Finder ---

  findDuplicates() {
    const urlMap = new Map();
    const duplicates = [];

    Object.values(this.state.items).forEach(item => {
      if (item.type === 'bookmark' && item.parentId !== 'root_trash') {
        const norm = this.normalizeUrl(item.url);
        if (!urlMap.has(norm)) {
          urlMap.set(norm, [item]);
        } else {
          urlMap.get(norm).push(item);
        }
      }
    });

    urlMap.forEach((list, url) => {
      if (list.length > 1) {
        duplicates.push({ url, items: list });
      }
    });

    return duplicates;
  }

  exportToNetscapeHtml() {
    const date = Math.floor(Date.now() / 1000);
    let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n`;
    html += `<!-- This is an automatically generated file. It will be read and overwritten. Do Not Edit! -->\n`;
    html += `<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n`;
    html += `<TITLE>Bookmarks</TITLE>\n`;
    html += `<H1>Bookmarks</H1>\n`;
    html += `<DL><p>\n`;

    const renderTree = (parentId) => {
      const parent = this.getItem(parentId);
      if (!parent || !Array.isArray(parent.children)) return '';
      let out = '';

      parent.children.forEach(cid => {
        const item = this.state.items[cid];
        if (!item || item.parentId === 'root_trash') return;

        if (item.type === 'folder') {
          out += `    <DT><H3 ADD_DATE="${date}" LAST_MODIFIED="${date}">${this.escapeHtml(item.title)}</H3>\n`;
          out += `    <DL><p>\n`;
          out += renderTree(item.id);
          out += `    </DL><p>\n`;
        } else if (item.type === 'bookmark') {
          const tags = Array.isArray(item.tags) && item.tags.length > 0 ? ` TAGS="${this.escapeHtml(item.tags.join(','))}"` : '';
          out += `    <DT><A HREF="${this.escapeHtml(item.url)}" ADD_DATE="${date}" ICON="${this.escapeHtml(item.favicon || '')}"${tags}>${this.escapeHtml(item.title)}</A>\n`;
        }
      });
      return out;
    };

    html += `    <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Favorites Bar</H3>\n`;
    html += `    <DL><p>\n`;
    html += renderTree('root_bar');
    html += `    </DL><p>\n`;

    html += `    <DT><H3>Other Bookmarks</H3>\n`;
    html += `    <DL><p>\n`;
    html += renderTree('root_other');
    html += `    </DL><p>\n`;

    html += `</DL><p>\n`;
    return html;
  }

  importFromNetscapeHtml(htmlString) {
    if (!htmlString || typeof htmlString !== 'string') return 0;

    let importedCount = 0;
    const aRegex = /<A\s+[^>]*HREF=["']([^"']+)["'][^>]*>([\s\S]*?)<\/A>/gi;
    let match;

    while ((match = aRegex.exec(htmlString)) !== null) {
      const url = match[1];
      let title = match[2].replace(/<[^>]+>/g, '').trim() || url;
      
      // Extract optional ICON
      let favicon = null;
      const iconMatch = match[0].match(/ICON=["']([^"']+)["']/i);
      if (iconMatch) favicon = iconMatch[1];

      // Extract optional TAGS
      let tags = [];
      const tagsMatch = match[0].match(/TAGS=["']([^"']+)["']/i);
      if (tagsMatch) tags = tagsMatch[1].split(',').map(t => t.trim());

      try {
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
          this.createBookmark({
            title,
            url,
            favicon,
            parentId: 'root_other',
            tags
          });
          importedCount++;
        }
      } catch (e) {}
    }

    return importedCount;
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

const bookmarkService = new BookmarkService();
module.exports = { bookmarkService, BookmarkService };
