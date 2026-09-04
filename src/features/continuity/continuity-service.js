// Browser-to-Phone Continuity Service
class ContinuityService {
  constructor() {}

  /**
   * Generates a QR Code image URL using quick public chart SVG generator or client canvas fallback
   */
  getQrCodeUrl(url) {
    if (!url) return '';
    const encoded = encodeURIComponent(url);
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}&color=0f172a&bgcolor=ffffff&margin=1`;
  }

  generateContinuityPayload(tab) {
    if (!tab) return null;
    return {
      url: tab.url,
      title: tab.title,
      timestamp: Date.now(),
      qrCodeUrl: this.getQrCodeUrl(tab.url)
    };
  }
}

const continuityService = new ContinuityService();

module.exports = { ContinuityService, continuityService };
