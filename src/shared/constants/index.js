// Shared Constants & Schemes
module.exports = {
  APP_NAME: 'MyNetwork Browser',
  DEFAULT_NEWTAB_URL: 'mynetwork://newtab',
  LEGACY_NEWTAB_URL: 'zen://newtab',
  SETTINGS_URL: 'mynetwork://settings',
  LEGACY_SETTINGS_URL: 'about:settings',
  BLANK_URL: 'about:blank',
  
  EVENTS: {
    TAB_CREATED: 'tab:created',
    TAB_ACTIVATED: 'tab:activated',
    TAB_CLOSED: 'tab:closed',
    TAB_UPDATED: 'tab:updated',
    
    NAV_START: 'navigation:start',
    NAV_FINISH: 'navigation:finish',
    NAV_PROGRESS: 'navigation:progress',
    NAV_FAIL: 'navigation:fail',
    
    TASKS_CHANGED: 'tasks:changed',
    SCRATCHPAD_CHANGED: 'scratchpad:changed',
    TIMER_TICK: 'timer:tick',
    TIMER_COMPLETED: 'timer:completed',
    HISTORY_UPDATED: 'history:updated',
    SETTINGS_CHANGED: 'settings:changed'
  }
};
