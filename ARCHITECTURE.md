# Architecture Specification: MyNetwork Browser

## 1. Architectural Overview

MyNetwork Browser follows a clean layered architecture designed for extreme modularity, predictability, testability, and future extensibility without architectural degradation.

```
                    ┌─────────────────────────┐
                    │   Browser Application   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      UI Layer (Shell)   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Application Layer    │
                    ├────────────┬────────────┤
                    │    Core    │  Features  │
                    └────────────┴────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Browser Abstraction   │
                    ├─────────────────────────┤
                    │      Engine Layer       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   OS / Platform Layer   │
                    └─────────────────────────┘
```

---

## 2. Directory Structure (`src/`)

```
src/
├── core/
│   ├── browser/          # Main browser orchestrator
│   ├── tabs/             # Tab model, tab manager, tab collection
│   ├── navigation/       # Navigation state, history transition rules
│   └── lifecycle/        # App startup, ready, suspend, shutdown
│
├── engine/
│   └── webview/          # Webview controller, engine events, injection
│
├── features/
│   ├── tasks/            # Daily focus task manager
│   ├── scratchpad/       # Sticky notes & quick pad
│   ├── focus-timer/      # Pomodoro focus session controller
│   └── history/          # Chronological browsing history tracker
│
├── ui/
│   ├── shell/            # Main window shell & layout controller
│   ├── components/       # Tabs bar, omnibox, sidebar rail, AI drawer
│   └── styles/           # CSS design tokens & modular stylesheets
│
├── platform/
│   └── electron/         # Main process, window controls, IPC bridges
│
├── infrastructure/
│   ├── storage/          # LocalStorage / future persistent storage adapter
│   └── config/           # Search engines, browser defaults, constants
│
└── shared/
    ├── events/           # Typed Event Emitter & Event Bus
    ├── constants/        # Shared constants & action types
    └── logging/          # Centralized structured logger
```

---

## 3. Core Architectural Invariants & Rules

1. **UI Isolation**: The UI layer does not directly touch node internals, filesystem, or raw storage APIs; it consumes domain features and the platform bridge.
2. **Core Independence**: Core domain models (`Tab`, `TabManager`, `NavigationState`) have zero dependency on UI DOM elements.
3. **Engine Isolation**: The browser engine (`webview` / Chromium) is accessed exclusively through an engine abstraction adapter (`WebviewEngineAdapter`).
4. **Feature Modularity**: Each feature (`tasks`, `scratchpad`, `timer`, `history`) is self-contained with its own model, business rules, and event subscriptions.
5. **Event-Driven Communication**: Modules communicate via a central lightweight `EventBus` (`shared/events/event-bus.js`) rather than direct coupling.
6. **No Global Mutable State**: State is owned by specific managers and exposed via read-only getters and explicit mutating methods.
7. **Future Replaceability**: AI copilot, search providers, and storage engines are accessed through interfaces allowing drop-in upgrades.

---

## 4. Communication & IPC Strategy

- **Main Process (`src/platform/electron/main.js`)**:
  - Handles window creation, native window decorations, min/max/close, and OS lifecycle.
  - Exposes clean IPC channels (`window-minimize`, `window-maximize-toggle`, `window-close`).
- **Renderer Process (`src/ui/shell/index.js`)**:
  - Initializes Core, Features, Engine, and UI components.
  - Subscribes UI components to domain events.

---

## 5. Future Capability Evolution

The folder architecture is designed to expand organically when new advanced capabilities are built:
- `src/features/bookmarks/` — (See [BOOKMARKS_AND_WORKSPACES.md](file:///c:/Users/pc/Documents/GitHub/MyNetwork-Browser/BOOKMARKS_AND_WORKSPACES.md) for full architectural specs)
- `src/features/downloads/`
- `src/ai/` (Gemini API / Local LLM provider adapters)
- `src/automation/` (Workflow scripts and web automation)
- `src/memory/` (Knowledge graph & session memory)
- `src/extensions/` (Chrome extension ecosystem support)
