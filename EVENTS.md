# Events Specification: MyNetwork Browser

## 1. System Events Catalog

All system events are broadcast via `EventBus` (`src/shared/events/event-bus.js`).

### Tab Lifecycle Events
| Event Name | Payload | Trigger |
| :--- | :--- | :--- |
| `tab:created` | `{ tab: Tab }` | When a new tab is created |
| `tab:activated` | `{ tabId: string, tab: Tab }` | When a tab is switched to active |
| `tab:closed` | `{ tabId: string }` | When a tab is closed |
| `tab:updated` | `{ tabId: string, updates: Partial<Tab> }` | When tab title, url, favicon or loading state changes |

### Navigation & Engine Events
| Event Name | Payload | Trigger |
| :--- | :--- | :--- |
| `navigation:start` | `{ tabId: string, url: string }` | When webview begins loading a URL |
| `navigation:finish` | `{ tabId: string, url: string }` | When webview completes page load |
| `navigation:progress` | `{ percentage: number }` | When load progress updates (0-100) |
| `navigation:fail` | `{ tabId: string, errorCode: number, desc: string }` | When page loading encounters an error |

### Feature Events
| Event Name | Payload | Trigger |
| :--- | :--- | :--- |
| `tasks:changed` | `{ tasks: TaskItem[], progress: { completed: number, total: number } }` | When tasks are added, completed, or deleted |
| `scratchpad:changed`| `{ text: string, length: number }` | When notes content is edited |
| `timer:tick` | `{ mode: string, remainingSeconds: number, formatted: string }` | Every second while timer is running |
| `timer:completed` | `{ mode: string }` | When focus or break session hits 00:00 |
| `history:updated` | `{ entries: HistoryEntry[] }` | When a new URL navigation is logged |

### Window & UI Events
| Event Name | Payload | Trigger |
| :--- | :--- | :--- |
| `ui:sidebar-toggled`| `{ isRail: boolean }` | When user toggles expanded sidebar vs compact rail |
| `ui:splitview-toggled` | `{ isSplit: boolean }` | When user enables/disables split view mode |
| `ui:ai-drawer-toggled` | `{ isOpen: boolean }` | When Gemini AI assistant drawer opens/closes |
