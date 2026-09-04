// Browser Automation & Macro Recorder Service
const { eventBus } = require('../../shared/events/event-bus');

class MacroRecorderService {
  constructor() {
    this.isRecording = false;
    this.activeRecordingTabId = null;
    this.recordedActions = [];
    this.savedMacros = [];
    this.isPlaying = false;
    this.recordingStartTime = null;

    this.init();
  }

  init() {
    this.loadState();
  }

  loadState() {
    try {
      const raw = localStorage.getItem('browser_automation_macros');
      if (raw) {
        this.savedMacros = JSON.parse(raw);
      } else {
        // Sample starter macro
        this.savedMacros = [
          {
            id: 'macro_demo_1',
            name: 'Quick Search & Tab Navigation',
            description: 'Automates typing search query and opening first result',
            workspaceId: 'ws_default',
            actions: [
              { type: 'type', selector: 'input[name="q"]', value: 'MyNetwork Browser GitHub', delay: 400 },
              { type: 'wait', duration: 600 },
              { type: 'click', selector: 'input[type="submit"], button[type="submit"]', delay: 300 }
            ],
            createdAt: new Date().toISOString()
          }
        ];
        this.saveState();
      }
    } catch (e) {
      console.warn('[MacroRecorderService] Load error:', e);
    }
  }

  saveState() {
    try {
      localStorage.setItem('browser_automation_macros', JSON.stringify(this.savedMacros));
      eventBus.emit('macro:list-updated', this.savedMacros);
    } catch (e) {}
  }

  startRecording(tabId) {
    this.isRecording = true;
    this.activeRecordingTabId = tabId;
    this.recordedActions = [];
    this.recordingStartTime = Date.now();
    eventBus.emit('macro:recording-started', { tabId, startTime: this.recordingStartTime });
  }

  addAction(action) {
    if (!this.isRecording) return;
    const now = Date.now();
    const actionWithTime = {
      ...action,
      timestamp: now - this.recordingStartTime
    };
    this.recordedActions.push(actionWithTime);
    eventBus.emit('macro:action-recorded', { action: actionWithTime, count: this.recordedActions.length });
  }

  stopRecording() {
    this.isRecording = false;
    const actions = [...this.recordedActions];
    eventBus.emit('macro:recording-stopped', { actions, count: actions.length });
    return actions;
  }

  saveMacro(name, description = '', workspaceId = 'ws_default', actions = null) {
    const macro = {
      id: 'macro_' + Date.now(),
      name: name || 'Recorded Macro ' + new Date().toLocaleTimeString(),
      description: description || '',
      workspaceId: workspaceId || 'ws_default',
      actions: actions || [...this.recordedActions],
      createdAt: new Date().toISOString()
    };
    this.savedMacros.unshift(macro);
    this.saveState();
    return macro;
  }

  deleteMacro(macroId) {
    this.savedMacros = this.savedMacros.filter(m => m.id !== macroId);
    this.saveState();
  }

  getMacroScriptForInjection(macro) {
    return `
      (async function runAutomationMacro() {
        const actions = ${JSON.stringify(macro.actions)};
        
        function sleep(ms) {
          return new Promise(resolve => setTimeout(resolve, ms));
        }

        function highlightElement(el) {
          if (!el) return;
          const origOutline = el.style.outline;
          const origTransition = el.style.transition;
          el.style.transition = 'all 0.2s ease';
          el.style.outline = '3px solid #007aff';
          setTimeout(() => {
            el.style.outline = origOutline;
            el.style.transition = origTransition;
          }, 600);
        }

        console.log('[MacroRunner] Executing macro: "${macro.name}" (' + actions.length + ' steps)');

        for (let i = 0; i < actions.length; i++) {
          const act = actions[i];
          if (act.delay) await sleep(act.delay);

          try {
            if (act.type === 'click') {
              const target = document.querySelector(act.selector);
              if (target) {
                highlightElement(target);
                target.focus();
                target.click();
              }
            } else if (act.type === 'type') {
              const target = document.querySelector(act.selector);
              if (target) {
                highlightElement(target);
                target.focus();
                target.value = act.value;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
              }
            } else if (act.type === 'wait') {
              await sleep(act.duration || 500);
            } else if (act.type === 'scroll') {
              window.scrollBy({ top: act.y || 200, left: act.x || 0, behavior: 'smooth' });
            }
          } catch (err) {
            console.warn('[MacroRunner] Step ' + i + ' failed:', err);
          }
          await sleep(250);
        }
        console.log('[MacroRunner] Macro execution finished.');
      })();
    `;
  }
}

const macroRecorderService = new MacroRecorderService();

module.exports = { MacroRecorderService, macroRecorderService };
