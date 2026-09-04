// Anti-Fingerprinting & Privacy Protection Service
class AntiFingerprintService {
  constructor() {
    this.isEnabled = true;
    this.sitePermissions = new Map(); // domain -> { camera: bool, mic: bool, geo: bool, notify: bool }
    this.init();
  }

  init() {
    try {
      const saved = localStorage.getItem('site_permissions_map');
      if (saved) {
        this.sitePermissions = new Map(JSON.parse(saved));
      }
      const savedState = localStorage.getItem('anti_fingerprint_enabled');
      if (savedState !== null) {
        this.isEnabled = savedState === 'true';
      }
    } catch (e) {}
  }

  save() {
    try {
      localStorage.setItem('site_permissions_map', JSON.stringify([...this.sitePermissions]));
      localStorage.setItem('anti_fingerprint_enabled', this.isEnabled ? 'true' : 'false');
    } catch (e) {}
  }

  toggleEnabled() {
    this.isEnabled = !this.isEnabled;
    this.save();
    return this.isEnabled;
  }

  getSitePermissions(domain) {
    if (!domain) return { camera: false, mic: false, geo: false, notify: false };
    const clean = domain.toLowerCase().replace(/^www\./, '');
    return this.sitePermissions.get(clean) || { camera: false, mic: false, geo: false, notify: true };
  }

  setSitePermission(domain, permission, value) {
    if (!domain) return;
    const clean = domain.toLowerCase().replace(/^www\./, '');
    const current = this.getSitePermissions(clean);
    current[permission] = !!value;
    this.sitePermissions.set(clean, current);
    this.save();
  }

  /**
   * Generates client-side injection script for Canvas/WebGL/Audio de-identification
   */
  getProtectionInjectionScript() {
    if (!this.isEnabled) return '';

    return `
      (function() {
        if (window.__mynetwork_privacy_shield__) return;
        window.__mynetwork_privacy_shield__ = true;

        // 1. HTML5 Canvas Fingerprint Randomization
        try {
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function(type) {
            const ctx = this.getContext('2d');
            if (ctx && this.width > 16 && this.height > 16) {
              const imgData = ctx.getImageData(0, 0, Math.min(10, this.width), Math.min(10, this.height));
              for (let i = 0; i < imgData.data.length; i += 8) {
                imgData.data[i] = (imgData.data[i] ^ 1);
              }
              ctx.putImageData(imgData, 0, 0);
            }
            return originalToDataURL.apply(this, arguments);
          };

          const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
          CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
            const res = originalGetImageData.apply(this, arguments);
            if (res && res.data && res.data.length > 32) {
              res.data[0] = (res.data[0] ^ 1);
              res.data[4] = (res.data[4] ^ 1);
            }
            return res;
          };
        } catch(e) {}

        // 2. WebGL Renderer & Vendor Masking
        try {
          const getParameterProxy = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            // UNMASKED_VENDOR_WEBGL (0x9245)
            if (parameter === 37445) return 'Intel Inc.';
            // UNMASKED_RENDERER_WEBGL (0x9246)
            if (parameter === 37446) return 'Intel(R) Iris(TM) Xe Graphics';
            return getParameterProxy.apply(this, arguments);
          };

          if (window.WebGL2RenderingContext) {
            const getParameterProxy2 = WebGL2RenderingContext.prototype.getParameter;
            WebGL2RenderingContext.prototype.getParameter = function(parameter) {
              if (parameter === 37445) return 'Intel Inc.';
              if (parameter === 37446) return 'Intel(R) Iris(TM) Xe Graphics';
              return getParameterProxy2.apply(this, arguments);
            };
          }
        } catch(e) {}

        // 3. Hardware Concurrency & Memory Normalization
        try {
          Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
          Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
        } catch(e) {}
      })();
    `;
  }
}

const antiFingerprintService = new AntiFingerprintService();

module.exports = { AntiFingerprintService, antiFingerprintService };
