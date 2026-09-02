// TimerService - Focus & Pomodoro session countdown logic
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS } = require('../../shared/constants');

class TimerService {
  constructor() {
    this.mode = 'focus'; // 'focus' (25m) | 'break' (5m)
    this.remainingSeconds = 25 * 60;
    this.timerInterval = null;
  }

  setMode(mode, durationSeconds = null) {
    this.pause();
    this.mode = mode;
    this.remainingSeconds = durationSeconds || (mode === 'focus' ? 25 * 60 : 5 * 60);
    this.emitTick();
  }

  toggle() {
    if (this.timerInterval) {
      this.pause();
    } else {
      this.start();
    }
  }

  start() {
    if (this.timerInterval) return;
    this.timerInterval = setInterval(() => {
      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        this.emitTick();
      } else {
        this.pause();
        eventBus.emit(EVENTS.TIMER_COMPLETED, { mode: this.mode });
      }
    }, 1000);
    this.emitTick();
  }

  pause() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.emitTick();
  }

  reset() {
    this.pause();
    this.remainingSeconds = this.mode === 'focus' ? 25 * 60 : 5 * 60;
    this.emitTick();
  }

  getFormattedTime() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  emitTick() {
    eventBus.emit(EVENTS.TIMER_TICK, {
      mode: this.mode,
      remainingSeconds: this.remainingSeconds,
      formatted: this.getFormattedTime(),
      isRunning: this.timerInterval !== null
    });
  }

  getState() {
    return {
      mode: this.mode,
      remainingSeconds: this.remainingSeconds,
      formatted: this.getFormattedTime(),
      isRunning: this.timerInterval !== null
    };
  }
}

const timerService = new TimerService();

module.exports = { TimerService, timerService };
