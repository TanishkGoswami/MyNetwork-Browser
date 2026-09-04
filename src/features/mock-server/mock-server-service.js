// Developer API Mock Server & Payload Interceptor Service
const { eventBus } = require('../../shared/events/event-bus');

class MockServerService {
  constructor() {
    this.isEnabled = false;
    this.rules = [];
    this.requestLogs = [];

    this.init();
  }

  init() {
    this.loadState();
  }

  loadState() {
    try {
      const savedEnabled = localStorage.getItem('mock_server_enabled');
      this.isEnabled = savedEnabled === 'true';

      const savedRules = localStorage.getItem('mock_server_rules');
      if (savedRules) {
        this.rules = JSON.parse(savedRules);
      } else {
        // Default demo rules
        this.rules = [
          {
            id: 'rule_demo_1',
            name: 'Mock User Profile API',
            method: 'GET',
            urlPattern: '/api/v1/user',
            statusCode: 200,
            delay: 350,
            responseBody: JSON.stringify({ id: 42, name: 'Alex Developer', role: 'Full Stack Engineer', status: 'online' }, null, 2),
            enabled: true
          },
          {
            id: 'rule_demo_2',
            name: 'Simulate 500 Server Error',
            method: 'POST',
            urlPattern: '/api/v1/checkout',
            statusCode: 500,
            delay: 500,
            responseBody: JSON.stringify({ error: 'Internal Server Error', code: 'ERR_PAYMENT_GATEWAY_DOWN' }, null, 2),
            enabled: false
          }
        ];
        this.saveState();
      }
    } catch (e) {
      console.warn('[MockServerService] Load error:', e);
    }
  }

  saveState() {
    try {
      localStorage.setItem('mock_server_enabled', this.isEnabled ? 'true' : 'false');
      localStorage.setItem('mock_server_rules', JSON.stringify(this.rules));
      eventBus.emit('mock-server:rules-updated', { isEnabled: this.isEnabled, rules: this.rules });
    } catch (e) {}
  }

  toggleMaster(enabled = null) {
    this.isEnabled = enabled !== null ? enabled : !this.isEnabled;
    this.saveState();
    return this.isEnabled;
  }

  addRule(rule) {
    const newRule = {
      id: 'rule_' + Date.now(),
      name: rule.name || 'Untitled Rule',
      method: (rule.method || 'GET').toUpperCase(),
      urlPattern: rule.urlPattern || '/api/',
      statusCode: parseInt(rule.statusCode, 10) || 200,
      delay: parseInt(rule.delay, 10) || 0,
      responseBody: rule.responseBody || '{"success": true}',
      enabled: rule.enabled !== undefined ? rule.enabled : true
    };
    this.rules.unshift(newRule);
    this.saveState();
    return newRule;
  }

  updateRule(ruleId, updates) {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules[index] = { ...this.rules[index], ...updates };
      this.saveState();
      return this.rules[index];
    }
    return null;
  }

  deleteRule(ruleId) {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this.saveState();
  }

  toggleRule(ruleId) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = !rule.enabled;
      this.saveState();
      return rule.enabled;
    }
    return false;
  }

  findMatchingRule(url, method = 'GET') {
    if (!this.isEnabled || !url) return null;
    const reqMethod = (method || 'GET').toUpperCase();

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (rule.method !== 'ALL' && rule.method !== reqMethod) continue;

      let isMatch = false;
      try {
        if (rule.urlPattern.startsWith('/') && rule.urlPattern.endsWith('/')) {
          const regex = new RegExp(rule.urlPattern.slice(1, -1), 'i');
          isMatch = regex.test(url);
        } else {
          isMatch = url.toLowerCase().includes(rule.urlPattern.toLowerCase());
        }
      } catch (e) {
        isMatch = url.toLowerCase().includes(rule.urlPattern.toLowerCase());
      }

      if (isMatch) {
        this.logRequest(url, reqMethod, rule);
        return rule;
      }
    }
    return null;
  }

  logRequest(url, method, matchedRule) {
    const log = {
      id: 'log_' + Date.now(),
      url,
      method,
      ruleName: matchedRule.name,
      statusCode: matchedRule.statusCode,
      timestamp: new Date().toLocaleTimeString()
    };
    this.requestLogs.unshift(log);
    if (this.requestLogs.length > 50) this.requestLogs.pop();
    eventBus.emit('mock-server:request-intercepted', log);
  }

  clearLogs() {
    this.requestLogs = [];
    eventBus.emit('mock-server:logs-cleared');
  }

  getRulesForPreload() {
    return {
      isEnabled: this.isEnabled,
      rules: this.rules.filter(r => r.enabled)
    };
  }
}

const mockServerService = new MockServerService();

module.exports = { MockServerService, mockServerService };
