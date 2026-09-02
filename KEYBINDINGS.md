# MyNetwork Browser: Keyboard Shortcuts Reference (Keybindings)

This document catalogs every keyboard shortcut supported in **MyNetwork Browser**. You can test these in real-time or press <kbd>Ctrl</kbd> + <kbd>/</kbd> directly inside the browser to open the interactive in-app cheat sheet.

---

## 1. Tab & Window Management

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>T</kbd> | **New Tab** | Opens a new blank dashboard tab. |
| <kbd>Ctrl</kbd> + <kbd>W</kbd> | **Close Tab** | Closes the currently active tab. |
| <kbd>Ctrl</kbd> + <kbd>Tab</kbd> | **Next Tab** | Switches focus to the next open tab on the right/down. |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Tab</kbd> | **Previous Tab** | Switches focus to the previous open tab on the left/up. |
| <kbd>Ctrl</kbd> + <kbd>1</kbd> .. <kbd>8</kbd> | **Switch to Tab 1–8** | Instantly jumps to the corresponding tab by its 1-indexed order. |
| <kbd>Ctrl</kbd> + <kbd>9</kbd> | **Switch to Last Tab** | Instantly jumps to the last tab in the sidebar. |

---

## 2. Navigation & Omnibox

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>L</kbd> / <kbd>Alt</kbd> + <kbd>D</kbd> | **Focus Omnibox** | Highlights the URL/search address bar for instant typing. |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Ctrl</kbd> + <kbd>E</kbd> | **Focus Search** | Focuses the center search engine input in the dashboard. |
| <kbd>Ctrl</kbd> + <kbd>R</kbd> / <kbd>F5</kbd> | **Reload Page** | Reloads the active web page. |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd> | **Hard Reload** | Reloads the active page ignoring local cache. |
| <kbd>Alt</kbd> + <kbd>←</kbd> | **Navigate Back** | Goes back to the previous page in history. |
| <kbd>Alt</kbd> + <kbd>→</kbd> | **Navigate Forward** | Goes forward to the next page in history. |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> | **Open Passwords & Keychain** | Opens the secure password manager vault. |
| <kbd>Escape</kbd> | **Dismiss / Unfocus** | Unfocuses search bars, closes the AI copilot drawer, and closes open modals. |

---

## 3. Workspace, Tools & Productivity

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> / <kbd>Ctrl</kbd> + <kbd>B</kbd> | **Toggle Sidebar** | Collapses/expands the left sidebar into the compact icon rail. |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | **Toggle Split View** | Toggles side-by-side dual webview layout for multitasking. |
| <kbd>Ctrl</kbd> + <kbd>J</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> | **Toggle Gemini AI** | Opens/closes the built-in Gemini copilot sidebar drawer. |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> | **Toggle Focus Timer** | Starts or pauses the 25-minute Pomodoro focus session. |

---

## 4. Help & Overlay

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>/</kbd> / <kbd>F1</kbd> | **Shortcuts Cheat Sheet** | Opens the interactive visual keybindings overlay. |

---

## 5. Architectural Verification & Testing Guide

To verify keybindings in the running app:
1. Open MyNetwork Browser (`npm start`).
2. Press <kbd>Ctrl</kbd> + <kbd>/</kbd> to verify the in-app overlay dialog opens.
3. Press <kbd>Ctrl</kbd> + <kbd>T</kbd> twice to create new tabs, then press <kbd>Ctrl</kbd> + <kbd>1</kbd>, <kbd>Ctrl</kbd> + <kbd>2</kbd>, and <kbd>Ctrl</kbd> + <kbd>3</kbd> to jump between tabs.
4. Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to collapse/expand the sidebar.
5. Press <kbd>Ctrl</kbd> + <kbd>J</kbd> to open/close the Gemini drawer.
