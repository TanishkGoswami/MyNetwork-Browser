# Architecture Audit: MyNetwork Browser

## 1. Executive Summary
This document provides a comprehensive audit of the initial architecture of the **MyNetwork Browser** project prior to restructuring, identifying architectural debt, structural coupling, and providing the transition roadmap to a clean modular architecture.

---

## 2. Current State Assessment

### 2.1 File Distribution & Responsibilities
| File | Size | Current Responsibilities | Architectural Issues |
| :--- | :--- | :--- | :--- |
| `main.js` | ~1.5 KB | Electron main process, window creation, IPC handlers | Direct coupling between window config and process lifecycle. |
| `renderer.js` | ~32 KB | Tab management, webview events, navigation, UI rendering, local storage, timer, tasks, scratchpad, AI mock chat, IPC calls | **God Object / Monolithic Class**: Mixes UI rendering, state management, engine interactions, business logic, and storage. |
| `index.html` | ~22 KB | DOM markup, New Tab widgets, Sidebar, Omnibox, AI drawer | UI layout tightly tied to monolithic renderer script selectors. |
| `styles.css` | ~22.5 KB | CSS tokens, layouts, widgets, animations | Monolithic styling file lacking modular separation. |
| `main.py` | ~7.4 KB | Legacy PyQt prototype | Standalone legacy prototype; separated from active Electron architecture. |

---

## 3. Key Architectural Violations Identified

1. **Monolithic Renderer (`renderer.js`)**:
   - Tab lifecycle, webview engine management, DOM manipulation, task storage, pomodoro timer state, and AI chat handlers are all contained within a single `MyNetworkBrowser` class.
2. **Missing Separation of Concerns**:
   - UI views directly invoke `localStorage` and IPC without going through infrastructure/storage abstraction layers.
3. **Implicit Dependencies**:
   - Features depend directly on specific DOM IDs rather than receiving data via state/event interfaces.
4. **Engine Coupling**:
   - Webview element creation and events are interleaved directly inside tab state management.

---

## 4. Remediation Plan

1. **Establish Layered Directory Tree under `src/`**:
   - `core/`: Browser tab lifecycle, window state, navigation state, app lifecycle.
   - `engine/`: Electron webview abstraction and isolation.
   - `features/`: Isolated feature modules (history, tasks, scratchpad, timer).
   - `ui/`: Shell layout, tab bar, omnibox, widgets, and styles.
   - `platform/`: IPC bridge, window operations, OS integrations.
   - `infrastructure/`: Storage adapters, configuration management.
   - `shared/`: Event bus, constants, error handling, logging.
2. **Preserve Functionality**:
   - Retain 100% of working features (tabs, light-mode dashboard, engine switcher, split-view, AI drawer) while decoupling their modules.
3. **No Unnecessary Abstractions or Empty Folders**:
   - Create only actively utilized and architecturally required directories.
