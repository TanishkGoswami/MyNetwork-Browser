# MyNetwork Browser — Master Roadmap & Feature Tracker (ROADMAP_TODO.md)

> **Architectural Vision:** High-performance, privacy-first, developer-centric desktop browser built on macOS Sonoma/Sequoia native design principles with isolated project workspaces, multi-profile containers, split-screen multitasking, and smart tab intelligence.

---

## 📊 Feature Status Summary

| Status Badge | Meaning | Feature Count |
|---|---|:---:|
| 🟢 **COMPLETED** | Fully implemented, styled with macOS design, and active | **11** |
| 🟡 **IN PROGRESS / PARTIAL** | Base foundation exists; actively being enhanced | **2** |
| ⏳ **PLANNED (PHASE 2)** | Performance, Tab Intelligence & Content Blocking | **4** |
| ⏳ **PLANNED (PHASE 3)** | Developer Tooling, Site Mods & Anti-Fingerprinting | **3** |
| ⏳ **PLANNED (PHASE 4)** | Smart Downloads, Continuity & Cloud Sync | **2** |

---

## 🧭 Milestone Execution Roadmap

```mermaid
graph TD
    P1["Phase 1: Productivity & Power Nav (COMPLETED ✅)"] --> P2["Phase 2: Performance & Intelligence (NEXT UP ⏳)"]
    P2 --> P3["Phase 3: Dev Tools, Site Mods & Proxies"]
    P3 --> P4["Phase 4: Downloads & Continuity"]

    subgraph P1_Details ["Phase 1 (Completed Features)"]
        F7["7. Multi-Profile Containers ✅"]
        F15["15. Ghost / Disposable Tabs ✅"]
        F16["16. Smart Omnibox + Ctrl+K Hybrid ✅"]
        F10["10. Flexible Multi-Pane Split Screen ✅"]
    end

    subgraph P2_Details ["Phase 2 (Performance & Scale)"]
        F9["9. Tree / Parent-Child Tabs"]
        F12["12. Tab Hibernation & Memory Relief"]
        F17["17. Tab Intelligence & RAM Monitor"]
        F13["13. Ad & Tracker Blocker Engine"]
    end
```

---

## 📋 Comprehensive 20-Feature Tracker

### 🚀 Phase 1: Core Productivity & Power Navigation (🟢 COMPLETED)

- [x] **Feature 7: Multi-Profile Containers**
  - **Status:** 🟢 Completed
  - **Technical Spec:** Separate Electron partitions (`persist:container_<id>`) allowing independent sessions (cookies, cache, localStorage) for Personal, Work, Dev & API, and Client A.
  - **Delivered:** `ContainerService`, tab container badges, context menu container profile switching, dynamic webview partition assignment.

- [x] **Feature 15: Disposable / Ghost Tabs**
  - **Status:** 🟢 Completed
  - **Technical Spec:** Ephemeral in-memory partition (`ghost_<id>`) that self-destructs instantly on tab close without writing cookies/history to disk.
  - **Delivered:** Sidebar Ghost tab button, `Ctrl+Shift+G` shortcut, purple accent styling, and right-click "Reopen in Ghost Tab".

- [x] **Feature 16: Smart Omnibox & Command Palette Hybrid**
  - **Status:** 🟢 Completed
  - **Technical Spec:** Unified Omnibox supporting `@tabs`, `@history`, `@bookmark`, and `>` prefix command intelligence with live Raycast-style dropdown and `Ctrl+K`.
  - **Delivered:** `OmniboxService`, prefix parser, arrow key navigation, command execution dispatchers, and hint chips.

- [x] **Feature 10: Multi-Pane Split Screen Browser**
  - **Status:** 🟢 Completed
  - **Technical Spec:** Dynamic grid layout supporting dual, triple, and quad parallel webviews with active pane focus outline and synchronized controls.
  - **Delivered:** Multi-pane grid CSS, active pane click-to-focus, sidebar toggle button, and command palette integration.

---

### ⚡ Phase 2: Performance, Tab Scale & Ad Blocking

- [ ] **Feature 9: Vertical & Tree Tabs (Parent-Child Nesting)**
  - **Status:** 🟡 Partially Implemented (Vertical sidebar done; Tree hierarchy pending)
  - **Technical Spec:** Links opened in new tabs automatically nest under the parent tab. Foldable sub-branches with drag-and-drop tree reordering.
  - **Tasks:**
    - [ ] Add `parentId` and `depth` properties to `TabManager`.
    - [ ] Collapsible chevron UI in sidebar tab list.
    - [ ] Close subtree / collapse branch actions.

- [ ] **Feature 12: Smart Tab Hibernation (Memory Freeze)**
  - **Status:** ⏳ Planned (Phase 2)
  - **Technical Spec:** Unloads inactive webviews from Chromium memory after configurable idle time (e.g. 30 mins) while preserving title, favicon, scroll position, and tab state. Instantly rehydrates on tab focus.
  - **Tasks:**
    - [ ] Idle timer per tab.
    - [ ] Webview detachment and placeholder canvas rendering.
    - [ ] Seamless rehydration on click.

- [ ] **Feature 17: Tab Intelligence & Health Monitor**
  - **Status:** ⏳ Planned (Phase 2)
  - **Technical Spec:** Automatic analytics detecting duplicate tabs, high RAM consumers (>400MB), and stale tabs. 1-click bulk actions: "Close 8 Duplicates", "Group by Domain", "Hibernate All Inactive".
  - **Tasks:**
    - [ ] Tab memory audit via Chromium `process.getProcessMemoryInfo()`.
    - [ ] Domain grouping algorithm.
    - [ ] Tab Intelligence alert bar / badge.

- [ ] **Feature 13: Strong Built-in Ad & Tracker Blocker Engine**
  - **Status:** ⏳ Planned (Phase 2)
  - **Technical Spec:** Native network request interception using Electron `session.webRequest.onBeforeRequest` with EasyList / Peter Lowe ad & tracker rule lists.
  - **Tasks:**
    - [ ] Fast bloom filter / regex blocker module.
    - [ ] Shield icon in address bar showing blocked trackers count.
    - [ ] Per-site whitelist toggle.

---

### 🛠️ Phase 3: Developer Tools, Site Mods & Security Architecture

- [ ] **Feature 4: Built-in Developer Toolbox**
  - **Status:** 🟡 In Progress (Console inspect integrated; dedicated Dev suite planned)
  - **Technical Spec:** Integrated Quick REST client, JWT decoder, Regex tester, JSON formatter, and live CSS inspector accessible from sidebar or drawer.

- [ ] **Feature 18: Site Mod System (UserScripts & Custom CSS)**
  - **Status:** ⏳ Planned (Phase 3)
  - **Technical Spec:** Tampermonkey/UserStyle-like engine storing custom `.js` and `.css` per domain. Electron executes isolated script injection on DOM ready.
  - **Tasks:**
    - [ ] Site Mod storage schema (domain, match pattern, CSS, JS).
    - [ ] Code editor modal in settings / address bar.
    - [ ] Injection pipeline in `webview-adapter.js`.

- [ ] **Feature 19: Workspace Proxy Manager**
  - **Status:** ⏳ Planned (Phase 3)
  - **Technical Spec:** Dynamic proxy configuration per workspace or container (Direct, SOCKS5, HTTP, Rotating Proxy, Geo-located proxies).
  - **Tasks:**
    - [ ] Electron `session.setProxy()` integration per partition.
    - [ ] Proxy profile CRUD modal.
    - [ ] Workspace-to-Proxy binding.

- [ ] **Feature 14: Advanced Anti-Fingerprinting & Per-Site Permissions**
  - **Status:** ⏳ Planned (Phase 3)
  - **Technical Spec:** Spoofing / de-identification of Canvas, WebGL, AudioContext, User-Agent, Hardware Concurrency, and per-site Camera/Mic/Geo permission toggles.

---

### 📦 Phase 4: Downloads, Continuity & Sync

- [ ] **Feature 20: Smart Download Manager**
  - **Status:** ⏳ Planned (Phase 4)
  - **Technical Spec:** Native macOS download shelf, auto-categorization (Images, Code, Archives, Media), pause/resume support, and download speed throttle.

- [ ] **Feature 1: Browser-to-Phone Continuity**
  - **Status:** ⏳ Planned (Phase 4)
  - **Technical Spec:** QR code instant tab push, local Wi-Fi pairing, and encrypted peer-to-peer workspace tab sharing.

---

## ✅ Currently Completed Features

- [x] **Feature 2: Project Workspaces Engine**
  - Full CRUD (`createWorkspace`, `updateWorkspace`, `deleteWorkspace`, `duplicateWorkspace`).
  - Isolated tab collections per workspace.
  - Dedicated Dev Server URL configuration and 1-click launch.
  - Dedicated macOS Sonoma/Sequoia Project Dashboard (`mynetwork://projects`).
- [x] **Feature 8: Sidebar Workspace Switcher & Context Menu**
  - Fast left-click workspace switching, tab counter badges, and color dot indicators.
- [x] **Feature 3: Smart Tab Management Core**
  - Vertical tab bar, pin/unpin tabs, live favicons, audio mute/unmute indicators, tab close animations.
- [x] **macOS Bookmarks Manager (`mynetwork://bookmarks`)**
  - Full 2-level folder hierarchies, tag filtering, Trash recovery lifecycle, search, batch actions.
- [x] **macOS History Engine (`mynetwork://history`)**
  - Multi-view history (Date Grouped, Domain Grouped, Tree List), search, batch deletion, clear range.
- [x] **macOS Password & Credential Vault (`mynetwork://passwords`)**
  - Encrypted storage, strength scoring, auto-fill credentials, master security.
- [x] **Developer Productivity Suite**
  - Focus Pomodoro Timer, Quick Scratchpad / Note keeper, Task Todo checklist, Ask Gemini AI Assistant drawer.
