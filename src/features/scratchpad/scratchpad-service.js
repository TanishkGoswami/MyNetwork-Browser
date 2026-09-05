// ScratchpadService - Sticky notes state & storage
const { storage } = require('../../infrastructure/storage/storage-adapter');
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS } = require('../../shared/constants');

class ScratchpadService {
  constructor() {
    this.storageKey = 'scratchpad';
  }

  getNotes() {
    return storage.get(this.storageKey, '');
  }

  getContent() {
    return this.getNotes();
  }

  saveNotes(text) {
    storage.set(this.storageKey, text);
    eventBus.emit(EVENTS.SCRATCHPAD_CHANGED, { text, length: text.length });
  }

  save(text) {
    this.saveNotes(text);
  }

  clearNotes() {
    storage.remove(this.storageKey);
    eventBus.emit(EVENTS.SCRATCHPAD_CHANGED, { text: '', length: 0 });
  }
}

const scratchpadService = new ScratchpadService();

module.exports = { ScratchpadService, scratchpadService };
