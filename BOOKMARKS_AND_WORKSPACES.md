# MyNetwork Browser — Advanced Bookmark Manager & Workspaces Documentation

> **Status:** Specification & Architecture Reference  
> **Version:** 1.1.0  
> **Target Routes:** `mynetwork://bookmarks`, `mynetwork://settings#bookmarks`, `mynetwork://newtab`  
> **Shortcut Bindings:** <kbd>Ctrl</kbd> + <kbd>B</kbd> (Bookmark Manager), <kbd>Ctrl</kbd> + <kbd>D</kbd> (Quick Bookmark Popover), <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd> (Toggle Top Favorites Bar)

---

## 1. Executive Summary & Vision

In **MyNetwork Browser**, bookmarks and workspaces form a cohesive **productivity ecosystem**:
1. **Contextual Workspaces (Spaces):** Project-based environments (Work, Personal, MetaBull Dev, Research) that isolate active tabs, color themes, and pinned shelf bookmarks.
2. **New Tab Quick Access (Spotlight & Boards):** Fast shortcut bubbles directly below the search bar, plus an optional **Workspace Boards Grid** with categorized collections.
3. **Dedicated Settings Customization:** Full user control over bar visibility, default save locations, New Tab widget layout, and one-click Chrome/Safari import/export.
4. **macOS Native Aesthetics:** Apple SF Pro typography, glassmorphism (`backdrop-filter: blur(28px)`), smooth micro-animations, and keyboard-first navigation.

---

## 2. System Architecture & Module Structure

```
src/
├── features/
│   └── bookmarks/
│       ├── bookmark-service.js       # Core CRUD, Tree management, Tag indexer, Storage IO
│       ├── workspace-service.js      # Workspace lifecycle, Session switching, Context boundaries
│       ├── html-importer-exporter.js # Standard Netscape Bookmark HTML & JSON backup engine
│       ├── link-health-checker.js    # Background duplicate & broken link (404) scanner
│       └── index.js                  # Public feature module export
├── ui/
│   ├── shell/
│   │   └── index.js                  # Shell routing (mynetwork://bookmarks), Omnibox Star Modal, NewTab renderer
│   ├── styles/
│   │   └── styles.css                # macOS Light/Dark Tokens, New Tab Shortcut Pills, Settings controls
│   └── index.html                    # #bookmarks-view, #newtab-view shortcut rows, and Quick Star Popover
```

---

## 3. New Tab Page (Dashboard) Quick Bookmarks Integration

The New Tab page (`mynetwork://newtab`) integrates bookmarks through two customizable macOS-grade layouts:

### Layout Mode A: Spotlight Circular Shortcuts (Default)
Clean circular favicon tiles placed directly beneath the central search bar with an instant `+ Add Shortcut` modal:

```
                          [ 01:43 PM ]
                   Good afternoon, Explorer

   [   Search Google or type a URL...                     (+ AI Mode)   ]

       ( ⚡ )          ( G )          ( 📦 )          ( + )
     Supabase       Google Web     Chrome Store    Add shortcut
```

- **Features:**
  - High-res crisp favicon extraction with fallback domain initials.
  - Hover micro-lift animation with subtle glass shadow.
  - Right-click context menu: `Edit Shortcut`, `Open in New Tab`, `Remove`.
  - Drag-and-drop to reorder shortcuts directly on the dashboard.

---

### Layout Mode B: Workspace Boards Grid
A full-board visual layout that organizes bookmarks into contextual cards grouped by Workspace tabs:

```
[ 🌐 Home ]  [ 💼 Work & Dev ]  [ 🚀 Personal ]  [ + New Space ]
-------------------------------------------------------------------------
+-------------------+  +-------------------+  +-------------------+
| 📁 Bookmarks Bar  |  | 📁 AI & Models    |  | 📁 Local Dev Sites|
| [⚡] [G] [🤖] [🐙] |  | [🧠] [🔮] [✨]     |  | [💻] [🎨] [📦]     |
| (12 links)        |  | (8 links)         |  | (5 links)         |
+-------------------+  +-------------------+  +-------------------+
```

- **Features:**
  - Workspace selector tabs on top (`Home`, `Work`, `Personal`).
  - Board cards represent bookmark folders with favicon grids.
  - Clicking any board expands a smooth inline overlay or navigates to the folder.

---

## 4. Settings Customization (`mynetwork://settings#bookmarks`)

A dedicated configuration section inside the macOS Settings Pane:

```
+-------------------------------------------------------------------------+
| Bookmarks & Workspaces Settings                                         |
| Configure shortcut shelves, default folders, and New Tab widgets       |
+-------------------------------------------------------------------------+
| Bookmarks Bar Visibility                                                |
| [ Always Show v ]  (Options: Always Show / Only on New Tab / Hidden)    |
|                                                                         |
| New Tab Bookmark Layout                                                 |
| (o) Spotlight Quick Shortcuts (Circular Favicons)                       |
| ( ) Workspace Boards Grid (Categorized Folders)                         |
| ( ) Minimalist (Search & Clock only)                                    |
|                                                                         |
| Default Bookmark Save Location                                          |
| [ Favorites Bar v ]                                                     |
|                                                                         |
| Open Bookmarks In                                                       |
| (o) Active Tab   ( ) New Foreground Tab   ( ) Background Tab            |
|                                                                         |
| New Tab Widgets Customization                                           |
| [x] Show Quick Shortcuts        [x] Show Daily Focus Tasks              |
| [x] Show Quick Scratchpad       [x] Show Recently Visited Links         |
|                                                                         |
| Data & Migration                                                        |
| [ 📥 Import Bookmarks (HTML) ]    [ 📤 Export Bookmarks Backup (HTML/JSON) ]|
+-------------------------------------------------------------------------+
```

---

## 5. Storage Schemas & Data Contracts

All data is stored locally in JSON format with ACID-safe atomic writes under Electron's `userData` directory.

### `workspaces.json`
```json
[
  {
    "id": "ws_default",
    "name": "General",
    "icon": "globe",
    "color": "#007aff",
    "isDefault": true,
    "createdAt": 1741000000000,
    "activeTabIds": ["tab-1", "tab-2"],
    "pinnedBookmarkIds": ["bm_1", "bm_2"]
  },
  {
    "id": "ws_work",
    "name": "Work & Dev",
    "icon": "code",
    "color": "#10b981",
    "isDefault": false,
    "createdAt": 1741000000000,
    "activeTabIds": ["tab-3"],
    "pinnedBookmarkIds": ["bm_3", "bm_4"]
  }
]
```

### `bookmarks.json`
```json
{
  "version": 1,
  "roots": {
    "bar": {
      "id": "root_bar",
      "title": "Favorites Bar",
      "children": ["bm_1", "fold_dev"]
    },
    "other": {
      "id": "root_other",
      "title": "Other Bookmarks",
      "children": ["bm_2"]
    },
    "readingList": {
      "id": "root_reading",
      "title": "Reading List",
      "children": ["bm_read_1"]
    },
    "trash": {
      "id": "root_trash",
      "title": "Trash",
      "children": []
    }
  },
  "items": {
    "bm_1": {
      "id": "bm_1",
      "type": "bookmark",
      "parentId": "root_bar",
      "workspaceId": "ws_default",
      "title": "OpenRouter: Unified Interface",
      "url": "https://openrouter.ai/",
      "favicon": "https://openrouter.ai/favicon.ico",
      "tags": ["ai", "models", "api"],
      "notes": "Primary API for LLM orchestrations",
      "createdAt": 1741000000000,
      "updatedAt": 1741000000000,
      "visitCount": 38,
      "lastVisitedAt": 1741050000000,
      "isRead": false
    },
    "fold_dev": {
      "id": "fold_dev",
      "type": "folder",
      "parentId": "root_bar",
      "workspaceId": "ws_work",
      "title": "Developer Docs",
      "color": "#f59e0b",
      "children": ["bm_3"],
      "createdAt": 1741000000000
    }
  }
}
```

---

## 6. Bookmark Manager Dashboard (`mynetwork://bookmarks`)

### 2-Pane macOS Finder Layout:
```
+---------------------------------------------------------------------------------------------------+
| [ < ] [ > ] [ R ]  [ (icon) mynetwork://bookmarks ]                               [ * Star ] [ ...]|
+---------------------------------------------------------------------------------------------------+
| ⭐ Favorites: [ OpenRouter ]  [ 📁 Dev Docs v ]  [ 📁 Social Media v ]             [+ Add to Bar] |
+---------------------------------------------------------------------------------------------------+
|  LEFT SIDEBAR (Width: 240px) |  MAIN WORKSPACE & BREADCRUMB PANE (Flexible)                       |
|                              |                                                                    |
|  WORKSPACE SELECTOR          |  Breadcrumbs: All Bookmarks > Developer Docs                       |
|  [ 🌐 General       ] (12)   |  [ 🔍 Search title, url, tags... (Cmd+F) ]  [ + Folder ] [ Grid/List]|
|  [ 💻 Work & Dev    ] (24)   |                                                                    |
|  [ + New Workspace  ]        |  FINDER CARD / TABLE VIEW:                                         |
|                              |  +---------------------------------------------------------------+ |
|  COLLECTIONS                 |  | [Favicon] OpenRouter: Unified Interface    [#ai] [#api] [...] | |
|  ⭐ Favorites Bar       (8)  |  |           https://openrouter.ai/                              | |
|  📚 Reading List        (5)  |  +---------------------------------------------------------------+ |
|  🏷️ All Tags & Labels   (14) |  | [Favicon] Meta for Developers               [#meta] [#dev] [...] | |
|  🗑️ Trash Bin           (2)  |  |           https://developers.facebook.com/apps                | |
|                              |  +---------------------------------------------------------------+ |
|  FOLDER TREE                 |  | [Folder] GitHub Repositories (8 items)                [...]   | |
|  v 📁 Developer Docs         |  +---------------------------------------------------------------+ |
|    - 📄 React Specifications |                                                                    |
|    - 📄 Electron IPC Master  |  BOTTOM STATUS BAR:                                                |
|  > 📁 Financial & Crypto     |  44 Bookmarks • 4 Folders • 0 Broken Links • Synced Locally        |
+------------------------------+--------------------------------------------------------------------+
```

---

## 7. Interactive Quick-Bookmark Modal (`Ctrl + D`)

When a user clicks the Omnibox Star icon or presses <kbd>Ctrl</kbd> + <kbd>D</kbd>:
1. **Interactive macOS Popover** anchors right below the star button with blur glassmorphism.
2. **Auto-Populated Fields:** Title and current page URL.
3. **Folder Selector:** Dropdown of existing folders + "+ New Folder" instant creator.
4. **Tag Input Chips:** Type words and press <kbd>Enter</kbd> or <kbd>,</kbd> to attach searchable tag chips.
5. **Add to Favorites Bar:** Quick toggle checkbox to immediately pin to the top shelf.
6. **Remove Button:** If the URL is already bookmarked, provides 1-click removal.

---

## 8. Advanced Power Tools

1. **Netscape HTML Import & Export:** Seamless migration from Chrome, Safari, Edge, Firefox, and Brave.
2. **Duplicate Detection & Cleaner:** 1-Click duplicate scanner with URL normalization and tag merging.
3. **Dead Link Scanner (404 Checker):** Non-blocking background health check for broken links.
4. **Omnibox Spotlight Jumping:** Typing bookmark titles in the address bar displays instant "Switch to Tab / Open Bookmark" badges.

---

## 9. Implementation Roadmap

- [ ] **Phase 1 (Data Layer):** Build `src/features/bookmarks/bookmark-service.js` & `workspace-service.js`.
- [ ] **Phase 2 (Quick Popover & Omnibox Star):** Connect <kbd>Ctrl</kbd> + <kbd>D</kbd> popup with live state indicators.
- [ ] **Phase 3 (New Tab Quick Shortcuts & Boards):** Add circular shortcut shelf and optional workspace boards to New Tab.
- [ ] **Phase 4 (Settings Customization):** Add Bookmarks & Workspaces preferences in `mynetwork://settings`.
- [ ] **Phase 5 (Top Favorites Bar):** Sub-bar under Omnibox with native popup menus (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd>).
- [ ] **Phase 6 (Full Manager View):** Build `mynetwork://bookmarks` 2-pane Finder dashboard with search, tag filters, and tree explorer.
