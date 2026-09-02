// PasswordService - Encrypted Credential Vault, Password Generator, and Security Audit
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { eventBus } = require('../../shared/events/event-bus');

const VAULT_FILE = 'passwords_vault.enc';
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32;

// Built-in device master key derivation for local desktop security
const DEVICE_SECRET = 'MyNetwork-Browser-Secure-Key-v1-@2026';

class PasswordService {
  constructor() {
    this.storageDir = path.join(process.env.APPDATA || process.env.HOME || '.', '.mynetwork_browser');
    this.vaultPath = path.join(this.storageDir, VAULT_FILE);
    this.credentials = [];
    this.isUnlocked = true;
    this.initStorage();
    this.loadVault();
  }

  initStorage() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (e) {
      console.error('[PasswordService] Error creating storage dir:', e);
    }
  }

  deriveKey(salt) {
    return crypto.pbkdf2Sync(DEVICE_SECRET, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  }

  encryptData(plaintext) {
    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const iv = crypto.randomBytes(IV_LENGTH);
      const key = this.deriveKey(salt);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();

      // Format: salt(16) + iv(12) + tag(16) + encrypted
      const combined = Buffer.concat([salt, iv, tag, encrypted]);
      return combined.toString('base64');
    } catch (err) {
      console.error('[PasswordService] Encryption error:', err);
      return null;
    }
  }

  decryptData(cipherBase64) {
    try {
      const combined = Buffer.from(cipherBase64, 'base64');
      if (combined.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) return null;

      const salt = combined.subarray(0, SALT_LENGTH);
      const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
      const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

      const key = this.deriveKey(salt);
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (err) {
      console.error('[PasswordService] Decryption error:', err);
      return null;
    }
  }

  loadVault() {
    try {
      if (fs.existsSync(this.vaultPath)) {
        const cipherText = fs.readFileSync(this.vaultPath, 'utf8');
        const jsonStr = this.decryptData(cipherText);
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            this.credentials = parsed;
            this.pinConfig = null;
          } else if (parsed && typeof parsed === 'object') {
            this.credentials = Array.isArray(parsed.credentials) ? parsed.credentials : [];
            this.pinConfig = parsed.pinConfig || null;
          }
        }
      }
    } catch (e) {
      console.error('[PasswordService] Failed to load vault:', e);
      this.credentials = [];
      this.pinConfig = null;
    }

    this.isUnlocked = !this.hasMasterPin();
  }

  saveVault() {
    try {
      const payload = {
        version: 2,
        credentials: this.credentials,
        pinConfig: this.pinConfig || null,
        lastUpdated: Date.now()
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      const cipherText = this.encryptData(jsonStr);
      if (cipherText) {
        fs.writeFileSync(this.vaultPath, cipherText, 'utf8');
        eventBus.emit('passwords:updated', { count: this.credentials.length });
        return true;
      }
    } catch (e) {
      console.error('[PasswordService] Failed to save vault:', e);
    }
    return false;
  }

  hasMasterPin() {
    return !!(this.pinConfig && this.pinConfig.hash && this.pinConfig.salt);
  }

  isVaultLocked() {
    return this.hasMasterPin() && !this.isUnlocked;
  }

  setMasterPin(newPin) {
    if (!newPin || typeof newPin !== 'string' || newPin.trim().length === 0) return false;
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(newPin.trim(), salt, 100000, 32, 'sha256').toString('hex');
    this.pinConfig = { salt, hash };
    this.isUnlocked = true;
    return this.saveVault();
  }

  removeMasterPin(currentPin) {
    if (!this.hasMasterPin()) return true;
    if (!this.verifyPin(currentPin)) return false;
    this.pinConfig = null;
    this.isUnlocked = true;
    return this.saveVault();
  }

  verifyPin(pin) {
    if (!this.hasMasterPin()) return true;
    if (!pin || typeof pin !== 'string') return false;
    const hash = crypto.pbkdf2Sync(pin.trim(), this.pinConfig.salt, 100000, 32, 'sha256').toString('hex');
    return hash === this.pinConfig.hash;
  }

  unlockVault(pin) {
    if (!this.hasMasterPin()) {
      this.isUnlocked = true;
      return true;
    }
    if (this.verifyPin(pin)) {
      this.isUnlocked = true;
      eventBus.emit('passwords:vault-unlocked');
      return true;
    }
    return false;
  }

  lockVault() {
    if (this.hasMasterPin()) {
      this.isUnlocked = false;
      eventBus.emit('passwords:vault-locked');
    }
  }

  getAll() {
    return [...this.credentials];
  }

  getById(id) {
    return this.credentials.find(c => c.id === id);
  }

  getForDomain(domain) {
    if (!domain) return [];
    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    return this.credentials.filter(c => {
      if (!c.url) return false;
      const cDomain = c.url.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      return cDomain.includes(cleanDomain) || cleanDomain.includes(cDomain);
    });
  }

  search(query, category = 'all') {
    let list = this.credentials;
    if (category !== 'all') {
      if (category === 'alerts') {
        const audit = this.getSecurityAudit();
        const alertIds = new Set([
          ...audit.weak.map(a => a.id),
          ...audit.reused.flatMap(r => r.items.map(i => i.id))
        ]);
        list = list.filter(c => alertIds.has(c.id));
      } else {
        list = list.filter(c => (c.category || 'logins') === category);
      }
    }

    if (!query || !query.trim()) return list;
    const q = query.toLowerCase().trim();
    return list.filter(c => 
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.url && c.url.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  }

  addCredential({ title, url, username, password, category = 'logins', notes = '' }) {
    const cleanUrl = url ? (url.startsWith('http') ? url : 'https://' + url) : '';
    let domain = '';
    let favicon = '';
    try {
      if (cleanUrl) {
        const parsed = new URL(cleanUrl);
        domain = parsed.hostname;
        favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      }
    } catch (e) {}

    const item = {
      id: 'pwd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: title || domain || 'Untitled Account',
      url: cleanUrl,
      domain: domain,
      favicon: favicon,
      username: username || '',
      password: password || '',
      category: category || 'logins',
      notes: notes || '',
      strength: this.calculateStrength(password),
      createdAt: Date.now(),
      lastModified: Date.now()
    };

    this.credentials.push(item);
    this.saveVault();
    return item;
  }

  updateCredential(id, updates) {
    const index = this.credentials.findIndex(c => c.id === id);
    if (index === -1) return null;

    if (updates.password) {
      updates.strength = this.calculateStrength(updates.password);
    }
    if (updates.url) {
      try {
        const cleanUrl = updates.url.startsWith('http') ? updates.url : 'https://' + updates.url;
        const parsed = new URL(cleanUrl);
        updates.url = cleanUrl;
        updates.domain = parsed.hostname;
        updates.favicon = `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
      } catch (e) {}
    }

    updates.lastModified = Date.now();
    Object.assign(this.credentials[index], updates);
    this.saveVault();
    return this.credentials[index];
  }

  deleteCredential(id) {
    const index = this.credentials.findIndex(c => c.id === id);
    if (index === -1) return false;

    this.credentials.splice(index, 1);
    this.saveVault();
    return true;
  }

  /* ==========================================================================
     PASSWORD GENERATOR (macOS Strong Password Style)
     ========================================================================== */
  generatePassword(options = {}) {
    const length = options.length || 18;
    const useUpper = options.uppercase !== false;
    const useLower = options.lowercase !== false;
    const useNumbers = options.numbers !== false;
    const useSymbols = options.symbols !== false;
    const easyToRead = options.easyToRead || false;

    let chars = '';
    if (useUpper) chars += easyToRead ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useLower) chars += easyToRead ? 'abcdefghijkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    if (useNumbers) chars += easyToRead ? '23456789' : '0123456789';
    if (useSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  calculateStrength(password) {
    if (!password) return { score: 0, label: 'Empty', color: '#94a3b8' };

    let score = 0;
    if (password.length >= 8) score += 20;
    if (password.length >= 12) score += 20;
    if (password.length >= 16) score += 10;
    if (/[A-Z]/.test(password)) score += 15;
    if (/[a-z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 15;
    if (/[^A-Za-z0-9]/.test(password)) score += 10;

    if (score < 40) return { score, label: 'Weak', color: '#ef4444' };
    if (score < 75) return { score, label: 'Good', color: '#f59e0b' };
    return { score: Math.min(100, score), label: 'Strong', color: '#10b981' };
  }

  /* ==========================================================================
     SECURITY AUDIT & HEALTH RECOMMENDATIONS
     ========================================================================== */
  getSecurityAudit() {
    const total = this.credentials.length;
    if (total === 0) {
      return { total: 0, score: 100, weak: [], reused: [], alertsCount: 0 };
    }

    const weak = [];
    const passwordGroups = new Map();

    this.credentials.forEach(c => {
      const strength = this.calculateStrength(c.password);
      if (strength.score < 40 || (c.password && c.password.length < 8)) {
        weak.push({ ...c, strength });
      }

      if (c.password) {
        if (!passwordGroups.has(c.password)) {
          passwordGroups.set(c.password, []);
        }
        passwordGroups.get(c.password).push(c);
      }
    });

    const reused = [];
    passwordGroups.forEach((items, pwd) => {
      if (items.length > 1) {
        reused.push({ count: items.length, items });
      }
    });

    const reusedItemsCount = reused.reduce((acc, r) => acc + r.count, 0);
    const alertsCount = weak.length + reusedItemsCount;
    
    // Calculate 0-100% Health Score
    let penalty = (weak.length * 20) + (reusedItemsCount * 15);
    let healthScore = Math.max(0, Math.min(100, Math.round(100 - (penalty / total))));

    return {
      total,
      score: healthScore,
      weak,
      reused,
      alertsCount
    };
  }

  /* ==========================================================================
     IMPORT & EXPORT (Chrome / Brave CSV & JSON)
     ========================================================================== */
  exportAsJson() {
    return JSON.stringify(this.credentials, null, 2);
  }

  exportAsCsv() {
    let csv = 'name,url,username,password,note\n';
    this.credentials.forEach(c => {
      const title = `"${(c.title || '').replace(/"/g, '""')}"`;
      const url = `"${(c.url || '').replace(/"/g, '""')}"`;
      const user = `"${(c.username || '').replace(/"/g, '""')}"`;
      const pass = `"${(c.password || '').replace(/"/g, '""')}"`;
      const note = `"${(c.notes || '').replace(/"/g, '""')}"`;
      csv += `${title},${url},${user},${pass},${note}\n`;
    });
    return csv;
  }

  importFromJson(jsonStr) {
    try {
      const items = JSON.parse(jsonStr);
      if (Array.isArray(items)) {
        let added = 0;
        items.forEach(item => {
          if (item.username || item.password || item.url) {
            this.addCredential({
              title: item.title || item.name || '',
              url: item.url || '',
              username: item.username || '',
              password: item.password || '',
              category: item.category || 'logins',
              notes: item.notes || item.note || ''
            });
            added++;
          }
        });
        return { success: true, count: added };
      }
    } catch (e) {
      console.error('[PasswordService] Import JSON error:', e);
    }
    return { success: false, error: 'Invalid JSON format' };
  }

  importFromCsv(csvStr) {
    try {
      const lines = csvStr.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) return { success: false, error: 'Empty or invalid CSV' };

      const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const nameIdx = header.findIndex(h => h.includes('name') || h.includes('title'));
      const urlIdx = header.findIndex(h => h.includes('url'));
      const userIdx = header.findIndex(h => h.includes('user'));
      const passIdx = header.findIndex(h => h.includes('pass'));
      const noteIdx = header.findIndex(h => h.includes('note'));

      let added = 0;
      for (let i = 1; i < lines.length; i++) {
        const row = this.parseCsvRow(lines[i]);
        if (row.length > 0) {
          const title = nameIdx >= 0 ? row[nameIdx] : '';
          const url = urlIdx >= 0 ? row[urlIdx] : '';
          const username = userIdx >= 0 ? row[userIdx] : '';
          const password = passIdx >= 0 ? row[passIdx] : '';
          const notes = noteIdx >= 0 ? row[noteIdx] : '';

          if (username || password || url) {
            this.addCredential({ title, url, username, password, notes });
            added++;
          }
        }
      }
      return { success: true, count: added };
    } catch (e) {
      console.error('[PasswordService] Import CSV error:', e);
      return { success: false, error: e.message };
    }
  }

  parseCsvRow(text) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }
}

const passwordService = new PasswordService();

module.exports = { PasswordService, passwordService };
