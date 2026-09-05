// Shared Constants & Schemes
module.exports = {
  APP_NAME: 'MyNetwork Browser',
  DEFAULT_NEWTAB_URL: 'mynetwork://newtab',
  LEGACY_NEWTAB_URL: 'zen://newtab',
  SETTINGS_URL: 'mynetwork://settings',
  LEGACY_SETTINGS_URL: 'about:settings',
  HISTORY_URL: 'mynetwork://history',
  LEGACY_HISTORY_URL: 'about:history',
  BOOKMARKS_URL: 'mynetwork://bookmarks',
  LEGACY_BOOKMARKS_URL: 'about:bookmarks',
  PROJECTS_URL: 'mynetwork://projects',
  LEGACY_PROJECTS_URL: 'about:projects',
  AI_ANALYTICS_URL: 'mynetwork://ai-analytics',
  LEGACY_AI_ANALYTICS_URL: 'about:ai-analytics',
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
    SETTINGS_CHANGED: 'settings:changed',
    BOOKMARKS_UPDATED: 'bookmarks:updated',
    WORKSPACE_CHANGED: 'workspace:changed'
  }
};
