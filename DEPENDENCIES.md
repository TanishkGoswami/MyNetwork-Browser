# Dependencies Specification

## 1. Runtime & Development Dependencies

### Current Dependencies
| Package | Version Range | Environment | Purpose |
| :--- | :--- | :--- | :--- |
| `electron` | `^34.0.0` | `devDependencies` | Cross-platform desktop runtime environment providing Chromium webview and Node.js execution. |

---

## 2. Dependency Invariants

1. **Zero Unnecessary Frameworks**: No heavy frontend frameworks (React, Vue, Angular) are required for the shell; Vanilla ES Modules and native Web Components provide high performance and zero bundle overhead.
2. **Standard Web Standards**: Utilize standard Web APIs (`CustomEvent`, `localStorage`, `DOMParser`, `MutationObserver`).
3. **No Circular Imports**: Module imports strictly follow a top-down hierarchy (UI -> Features/Core -> Engine/Platform -> Infrastructure -> Shared).
4. **Isolated Node Access**: Renderer access to Node.js is abstracted via `src/platform/` to allow transitioning to strict context isolation and preload scripts when required.
