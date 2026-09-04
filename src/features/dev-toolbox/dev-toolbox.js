// Built-in Developer Toolbox Engine
class DevToolboxService {
  constructor() {}

  // 1. REST API Client
  async sendRequest({ method = 'GET', url, headers = {}, body = null }) {
    const startTime = performance.now();
    try {
      const options = {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (['POST', 'PUT', 'PATCH'].includes(options.method) && body) {
        options.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const durationMs = Math.round(performance.now() - startTime);

      let data;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      const responseHeaders = {};
      response.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        durationMs,
        headers: responseHeaders,
        data
      };
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        error: err.message || 'Request Failed',
        durationMs
      };
    }
  }

  // 2. JWT Token Decoder
  decodeJwt(token) {
    if (!token || typeof token !== 'string') {
      return { error: 'Invalid Token' };
    }

    try {
      const parts = token.trim().split('.');
      if (parts.length !== 3) {
        return { error: 'Invalid JWT format (must have 3 parts separated by dots)' };
      }

      const decodeBase64Url = (str) => {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        return JSON.parse(atob(base64));
      };

      const header = decodeBase64Url(parts[0]);
      const payload = decodeBase64Url(parts[1]);

      let isExpired = false;
      let expiresAt = null;
      if (payload.exp) {
        expiresAt = new Date(payload.exp * 1000).toLocaleString();
        isExpired = Date.now() > (payload.exp * 1000);
      }

      return {
        valid: true,
        header,
        payload,
        isExpired,
        expiresAt
      };
    } catch (e) {
      return { error: 'Failed to decode JWT: ' + e.message };
    }
  }

  // 3. Regex Tester
  testRegex(pattern, flags = 'g', testString = '') {
    try {
      const regex = new RegExp(pattern, flags);
      const matches = [];
      let match;

      if (!flags.includes('g')) {
        match = regex.exec(testString);
        if (match) {
          matches.push({
            index: match.index,
            text: match[0],
            groups: match.slice(1)
          });
        }
      } else {
        while ((match = regex.exec(testString)) !== null) {
          matches.push({
            index: match.index,
            text: match[0],
            groups: match.slice(1)
          });
          if (match.index === regex.lastIndex) regex.lastIndex++;
        }
      }

      return {
        valid: true,
        matchCount: matches.length,
        matches
      };
    } catch (e) {
      return {
        valid: false,
        error: e.message
      };
    }
  }

  // 4. JSON Formatter & Validator
  formatJson(rawJson, indent = 2) {
    try {
      const parsed = JSON.parse(rawJson);
      return {
        valid: true,
        formatted: JSON.stringify(parsed, null, indent),
        minified: JSON.stringify(parsed)
      };
    } catch (e) {
      return {
        valid: false,
        error: e.message
      };
    }
  }
}

const devToolboxService = new DevToolboxService();

module.exports = { DevToolboxService, devToolboxService };
