# Modules Dependency & Responsibility Specification

This document defines every module in **MyNetwork Browser**, its exact single responsibility, what it is permitted to import, and what it is forbidden to import.

---

## Module Index

### 1. Core (`src/core/`)

#### 1.1 `src/core/tabs/tab-manager.js`
- **Responsibility**: Manages creation, activation, closure, reordering, and state of browser tabs.
- **Allowed Dependencies**: `src/shared/events/event-bus.js`, `src/shared/constants/`
- **Forbidden Dependencies**: `src/ui/*`, `src/platform/*`, DOM APIs (`document`, `window`).

#### 1.2 `src/core/browser/browser-context.js`
- **Responsibility**: Orchestrates active tab context, split-view state, and search engine selection.
- **Allowed Dependencies**: `src/core/tabs/tab-manager.js`, `src/infrastructure/config/search-engines.js`, `src/shared/events/event-bus.js`
- **Forbidden Dependencies**: Direct DOM manipulation.

#### 1.3 `src/core/shortcuts/keybinding-manager.js`
- **Responsibility**: Centralized registration, normalization, matching, and dispatching of global and contextual keyboard shortcuts.
- **Allowed Dependencies**: `src/shared/events/event-bus.js`
- **Forbidden Dependencies**: DOM layout manipulation, UI components (only receives KeyboardEvent).

---

### 2. Engine (`src/engine/`)

#### 2.1 `src/engine/webview/webview-adapter.js`
- **Responsibility**: Encapsulates Electron `<webview>` lifecycle, URL navigation, progress tracking, title/favicon event translation.
- **Allowed Dependencies**: `src/shared/events/event-bus.js`
- **Forbidden Dependencies**: `src/ui/*` (except receiving DOM container references for mounting).

---

### 3. Features (`src/features/`)

#### 3.1 `src/features/scratchpad/scratchpad-service.js`
- **Responsibility**: Managing sticky notes, character counts, and persistence.
- **Allowed Dependencies**: `src/infrastructure/storage/storage-adapter.js`, `src/shared/events/event-bus.js`
- **Forbidden Dependencies**: DOM elements, CSS classes.

#### 3.2 `src/features/tasks/task-service.js`
- **Responsibility**: Daily focus tasks (add, toggle done, delete, calculate progress).
- **Allowed Dependencies**: `src/infrastructure/storage/storage-adapter.js`, `src/shared/events/event-bus.js`
- **Forbidden Dependencies**: DOM elements.

#### 3.3 `src/features/focus-timer/timer-service.js`
- **Responsibility**: Pomodoro and break countdown logic, start/pause/reset states.
- **Allowed Dependencies**: `src/shared/events/event-bus.js`
- **Forbidden Dependencies**: DOM elements.

#### 3.4 `src/features/history/history-service.js`
- **Responsibility**: Chronological visited URLs log, deduplication, capped list.
- **Allowed Dependencies**: `src/infrastructure/storage/storage-adapter.js`, `src/shared/events/event-bus.js`
- **Forbidden Dependencies**: DOM elements.

---

### 4. Infrastructure (`src/infrastructure/`)

#### 4.1 `src/infrastructure/storage/storage-adapter.js`
- **Responsibility**: Safe wrapper around persistence layer (localStorage with fallback/in-memory support).
- **Allowed Dependencies**: `src/shared/logging/logger.js`
- **Forbidden Dependencies**: `src/core/*`, `src/ui/*`, `src/features/*`.

#### 4.2 `src/infrastructure/config/search-engines.js`
- **Responsibility**: Definition of supported search providers (Google, DuckDuckGo, YouTube, GitHub, Wikipedia).
- **Allowed Dependencies**: None.
- **Forbidden Dependencies**: `src/ui/*`, `src/core/*`.

#### 4.3 `src/infrastructure/config/settings-service.js`
- **Responsibility**: Central browser preferences manager (search engine, theme accents, startup behavior, focus timer durations, privacy levels) with live auto-persistence.
- **Allowed Dependencies**: `src/infrastructure/storage/storage-adapter.js`, `src/shared/events/event-bus.js`
- **Forbidden Dependencies**: DOM elements, UI components.

---

### 5. Platform (`src/platform/`)

#### 5.1 `src/platform/electron/main.js`
- **Responsibility**: Main Electron process entry point, BrowserWindow initialization, IPC receivers.
- **Allowed Dependencies**: `electron`, `path`
- **Forbidden Dependencies**: Renderer-only modules, DOM APIs.

#### 5.2 `src/platform/electron/ipc-bridge.js`
- **Responsibility**: Renderer-side typed wrapper for sending IPC commands to the main process.
- **Allowed Dependencies**: `electron.ipcRenderer`
- **Forbidden Dependencies**: UI components.

---

### 6. Shared (`src/shared/`)

#### 6.1 `src/shared/events/event-bus.js`
- **Responsibility**: Decoupled Pub/Sub event emitter used for cross-module communication.
- **Allowed Dependencies**: None.
- **Forbidden Dependencies**: Any module outside `src/shared/`.

#### 6.2 `src/shared/logging/logger.js`
- **Responsibility**: Consistent structured logging across main and renderer processes.
- **Allowed Dependencies**: None.
- **Forbidden Dependencies**: Any domain or UI module.

---

### 7. UI (`src/ui/`)

#### 7.1 `src/ui/shell/index.js`
- **Responsibility**: Renderer process entry point. Binds DOM views to core managers, features, and engine.
- **Allowed Dependencies**: `src/core/*`, `src/features/*`, `src/engine/*`, `src/platform/*`, `src/shared/*`
- **Forbidden Dependencies**: Node filesystem direct operations.
