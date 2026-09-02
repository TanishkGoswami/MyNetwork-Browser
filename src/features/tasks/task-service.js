// TaskService - Daily Focus Checklist management
const { storage } = require('../../infrastructure/storage/storage-adapter');
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS } = require('../../shared/constants');

class TaskService {
  constructor() {
    this.storageKey = 'tasks';
    this.tasks = storage.get(this.storageKey, []);
  }

  getTasks() {
    return [...this.tasks];
  }

  addTask(text) {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const task = {
      id: Date.now(),
      text: trimmed,
      done: false
    };

    this.tasks.push(task);
    this.persist();
    return task;
  }

  toggleTask(id, doneState = null) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    task.done = doneState !== null ? doneState : !task.done;
    this.persist();
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.persist();
  }

  getProgress() {
    const completed = this.tasks.filter(t => t.done).length;
    return {
      completed,
      total: this.tasks.length
    };
  }

  persist() {
    storage.set(this.storageKey, this.tasks);
    eventBus.emit(EVENTS.TASKS_CHANGED, {
      tasks: this.getTasks(),
      progress: this.getProgress()
    });
  }
}

const taskService = new TaskService();

module.exports = { TaskService, taskService };
