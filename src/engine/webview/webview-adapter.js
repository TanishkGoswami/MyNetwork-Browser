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
    webview.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    try {
      const { containerService } = require('../../features/containers/container-service');
      const partition = containerService.resolvePartition({
        containerId: tab.containerId,
        isGhost: tab.isGhost,
        tabId: tab.id
      });
      if (partition) {
        webview.setAttribute('partition', partition);
      }
    } catch (e) {
      console.warn('[WebviewAdapter] Container partition resolution skipped:', e);
    }

    const isInternal = !tab.url || tab.url.startsWith('mynetwork://') || tab.url.startsWith('about:') || tab.url.startsWith('zen://');
    webview.src = isInternal ? BLANK_URL : tab.url;

    this.attachEvents(webview, tab.id);
    this.container.appendChild(webview);
    this.webviewMap.set(tab.id, webview);
    return webview;
  }

  attachEvents(webview, tabId) {
    // Handle window.open, popups, and OAuth login popups (Google, GitHub, Facebook)
    webview.addEventListener('new-window', (e) => {
      const url = e.url;
      if (!url || url === 'about:blank') return;
      
      const isAuthOrPopup = 
        url.includes('accounts.google.com') ||
        url.includes('google.com/signin') ||
        url.includes('github.com/login') ||
        url.includes('facebook.com') ||
        url.includes('appleid.apple.com') ||
        url.includes('oauth') ||
        url.includes('login') ||
        url.includes('signin') ||
        url.includes('auth') ||
        e.disposition === 'new-window' ||
        (e.options && (e.options.width || e.options.height));

      // If it's a standard link (not an OAuth popup), open in internal new tab
      if (!isAuthOrPopup) {
        e.preventDefault();
        const { tabManager } = require('../../core/tabs/tab-manager');
        const { workspaceService } = require('../../features/workspaces/workspace-service');
        const activeWsId = workspaceService.getActiveWorkspaceId();
        tabManager.createTab(url, 'New Tab', null, activeWsId);
      }
    });

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
      eventBus.emit('navigation:state-changed', {
        tabId,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward()
      });
    });

    webview.addEventListener('did-navigate', () => {
      eventBus.emit('navigation:state-changed', {
        tabId,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward()
      });
    });

    webview.addEventListener('did-navigate-in-page', () => {
      eventBus.emit('navigation:state-changed', {
        tabId,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward()
      });
    });

    webview.addEventListener('did-finish-load', () => {
      const url = webview.getURL();
      const { tabManager } = require('../../core/tabs/tab-manager');
      const currentTab = tabManager.getTab(tabId);

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

        const updates = { isLoading: false, url, title };
        if ((!currentTab || !currentTab.favicon) && fallbackFavicon) {
          updates.favicon = fallbackFavicon;
        }
        tabManager.updateTab(tabId, updates);

        const { historyService } = require('../../features/history/history-service');
        historyService.addRecord(title, url, updates.favicon || currentTab?.favicon);

        eventBus.emit(EVENTS.NAV_FINISH, { tabId, url, title, favicon: updates.favicon || currentTab?.favicon });

        this.injectCredentialObserver(webview);
        this.injectAutofill(webview);
      } else {
        tabManager.updateTab(tabId, { isLoading: false });
        eventBus.emit(EVENTS.NAV_FINISH, { tabId, url: url || '', title: currentTab?.title || 'New Tab', favicon: null });
      }

      eventBus.emit(EVENTS.NAV_PROGRESS, { percentage: 100 });
      eventBus.emit('navigation:state-changed', {
        tabId,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward()
      });
    });

    webview.addEventListener('did-fail-load', (e) => {
      if (e.errorCode === -3) {
        // Ignore aborted requests (e.g. user typed a new URL before old one finished)
        return;
      }
      
      const failedUrl = e.validatedURL || webview.getURL() || tab.url;
      const { tabManager } = require('../../core/tabs/tab-manager');
      tabManager.updateTab(tabId, { isLoading: false });
      
      eventBus.emit(EVENTS.NAV_FAIL, { tabId, errorCode: e.errorCode, desc: e.errorDescription, url: failedUrl });
      eventBus.emit('navigation:state-changed', {
        tabId,
        canGoBack: webview.canGoBack(),
        canGoForward: webview.canGoForward()
      });
      
      // Inject friendly macOS recovery page
      this.injectErrorPage(webview, tabId, failedUrl, e.errorCode, e.errorDescription);
    });
  }

  injectErrorPage(webview, tabId, url, errorCode, errorDescription) {
    let errorTitle = 'This site can’t be reached';
    let errorHelp = 'Check if there is a typo in the address, or verify your internet connection.';

    if (errorCode === -105 || errorCode === -2) {
      errorTitle = 'Server IP Address Not Found';
      errorHelp = `The server at "${url}" could not be resolved. Please check the domain or search with Google.`;
    } else if (errorCode === -21) {
      errorTitle = 'Network Connection Changed';
      errorHelp = 'Your network configuration changed while loading this page. Please click reload.';
    } else if (errorCode === -106) {
      errorTitle = 'No Internet Connection';
      errorHelp = 'Your device appears to be offline. Please check your Wi-Fi or network cables.';
    }

    const cleanQuery = encodeURIComponent(url.replace(/^https?:\/\//i, '').split('/')[0]);
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Page Load Error</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif; }
          body {
            background: linear-gradient(135deg, #f8fafc 0%, #eef2f6 100%);
            color: #1e293b;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
            user-select: none;
          }
          .mac-error-card {
            background: rgba(255, 255, 255, 0.88);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 18px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
            max-width: 500px;
            width: 100%;
            padding: 36px 32px;
            text-align: center;
            animation: fadeIn 0.25s ease-out;
          }
          @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
          .mac-error-icon {
            width: 56px;
            height: 56px;
            border-radius: 16px;
            background: #fee2e2;
            color: #ef4444;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 20px;
          }
          .mac-error-title {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 10px;
            letter-spacing: -0.02em;
          }
          .mac-error-url {
            font-size: 13px;
            font-family: "JetBrains Mono", monospace;
            color: #64748b;
            background: #f1f5f9;
            padding: 6px 12px;
            border-radius: 8px;
            word-break: break-all;
            margin-bottom: 16px;
            display: inline-block;
          }
          .mac-error-desc {
            font-size: 13.5px;
            color: #475569;
            line-height: 1.55;
            margin-bottom: 28px;
          }
          .mac-error-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
          }
          .mac-btn {
            padding: 9px 18px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 10px;
            border: none;
            cursor: pointer;
            transition: all 0.15s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .mac-btn-primary {
            background: #007aff;
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);
          }
          .mac-btn-primary:hover { background: #0062cc; transform: translateY(-1px); }
          .mac-btn-secondary {
            background: #e2e8f0;
            color: #334155;
          }
          .mac-btn-secondary:hover { background: #cbd5e1; }
          .mac-error-code {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 24px;
          }
        </style>
      </head>
      <body>
        <div class="mac-error-card">
          <div class="mac-error-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div class="mac-error-title">${errorTitle}</div>
          <div class="mac-error-url">${url}</div>
          <p class="mac-error-desc">${errorHelp}</p>
          <div class="mac-error-actions">
            <button class="mac-btn mac-btn-primary" onclick="window.location.reload()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Try Again
            </button>
            <a class="mac-btn mac-btn-secondary" href="https://www.google.com/search?q=${cleanQuery}">
              Search Google
            </a>
          </div>
          <div class="mac-error-code">Error Code: ${errorCode} (${errorDescription || 'UNKNOWN_ERROR'})</div>
        </div>
      </body>
      </html>
    `;
    try {
      webview.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`).catch(() => {});
    } catch (err) {}
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

          function isCredentialInput(el) {
            if (!el || el.tagName !== 'INPUT') return false;

            const type = (el.type || 'text').toLowerCase();
            
            // 1. Password field is ALWAYS a credential field
            if (type === 'password') return true;

            // 2. Only consider text, email, or tel fields
            if (type !== 'text' && type !== 'email' && type !== 'tel') return false;

            const name = (el.name || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const placeholder = (el.placeholder || '').toLowerCase();
            const role = (el.getAttribute('role') || '').toLowerCase();
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();

            // 3. Exclude all search, filter, query, and non-auth fields
            if (type === 'search' || role === 'search' || role === 'searchbox') return false;
            
            const searchTerms = ['search', 'filter', 'query', 'find', 'keyword', 'search-box', 'searchinput', 'search_input', 'search_query', 'q', 's'];
            if (searchTerms.some(term => name === term || id === term || name.includes(term) || id.includes(term) || placeholder.includes(term) || ariaLabel.includes(term))) {
              return false;
            }

            // Exclude non-login common inputs (e.g. coupon, promo, zip, postal, captcha, otp, code, amount, title, company, tag)
            const nonAuthTerms = ['coupon', 'promo', 'zip', 'postal', 'captcha', 'otp', 'amount', 'company', 'address', 'city', 'state', 'country', 'subject', 'message', 'comment', 'title', 'tag'];
            if (nonAuthTerms.some(term => name.includes(term) || id.includes(term) || placeholder.includes(term))) {
              return false;
            }

            // 4. Check for standard auth autocomplete tags
            if (autocomplete === 'username' || autocomplete === 'email' || autocomplete === 'current-password' || autocomplete === 'webauthn') {
              return true;
            }

            // 5. Explicit login keywords on the input itself
            const authKeywords = ['username', 'user_name', 'userid', 'user_id', 'user-name', 'userlogin', 'user_login', 'login_id', 'loginid', 'account_id', 'accountname', 'account_name', 'email_address', 'login-email', 'login_email', 'auth-email', 'identifier'];
            const hasAuthAttr = authKeywords.some(k => name === k || id === k || name.includes(k) || id.includes(k) || ariaLabel.includes(k));

            // 6. Form / Container password relationship
            const form = el.form || el.closest('form');
            let hasPasswordField = false;
            if (form) {
              hasPasswordField = !!form.querySelector('input[type="password"]');
            } else {
              const loginContainer = el.closest('div[class*="login"], div[class*="auth"], div[class*="signin"], div[class*="sign-in"], div[id*="login"], div[id*="auth"], div[id*="signin"], form');
              if (loginContainer) {
                hasPasswordField = !!loginContainer.querySelector('input[type="password"]');
              }
            }

            if (hasPasswordField && (hasAuthAttr || type === 'email' || placeholder.includes('email') || placeholder.includes('username') || placeholder.includes('user name') || placeholder.includes('phone') || placeholder.includes('mobile') || placeholder.includes('login') || placeholder.includes('id') || name.includes('user') || name.includes('email') || name.includes('login'))) {
              return true;
            }

            // If it explicitly has a strong login identifier and is not a search box
            if (hasAuthAttr) return true;

            return false;
          }

          // Trigger suggestion dropdown ONLY on genuine login / credential inputs
          document.addEventListener('focusin', function(e) {
            const t = e.target;
            if (isCredentialInput(t)) {
              showSuggestions(t);
            } else {
              removeMenu();
            }
          }, true);

          document.addEventListener('click', function(e) {
            const t = e.target;
            if (isCredentialInput(t)) {
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

        const activeEl = document.activeElement;
        const form = (activeEl && (activeEl.form || activeEl.closest('form'))) || document.querySelector('form') || document;
        const pwd = form.querySelector('input[type="password"]') || document.querySelector('input[type="password"]');
        const userField = form.querySelector('input[autocomplete="username"], input[autocomplete="email"], input[name*="user"], input[name*="login"], input[name*="email"], input[type="email"], input[type="text"]') || (activeEl && activeEl.type !== 'password' ? activeEl : null);

        if (userField) setReactValue(userField, u);
        if (pwd) setReactValue(pwd, p);
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
      const target = isInternal ? BLANK_URL : url;
      try {
        if (typeof webview.loadURL === 'function') {
          webview.loadURL(target).catch(() => {});
        } else {
          webview.src = target;
        }
      } catch (err) {
        webview.src = target;
      }
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
