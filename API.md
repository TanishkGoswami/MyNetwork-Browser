# API Specification: MyNetwork Browser

## 1. Core Interfaces & APIs

### 1.1 `TabManager` (`src/core/tabs/tab-manager.js`)

```typescript
interface Tab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isPinned: boolean;
  isAudible: boolean;
  isMuted: boolean;
  createdAt: number;
}

class TabManager {
  createTab(url?: string, title?: string): Tab;
  closeTab(tabId: string): void;
  activateTab(tabId: string): void;
  getActiveTab(): Tab | undefined;
  getTabs(): Tab[];
  updateTab(tabId: string, updates: Partial<Tab>): void;
}
```

---

### 1.2 `EventBus` (`src/shared/events/event-bus.js`)

```typescript
class EventBus {
  on(event: string, callback: (data: any) => void): () => void;
  off(event: string, callback: (data: any) => void): void;
  emit(event: string, data?: any): void;
}
```

---

### 1.3 `TaskService` (`src/features/tasks/task-service.js`)

```typescript
interface TaskItem {
  id: number;
  text: string;
  done: boolean;
}

class TaskService {
  getTasks(): TaskItem[];
  addTask(text: string): TaskItem;
  toggleTask(id: number, done?: boolean): void;
  deleteTask(id: number): void;
  getProgress(): { completed: number; total: number };
}
```

---

### 1.4 `TimerService` (`src/features/focus-timer/timer-service.js`)

```typescript
type TimerMode = 'focus' | 'break';

class TimerService {
  start(): void;
  pause(): void;
  toggle(): void;
  reset(): void;
  setMode(mode: TimerMode): void;
  getState(): { mode: TimerMode; remainingSeconds: number; isRunning: boolean };
}
```

---

### 1.5 `HistoryService` (`src/features/history/history-service.js`)

```typescript
interface HistoryEntry {
  title: string;
  url: string;
  time: string;
  timestamp: number;
}

class HistoryService {
  getRecent(limit?: number): HistoryEntry[];
  addRecord(title: string, url: string): void;
  clear(): void;
}
```

---

### 1.6 `IpcBridge` (`src/platform/electron/ipc-bridge.js`)

```typescript
class IpcBridge {
  minimizeWindow(): void;
  toggleMaximizeWindow(): void;
  closeWindow(): void;
}
```
