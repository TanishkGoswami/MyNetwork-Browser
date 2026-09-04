// Ad & Tracker Blocker Engine - High-Performance Network Interceptor
const { eventBus } = require('../../shared/events/event-bus');

class AdBlockerEngine {
  constructor() {
    this.isEnabled = true;
    this.blockedCountTotal = 0;
    this.tabStats = new Map(); // tabId -> count
    this.whitelistedDomains = new Set();
    
    // Core high-frequency tracker & ad blocklists (regex & host matchers)
    this.blockedDomainPatterns = [
      /doubleclick\.net/i,
      /google-analytics\.com/i,
      /googlesyndication\.com/i,
      /googletagservices\.com/i,
      /googletagmanager\.com/i,
      /googleads\.g\.doubleclick\.net/i,
      /pagead2\.googlesyndication\.com/i,
      /adservice\.google\./i,
      /static\.doubleclick\.net/i,
      /youtube\.com\/api\/stats\/ads/i,
      /youtube\.com\/pagead\//i,
      /youtube\.com\/ptracking/i,
      /youtube\.com\/get_midroll_info/i,
      /adnxs\.com/i,
      /amazon-adsystem\.com/i,
      /criteo\.(com|net)/i,
      /scorecardresearch\.com/i,
      /quantserve\.com/i,
      /outbrain\.com/i,
      /taboola\.com/i,
      /moatads\.com/i,
      /adroll\.com/i,
      /rubiconproject\.com/i,
      /facebook\.com\/tr\//i,
      /connect\.facebook\.net\/.*\/fbevents\.js/i,
      /analytics\.twitter\.com/i,
      /ads-twitter\.com/i,
      /hotjar\.com/i,
      /clarity\.ms/i,
      /yandex\.ru\/metrika/i,
      /mixpanel\.com/i,
      /segment\.io/i,
      /popads\.net/i,
      /popcash\.net/i,
      /propellerads\.com/i,
      /zedo\.com/i,
      /adcolony\.com/i,
      /applovin\.com/i,
      /unityads\.unity3d\.com/i,
      /exponential\.com/i,
      /openx\.net/i,
      /pubmatic\.com/i,
      /casalemedia\.com/i,
      /smartadserver\.com/i,
      /advertising\.com/i,
      /bidswitch\.net/i,
      /contextweb\.com/i,
      /infolinks\.com/i,
      /mgid\.com/i,
      /revcontent\.com/i,
      /adblade\.com/i,
      /admob\.com/i
    ];

    this.init();
  }

  getCosmeticAdHidingCss() {
    return `
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
      tp-yt-paper-dialog:has(#feedback.ytd-enforcement-message-view-model) {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
  }

  getYouTubeAdSkipperScript() {
    return `
      (function() {
        if (window.__mynetwork_yt_skipper_installed) return;
        window.__mynetwork_yt_skipper_installed = true;

        function skipYouTubeAds() {
          const video = document.querySelector('video');
          const isAdShowing = document.querySelector('.ad-showing') || document.querySelector('.ad-interrupting');
          
          if (isAdShowing && video) {
            video.muted = true;
            if (isFinite(video.duration) && video.duration > 0) {
              video.currentTime = video.duration;
            }
            video.playbackRate = 16;
          }

          const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-slot button');
          if (skipBtn) {
            skipBtn.click();
          }

          const overlayClose = document.querySelector('.ytp-ad-overlay-close-button');
          if (overlayClose) {
            overlayClose.click();
          }
        }

        setInterval(skipYouTubeAds, 100);
      })();
    `;
  }

  init() {
    this.loadSettings();
  }

  loadSettings() {
    try {
      const savedWhitelist = localStorage.getItem('adblock_whitelist');
      if (savedWhitelist) {
        this.whitelistedDomains = new Set(JSON.parse(savedWhitelist));
      }
      const savedEnabled = localStorage.getItem('adblock_enabled');
      if (savedEnabled !== null) {
        this.isEnabled = savedEnabled === 'true';
      }
    } catch (e) {}
  }

  saveSettings() {
    try {
      localStorage.setItem('adblock_whitelist', JSON.stringify([...this.whitelistedDomains]));
      localStorage.setItem('adblock_enabled', this.isEnabled ? 'true' : 'false');
    } catch (e) {}
  }

  toggleEnabled() {
    this.isEnabled = !this.isEnabled;
    this.saveSettings();
    eventBus.emit('adblock:state-changed', { isEnabled: this.isEnabled });
    return this.isEnabled;
  }

  toggleWhitelist(domain) {
    if (!domain) return false;
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    if (this.whitelistedDomains.has(cleanDomain)) {
      this.whitelistedDomains.delete(cleanDomain);
    } else {
      this.whitelistedDomains.add(cleanDomain);
    }
    this.saveSettings();
    eventBus.emit('adblock:whitelist-changed', { whitelistedDomains: [...this.whitelistedDomains] });
    return this.isWhitelisted(cleanDomain);
  }

  isWhitelisted(domain) {
    if (!domain) return false;
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
    return this.whitelistedDomains.has(cleanDomain);
  }

  shouldBlockRequest(url, mainPageUrl = '', tabId = null) {
    if (!this.isEnabled || !url) return false;

    // Check if main page domain is whitelisted
    if (mainPageUrl) {
      try {
        const parsed = new URL(mainPageUrl);
        if (this.isWhitelisted(parsed.hostname)) return false;
      } catch (e) {}
    }

    // Evaluate against block patterns
    for (const pattern of this.blockedDomainPatterns) {
      if (pattern.test(url)) {
        this.recordBlocked(tabId, url);
        return true;
      }
    }

    return false;
  }

  recordBlocked(tabId, url) {
    this.blockedCountTotal++;
    if (tabId) {
      const current = this.tabStats.get(tabId) || 0;
      this.tabStats.set(tabId, current + 1);
      eventBus.emit('adblock:request-blocked', { tabId, url, count: current + 1, total: this.blockedCountTotal });
    }
  }

  getBlockedCountForTab(tabId) {
    return this.tabStats.get(tabId) || 0;
  }

  resetTabStats(tabId) {
    if (tabId) this.tabStats.delete(tabId);
  }
}

const adBlockerEngine = new AdBlockerEngine();

module.exports = { AdBlockerEngine, adBlockerEngine };
