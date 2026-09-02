// KeybindingManager - Centralized Keyboard Shortcuts Engine
const { eventBus } = require('../../shared/events/event-bus');

class KeybindingManager {
  constructor() {
    this.shortcuts = new Map();
    this.boundKeyHandler = this.handleKeyDown.bind(this);
    this.isListening = false;
  }

  /**
   * Register a shortcut command
   * @param {string} combo - e.g. "ctrl+t", "ctrl+shift+tab", "ctrl+/"
   * @param {Object} options - { id, label, category, handler, isGlobal }
   */
  register(combo, options) {
    const normalizedCombo = this.normalizeCombo(combo);
    this.shortcuts.set(normalizedCombo, {
      combo: normalizedCombo,
      id: options.id || normalizedCombo,
      label: options.label || 'Shortcut',
      category: options.category || 'General',
      handler: options.handler,
      isGlobal: options.isGlobal !== false // default true for browser shortcuts
    });
  }

  /**
   * Unregister a shortcut command
   */
  unregister(combo) {
    const normalizedCombo = this.normalizeCombo(combo);
    this.shortcuts.delete(normalizedCombo);
  }

  /**
   * Start listening for keyboard events
   */
  startListening() {
    if (this.isListening || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.boundKeyHandler);
    this.isListening = true;
  }

  /**
   * Stop listening
   */
  stopListening() {
    if (!this.isListening || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.boundKeyHandler);
    this.isListening = false;
  }

  /**
   * Handle keydown event
   */
  handleKeyDown(event) {
    const activeEl = document.activeElement;
    const isTextInput = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable
    );

    const combo = this.getComboFromEvent(event);
    if (!combo) return;

    const shortcut = this.shortcuts.get(combo);
    if (!shortcut) return;

    // If focus is in a text input and the shortcut is not global, skip (except for Esc or Ctrl shortcuts)
    if (isTextInput && !shortcut.isGlobal) {
      return;
    }

    try {
      event.preventDefault();
      event.stopPropagation();
      shortcut.handler(event);
      eventBus.emit('shortcut:triggered', { combo, id: shortcut.id });
    } catch (err) {
      console.error(`[KeybindingManager] Error executing shortcut ${combo}:`, err);
    }
  }

  /**
   * Normalize shortcut string (e.g. "Ctrl + Shift + T" -> "ctrl+shift+t")
   */
  normalizeCombo(str) {
    return str
      .toLowerCase()
      .split('+')
      .map(part => part.trim())
      .sort((a, b) => {
        const order = { ctrl: 1, cmd: 1, alt: 2, shift: 3 };
        return (order[a] || 99) - (order[b] || 99);
      })
      .join('+');
  }

  /**
   * Extract normalized combo string from KeyboardEvent
   */
  getComboFromEvent(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');

    let key = e.key.toLowerCase();
    
    // Normalize special keys
    if (key === 'control' || key === 'alt' || key === 'shift' || key === 'meta') {
      return null; // pure modifier press
    }
    if (key === 'escape') key = 'escape';
    if (key === 'arrowleft') key = 'arrowleft';
    if (key === 'arrowright') key = 'arrowright';

    parts.push(key);
    return parts.join('+');
  }

  /**
   * Returns list of all registered shortcuts grouped by category
   */
  getRegisteredShortcuts() {
    const list = Array.from(this.shortcuts.values());
    const grouped = {};
    for (const item of list) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
    return grouped;
  }
}

const keybindingManager = new KeybindingManager();
module.exports = { KeybindingManager, keybindingManager };
