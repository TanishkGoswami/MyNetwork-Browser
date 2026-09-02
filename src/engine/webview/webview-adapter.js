// WebviewAdapter - Encapsulates Electron webview engine DOM interactions & events
const { eventBus } = require('../../shared/events/event-bus');
const { EVENTS, DEFAULT_NEWTAB_URL, LEGACY_NEWTAB_URL, BLANK_URL } = require('../../shared/constants');

class WebviewAdapter {
  constructor(containerElement) {
    this.container = containerElement;
    this.webviewMap = new Map(); // tabId -> webview element
  }

  createWebview(tab) {
    const webview = document.createElement('webview');
    webview.id = `wv-${tab.id}`;
    webview.className = 'browser-webview';
    webview.setAttribute('allowpopups', 'true');
    webview.setAttribute('webpreferences', 'contextIsolation=false');

    const isInternal = !tab.url || tab.url.startsWith('mynetwork://') || tab.url.startsWith('about:') || tab.url.startsWith('zen://');
    webview.src = isInternal ? BLANK_URL : tab.url;

    this.attachEvents(webview, tab.id);
    this.container.appendChild(webview);
    this.webviewMap.set(tab.id, webview);
    return webview;
  }

  attachEvents(webview, tabId) {
    webview.addEventListener('did-start-loading', () => {
      const currentUrl = webview.getURL();
      eventBus.emit(EVENTS.NAV_START, { tabId, url: currentUrl });
      eventBus.emit(EVENTS.NAV_PROGRESS, { percentage: 30 });
    });

    webview.addEventListener('page-title-updated', (e) => {
      if (e.title && e.title !== 'about:blank' && !e.title.startsWith('mynetwork://')) {
        const { tabManager } = require('../../core/tabs/tab-manager');
        tabManager.updateTab(tabId, { title: e.title });
      }
    });

    webview.addEventListener('page-favicon-updated', (e) => {
      if (e.favicons && e.favicons.length > 0 && e.favicons[0]) {
        const { tabManager } = require('../../core/tabs/tab-manager');
        tabManager.updateTab(tabId, { favicon: e.favicons[0] });
      }
    });

    webview.addEventListener('console-message', (e) => {
      if (e.message && e.message.startsWith('__MYNETWORK_CRED_SUBMIT__:')) {
        try {
          const raw = e.message.substring('__MYNETWORK_CRED_SUBMIT__:'.length);
          const data = JSON.parse(raw);
          if (data && data.password) {
            eventBus.emit('security:credential-submitted', {
              tabId,
              username: data.username || '',
              password: data.password,
              url: data.url || webview.getURL()
            });
          }
        } catch (err) {
          console.error('[WebviewAdapter] Failed to parse credential message:', err);
        }
      } else if (e.message && e.message.startsWith('__MYNETWORK_REQUEST_AUTOFILL__:')) {
        try {
          const raw = e.message.substring('__MYNETWORK_REQUEST_AUTOFILL__:'.length);
          const data = JSON.parse(raw);
          eventBus.emit('security:autofill-requested', {
            tabId,
            credId: data.credId,
            username: data.username,
            url: webview.getURL()
          });
        } catch (err) {
          console.error('[WebviewAdapter] Failed to parse autofill request:', err);
        }
      }
    });

    webview.addEventListener('ipc-message', (e) => {
      if (e.channel === 'credential-submitted' && e.args && e.args[0]) {
        eventBus.emit('security:credential-submitted', {
          tabId,
          username: e.args[0].username,
          password: e.args[0].password,
          url: e.args[0].url || webview.getURL()
        });
      }
    });

    webview.addEventListener('dom-ready', () => {
      this.injectCredentialObserver(webview);
      this.injectAutofill(webview);
    });

    webview.addEventListener('did-finish-load', () => {
      const url = webview.getURL();
      if (url && url !== 'about:blank' && !url.startsWith('mynetwork://')) {
        const rawTitle = webview.getTitle();
        const title = (rawTitle && rawTitle !== 'about:blank') ? rawTitle : url;
        
        let fallbackFavicon = null;
        try {
          const parsed = new URL(url);
          if (parsed.hostname) {
            fallbackFavicon = `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
          }
        } catch (err) {}

        const { tabManager } = require('../../core/tabs/tab-manager');
        const currentTab = tabManager.getTab(tabId);
        const updates = { isLoading: false, url, title };
        if ((!currentTab || !currentTab.favicon) && fallbackFavicon) {
          updates.favicon = fallbackFavicon;
        }
        tabManager.updateTab(tabId, updates);

        const { historyService } = require('../../infrastructure/storage/history-service');
        historyService.addRecord(title, url);

        eventBus.emit(EVENTS.NAV_FINISH, { tabId, url, title, favicon: updates.favicon || currentTab?.favicon });

        this.injectCredentialObserver(webview);
        this.injectAutofill(webview);
      }
      eventBus.emit(EVENTS.NAV_PROGRESS, { percentage: 100 });
    });

    webview.addEventListener('did-fail-load', (e) => {
      if (e.errorCode !== -3) { // Ignore aborted requests
        eventBus.emit(EVENTS.NAV_FAIL, { tabId, errorCode: e.errorCode, desc: e.errorDescription });
      }
    });
  }

  injectCredentialObserver(webview) {
    const code = `
      (function() {
        if (window.__mynetwork_pwd_hooked) return;
        window.__mynetwork_pwd_hooked = true;

        // 1. Prevent background WebAuthn passkey request from hijacking input focus
        try {
          if (navigator.credentials && navigator.credentials.get) {
            const origGet = navigator.credentials.get.bind(navigator.credentials);
            navigator.credentials.get = function(options) {
              if (options && options.mediation === 'conditional') {
                return Promise.reject(new DOMException('Conditional WebAuthn dismissed', 'NotAllowedError'));
              }
              return origGet(options);
            };
          }
        } catch(e) {}

        let lastUser = '';
        let lastPass = '';

        // 2. Real-time typing tracker
        function updateLiveValues(e) {
          try {
            if (!e || !e.target) return;
            const target = e.target;
            if (target.type === 'password') {
              lastPass = target.value;
              const form = target.closest('form') || document;
              const userFields = form.querySelectorAll('input[name="username"], input[type="text"], input[type="email"], input[type="tel"], input:not([type])');
              const filled = Array.from(userFields).filter(i => i.value && i.value.trim() && i.type !== 'password');
              if (filled.length > 0) {
                lastUser = filled[filled.length - 1].value.trim();
              }
            } else if (target.type === 'text' || target.type === 'email' || target.type === 'tel' || target.name === 'username') {
              if (target.value && target.value.trim()) {
                lastUser = target.value.trim();
              }
            }
          } catch(err) {}
        }

        document.addEventListener('input', updateLiveValues, true);
        document.addEventListener('change', updateLiveValues, true);

        // 3. Robust credential submission emitter
        function triggerSubmit() {
          try {
            // Re-read directly from DOM if variables not captured
            if (!lastPass) {
              const pwd = document.querySelector('input[type="password"]');
              if (pwd && pwd.value) lastPass = pwd.value;
            }
            if (!lastUser) {
              const user = document.querySelector('input[name="username"], input[type="text"], input[type="email"], input[type="tel"]');
              if (user && user.value && user.type !== 'password') lastUser = user.value.trim();
            }

            if (lastPass && lastPass.length >= 2) {
              const payload = JSON.stringify({
                username: lastUser || 'User',
                password: lastPass,
                url: window.location.href
              });
              console.log('__MYNETWORK_CRED_SUBMIT__:' + payload);
            }
          } catch(err) {}
        }

        // 4. Listeners for Submit, Button Clicks, and Enter key
        document.addEventListener('submit', function() {
          triggerSubmit();
        }, true);

        document.addEventListener('click', function(e) {
          const btn = e.target.closest('button, input[type="submit"], [role="button"]');
          if (btn) {
            triggerSubmit();
            setTimeout(triggerSubmit, 200);
            setTimeout(triggerSubmit, 600);
          }
        }, true);

        document.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            triggerSubmit();
            setTimeout(triggerSubmit, 200);
          }
        }, true);
      })();
    `;
    webview.executeJavaScript(code).catch(() => {});
  }

  injectAutofill(webview) {
    try {
      const url = webview.getURL();
      if (!url || url.startsWith('about:') || url.startsWith('mynetwork://')) return;
      const parsed = new URL(url);
      const { passwordService } = require('../../infrastructure/storage/password-service');
      const creds = passwordService.getForDomain(parsed.hostname);
      if (!creds || creds.length === 0) return;

      const accounts = creds.map(c => ({
        id: c.id,
        username: c.username || 'Saved Account',
        title: c.title || parsed.hostname
      }));
      const isLocked = passwordService.isVaultLocked();

      const code = `
        (function() {
          if (window.__mynetwork_autofill_injected) return;
          window.__mynetwork_autofill_injected = true;

          const accounts = ${JSON.stringify(accounts)};
          const isVaultLocked = ${JSON.stringify(isLocked)};
          let currentMenu = null;

          function removeMenu() {
            if (currentMenu && currentMenu.parentNode) {
              currentMenu.parentNode.removeChild(currentMenu);
              currentMenu = null;
            }
          }

          function showSuggestions(inputEl) {
            removeMenu();
            if (!inputEl) return;

            const rect = inputEl.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;

            const menu = document.createElement('div');
            menu.id = 'mynetwork-autofill-menu';
            menu.style.cssText = [
              'position: fixed',
              'top: ' + (rect.bottom + 4) + 'px',
              'left: ' + rect.left + 'px',
              'min-width: ' + Math.max(Math.min(rect.width, 320), 240) + 'px',
              'max-width: 340px',
              'background: rgba(255, 255, 255, 0.94)',
              'backdrop-filter: blur(28px) saturate(190%)',
              '-webkit-backdrop-filter: blur(28px) saturate(190%)',
              'border: 0.5px solid rgba(0, 0, 0, 0.16)',
              'border-radius: 9px',
              'box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04)',
              'z-index: 2147483647',
              'padding: 3px',
              'font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
              'display: flex',
              'flex-direction: column',
              'gap: 1px',
              'box-sizing: border-box',
              'user-select: none'
            ].join(';');

            let itemsHtml = '';

            accounts.forEach(function(acc) {
              const lockBadge = isVaultLocked 
                ? '<span class="mac-af-lock-badge" style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 500; color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px; margin-left: 6px;"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Locked</span>'
                : '';

              itemsHtml += [
                '<div class="mynetwork-autofill-item" data-id="' + acc.id + '" data-user="' + acc.username + '" style="display: flex; align-items: center; gap: 9px; padding: 6px 9px; border-radius: 6px; cursor: pointer; transition: all 0.12s ease;">',
                  '<div class="mac-af-icon-wrap" style="width: 24px; height: 24px; border-radius: 6px; background: rgba(217, 119, 6, 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.12s ease;">',
                    '<svg class="mac-af-key-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.2"><path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5M19 5l-2.5 2.5M9 11l-7 7v4h4l7-7"/><circle cx="16" cy="8" r="5"/></svg>',
                  '</div>',
                  '<div style="flex: 1; min-width: 0;">',
                    '<div style="display: flex; align-items: center; justify-content: space-between;">',
                      '<span class="mac-af-user-title" style="font-size: 12.5px; font-weight: 500; color: #1c1c1e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em;">' + acc.username + '</span>',
                      lockBadge,
                    '</div>',
                    '<div class="mac-af-sub-text" style="font-size: 10px; color: #8e8e93; margin-top: 0.5px;">AutoFill Password for ' + window.location.hostname + '</div>',
                  '</div>',
                '</div>'
              ].join('');
            });

            menu.innerHTML = itemsHtml;
            document.body.appendChild(menu);
            currentMenu = menu;

            // Authentic Apple macOS hover states (blue pill highlight)
            const items = menu.querySelectorAll('.mynetwork-autofill-item');
            items.forEach(function(item) {
              const userTitle = item.querySelector('.mac-af-user-title');
              const subText = item.querySelector('.mac-af-sub-text');
              const iconWrap = item.querySelector('.mac-af-icon-wrap');
              const keySvg = item.querySelector('.mac-af-key-svg');
              const lockBadge = item.querySelector('.mac-af-lock-badge');

              item.onmouseenter = function() {
                item.style.backgroundColor = '#007aff';
                if (userTitle) userTitle.style.color = '#ffffff';
                if (subText) subText.style.color = 'rgba(255, 255, 255, 0.82)';
                if (iconWrap) iconWrap.style.backgroundColor = 'rgba(255, 255, 255, 0.22)';
                if (keySvg) keySvg.setAttribute('stroke', '#ffffff');
                if (lockBadge) {
                  lockBadge.style.background = 'rgba(255, 255, 255, 0.22)';
                  lockBadge.style.color = '#ffffff';
                }
              };

              item.onmouseleave = function() {
                item.style.backgroundColor = 'transparent';
                if (userTitle) userTitle.style.color = '#1c1c1e';
                if (subText) subText.style.color = '#8e8e93';
                if (iconWrap) iconWrap.style.backgroundColor = 'rgba(217, 119, 6, 0.12)';
                if (keySvg) keySvg.setAttribute('stroke', '#d97706');
                if (lockBadge) {
                  lockBadge.style.background = '#fef3c7';
                  lockBadge.style.color = '#b45309';
                }
              };

              item.onmousedown = function(e) {
                e.preventDefault();
                e.stopPropagation();
                const credId = item.getAttribute('data-id');
                const username = item.getAttribute('data-user');
                console.log('__MYNETWORK_REQUEST_AUTOFILL__:' + JSON.stringify({ credId: credId, username: username }));
                removeMenu();
              };
            });
          }

          // Trigger suggestion dropdown on focus/click of login inputs
          document.addEventListener('focusin', function(e) {
            const t = e.target;
            if (t && (t.type === 'password' || t.type === 'text' || t.type === 'email' || t.type === 'tel' || t.name === 'username')) {
              showSuggestions(t);
            }
          }, true);

          document.addEventListener('click', function(e) {
            const t = e.target;
            if (t && (t.type === 'password' || t.type === 'text' || t.type === 'email' || t.type === 'tel' || t.name === 'username')) {
              showSuggestions(t);
            } else if (!e.target.closest('#mynetwork-autofill-menu')) {
              removeMenu();
            }
          }, true);

          document.addEventListener('scroll', removeMenu, true);
          document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') removeMenu();
          }, true);
        })();
      `;
      webview.executeJavaScript(code).catch(() => {});
    } catch (e) {}
  }

  performAutofill(tabId, username, password) {
    const webview = this.webviewMap.get(tabId);
    if (!webview) return;

    const code = `
      (function() {
        const u = ${JSON.stringify(username)};
        const p = ${JSON.stringify(password)};

        function setReactValue(el, val) {
          if (!el) return;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) {
            setter.call(el, val);
          } else {
            el.value = val;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const pwds = document.querySelectorAll('input[type="password"]');
        if (pwds.length > 0) {
          pwds.forEach(function(pwd) {
            const form = pwd.closest('form') || document;
            const userFields = form.querySelectorAll('input[name="username"], input[type="text"], input[type="email"], input[type="tel"], input:not([type])');
            if (userFields.length > 0) {
              setReactValue(userFields[0], u);
            }
            setReactValue(pwd, p);
          });
        } else {
          const users = document.querySelectorAll('input[name="username"], input[type="text"], input[type="email"], input[type="tel"]');
          if (users.length > 0) {
            setReactValue(users[0], u);
          }
        }
      })();
    `;
    webview.executeJavaScript(code).catch(() => {});
  }

  showWebview(tabId) {
    this.webviewMap.forEach((wv, id) => {
      if (id === tabId) {
        wv.classList.add('active');
        this.injectAutofill(wv);
      } else {
        wv.classList.remove('active');
      }
    });
  }

  removeWebview(tabId) {
    const webview = this.webviewMap.get(tabId);
    if (webview) {
      if (webview.parentNode) {
        webview.parentNode.removeChild(webview);
      }
      this.webviewMap.delete(tabId);
    }
  }

  navigate(tabId, url) {
    const webview = this.webviewMap.get(tabId);
    if (webview) {
      const isInternal = !url || url.startsWith('mynetwork://') || url.startsWith('about:') || url.startsWith('zen://');
      webview.src = isInternal ? BLANK_URL : url;
    }
  }

  goBack(tabId) {
    const webview = this.webviewMap.get(tabId);
    if (webview && webview.canGoBack()) webview.goBack();
  }

  goForward(tabId) {
    const webview = this.webviewMap.get(tabId);
    if (webview && webview.canGoForward()) webview.goForward();
  }

  reload(tabId) {
    const webview = this.webviewMap.get(tabId);
    if (webview) webview.reload();
  }
}

module.exports = { WebviewAdapter };
