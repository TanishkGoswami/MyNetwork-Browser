// Production-Grade Webview Preload Script - AdBlocker, Mock Server Interceptor & Macro Automation
const { ipcRenderer } = require('electron');

(function initPreloadEngine() {
  'use strict';

  // =========================================================================
  // 1. INJECT GLOBAL COSMETIC AD BLOCKING STYLESHEET
  // =========================================================================
  function injectCosmeticStyles() {
    const style = document.createElement('style');
    style.id = 'mynetwork-adblock-cosmetic-styles';
    style.textContent = `
      .adsbygoogle,
      [id^="google_ads_"],
      [id^="div-gpt-ad"],
      .ad-banner,
      .ad-container,
      .ad-wrapper,
      .adsbox,
      .advertisement,
      .advert,
      iframe[src*="doubleclick.net"],
      iframe[src*="googlesyndication.com"],
      iframe[id^="google_ads_iframe"],
      ytd-ad-slot-renderer,
      ytd-promoted-video-renderer,
      ytd-player-legacy-desktop-watch-ads-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-banner-promo-renderer,
      ytd-statement-banner-renderer,
      #masthead-ad,
      .video-ads,
      .ytp-ad-module,
      .ytp-ad-overlay-container,
      .ytp-ad-message-container,
      ytd-rich-item-renderer:has(ytd-ad-slot-renderer),
      ytd-rich-section-renderer:has(ytd-statement-banner-renderer),
      tp-yt-paper-dialog:has(#feedback.ytd-enforcement-message-view-model),
      #player-ads,
      .sparkles-light-cta,
      ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"] {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        height: 0 !important;
        max-height: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    
    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.head && !document.getElementById('mynetwork-adblock-cosmetic-styles')) {
          document.head.appendChild(style);
        }
      });
    }
  }

  // =========================================================================
  // 2. YOUTUBE IN-STREAM VIDEO AD DEFUSER & AUTO-SKIPPER
  // =========================================================================
  function defuseYouTubeAds() {
    if (!location.hostname.includes('youtube.com')) return;

    function cleanPlayerResponse(jsonObj) {
      if (!jsonObj || typeof jsonObj !== 'object') return jsonObj;
      try {
        if (jsonObj.adPlacements) delete jsonObj.adPlacements;
        if (jsonObj.playerAds) delete jsonObj.playerAds;
        if (jsonObj.adSlots) delete jsonObj.adSlots;
        if (jsonObj.adBreakHeartbeatParams) delete jsonObj.adBreakHeartbeatParams;
        if (jsonObj.auxiliaryUi && jsonObj.auxiliaryUi.messageRenderers) {
          delete jsonObj.auxiliaryUi.messageRenderers;
        }
        if (jsonObj.playbackTracking) {
          delete jsonObj.playbackTracking.ptrackingUrl;
          delete jsonObj.playbackTracking.qoeUrl;
          delete jsonObj.playbackTracking.setAwesomeUrl;
          delete jsonObj.playbackTracking.atrUrl;
        }
        ipcRenderer.sendToHost('ad-blocked-event', { type: 'youtube-json-defused' });
      } catch (e) {}
      return jsonObj;
    }

    let rawPlayerResponse = window.ytInitialPlayerResponse;
    try {
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        get() { return rawPlayerResponse; },
        set(val) { rawPlayerResponse = cleanPlayerResponse(val); },
        configurable: true,
        enumerable: true
      });
    } catch (e) {}

    if (rawPlayerResponse) {
      rawPlayerResponse = cleanPlayerResponse(rawPlayerResponse);
    }

    // Video ad fast-forward & skip
    let lastBlockedTime = 0;
    function processYouTubeAdSkipping() {
      const video = document.querySelector('video');
      const adShowing = document.querySelector('.ad-showing') || 
                        document.querySelector('.ad-interrupting') ||
                        document.querySelector('.ytp-ad-player-overlay') ||
                        document.querySelector('.ytp-ad-showing');

      if (adShowing && video) {
        video.muted = true;
        if (isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration;
        } else {
          video.currentTime = 99999;
        }
        video.playbackRate = 16;

        const now = Date.now();
        if (now - lastBlockedTime > 2000) {
          lastBlockedTime = now;
          ipcRenderer.sendToHost('ad-blocked-event', { type: 'youtube-video-ad-skipped' });
        }
      }

      const skipButtons = document.querySelectorAll(`
        .ytp-ad-skip-button,
        .ytp-ad-skip-button-modern,
        .ytp-skip-ad-button,
        .ytp-ad-skip-button-slot button,
        button.ytp-ad-skip-button-text,
        .ytp-ad-overlay-close-button
      `);

      skipButtons.forEach(btn => {
        try { btn.click(); } catch (e) {}
      });
    }

    setInterval(processYouTubeAdSkipping, 50);

    const observer = new MutationObserver(() => {
      processYouTubeAdSkipping();
    });

    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'src']
    });
  }

  // =========================================================================
  // 3. API MOCK SERVER & NETWORK INTERCEPTOR (Fetch & XHR Interceptor)
  // =========================================================================
  function initMockServerInterceptor() {
    function getMatchingMockRule(url, method = 'GET') {
      try {
        const enabled = localStorage.getItem('mock_server_enabled') === 'true';
        if (!enabled) return null;
        const rawRules = localStorage.getItem('mock_server_rules');
        if (!rawRules) return null;
        const rules = JSON.parse(rawRules);
        const reqMethod = (method || 'GET').toUpperCase();

        for (const rule of rules) {
          if (!rule.enabled) continue;
          if (rule.method !== 'ALL' && rule.method !== reqMethod) continue;
          if (url.includes(rule.urlPattern)) return rule;
        }
      } catch (e) {}
      return null;
    }

    // Intercept window.fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = args[0] ? (typeof args[0] === 'string' ? args[0] : args[0].url) : '';
      const method = (args[1] && args[1].method) || 'GET';

      const matchedRule = getMatchingMockRule(url, method);
      if (matchedRule) {
        console.log(`[MockServer] Intercepted ${method} ${url} -> Mocking ${matchedRule.statusCode}`);
        if (matchedRule.delay) {
          await new Promise(r => setTimeout(r, matchedRule.delay));
        }
        return new Response(matchedRule.responseBody || '{}', {
          status: matchedRule.statusCode || 200,
          statusText: 'Mock Server OK',
          headers: {
            'Content-Type': 'application/json',
            'X-Mocked-By': 'MyNetwork-Browser'
          }
        });
      }

      // If YouTube video data, clean player ads
      if (url && typeof url === 'string' && url.includes('/youtubei/v1/player')) {
        try {
          const response = await originalFetch.apply(this, args);
          const clone = response.clone();
          const json = await clone.json();
          if (json.adPlacements) delete json.adPlacements;
          if (json.playerAds) delete json.playerAds;
          return new Response(JSON.stringify(json), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        } catch (e) {}
      }

      return originalFetch.apply(this, args);
    };
  }

  // =========================================================================
  // 4. BROWSER AUTOMATION & MACRO ACTION CAPTURE
  // =========================================================================
  function initMacroActionCapture() {
    function getUniqueSelector(el) {
      if (!el || el === document.body || el === document.documentElement) return '';
      if (el.id) return `#${el.id}`;
      if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
      if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
      if (el.getAttribute('aria-label')) return `[aria-label="${el.getAttribute('aria-label')}"]`;
      if (el.className && typeof el.className === 'string') {
        const firstClass = el.className.trim().split(/\s+/)[0];
        if (firstClass && !firstClass.startsWith('ng-') && !firstClass.includes(':')) {
          return `${el.tagName.toLowerCase()}.${firstClass}`;
        }
      }
      return el.tagName.toLowerCase();
    }

    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const selector = getUniqueSelector(target);
      if (selector) {
        ipcRenderer.sendToHost('macro-action-captured', {
          type: 'click',
          selector,
          tagName: target.tagName,
          text: (target.textContent || '').trim().substring(0, 30)
        });
      }
    }, true);

    document.addEventListener('change', (e) => {
      const target = e.target;
      if (!target) return;
      const selector = getUniqueSelector(target);
      if (selector && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        ipcRenderer.sendToHost('macro-action-captured', {
          type: 'type',
          selector,
          value: target.value
        });
      }
    }, true);
  }

  // =========================================================================
  // 5. AUTO-DETECT FORM CREDENTIAL OBSERVER
  // =========================================================================
  function initCredentialObserver() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form || !form.elements) return;

      let username = '';
      let password = '';

      for (let i = 0; i < form.elements.length; i++) {
        const el = form.elements[i];
        if (el.type === 'password' && el.value) {
          password = el.value;
        } else if ((el.type === 'text' || el.type === 'email') && el.value && !username) {
          username = el.value;
        }
      }

      if (password) {
        console.log('__MYNETWORK_CRED_SUBMIT__:' + JSON.stringify({ username, password }));
      }
    }, true);
  }

  // Initialize all subsystems
  injectCosmeticStyles();
  defuseYouTubeAds();
  initMockServerInterceptor();
  initMacroActionCapture();
  initCredentialObserver();

})();
