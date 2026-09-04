// Site Mod System - Built-in UserScript & Custom CSS Injection Engine
const { eventBus } = require('../../shared/events/event-bus');

class SiteModEngine {
  constructor() {
    this.mods = [];
    this.init();
  }

  init() {
    try {
      const saved = localStorage.getItem('site_mods_list');
      if (saved) {
        this.mods = JSON.parse(saved);
      } else {
        // Seed default developer helper mods
        this.mods = [
          {
            id: 'mod_dark_wikipedia',
            domain: 'wikipedia.org',
            matchPattern: '*://*.wikipedia.org/*',
            name: 'Wikipedia Clean Reader',
            enabled: false,
            css: 'body { font-size: 18px !important; line-height: 1.7 !important; max-width: 900px; margin: 0 auto !important; } #mw-navigation { opacity: 0.7; }',
            js: 'console.log("[MyNetwork Mod] Wikipedia reader mode active.");',
            updatedAt: Date.now()
          }
        ];
        this.save();
      }
    } catch (e) {
      this.mods = [];
    }
  }

  save() {
    try {
      localStorage.setItem('site_mods_list', JSON.stringify(this.mods));
      eventBus.emit('sitemods:updated', { mods: this.mods });
    } catch (e) {}
  }

  getAllMods() {
    return [...this.mods];
  }

  getMod(id) {
    return this.mods.find(m => m.id === id);
  }

  getModsForUrl(url) {
    if (!url) return [];
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      
      return this.mods.filter(mod => {
        if (!mod.enabled) return false;
        if (mod.domain && hostname.includes(mod.domain.toLowerCase())) return true;
        if (mod.matchPattern) {
          const regexPattern = new RegExp('^' + mod.matchPattern.replace(/\*/g, '.*') + '$', 'i');
          return regexPattern.test(url);
        }
        return false;
      });
    } catch (e) {
      return [];
    }
  }

  createMod({ domain, matchPattern = '', name, css = '', js = '', enabled = true }) {
    const mod = {
      id: 'mod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      domain: (domain || '').trim(),
      matchPattern: (matchPattern || '').trim(),
      name: name || domain || 'Custom Site Mod',
      enabled: !!enabled,
      css: css || '',
      js: js || '',
      updatedAt: Date.now()
    };
    this.mods.push(mod);
    this.save();
    return mod;
  }

  updateMod(id, updates) {
    const mod = this.getMod(id);
    if (!mod) return null;
    Object.assign(mod, updates, { updatedAt: Date.now() });
    this.save();
    return mod;
  }

  deleteMod(id) {
    const index = this.mods.findIndex(m => m.id === id);
    if (index === -1) return false;
    this.mods.splice(index, 1);
    this.save();
    return true;
  }

  toggleMod(id) {
    const mod = this.getMod(id);
    if (!mod) return false;
    mod.enabled = !mod.enabled;
    this.save();
    return mod.enabled;
  }

  /**
   * Applies all active mods to a webview DOM element
   */
  applyModsToWebview(webview, url) {
    if (!webview || !url) return;
    const applicableMods = this.getModsForUrl(url);

    applicableMods.forEach(mod => {
      if (mod.css) {
        try {
          webview.insertCSS(mod.css);
        } catch (e) {}
      }
      if (mod.js) {
        try {
          webview.executeJavaScript(mod.js);
        } catch (e) {}
      }
    });
  }
}

const siteModEngine = new SiteModEngine();

module.exports = { SiteModEngine, siteModEngine };
