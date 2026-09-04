// Main Electron Process
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');

// Global safety guards to prevent Electron GuestViewManager internal crash logs on network switches / aborts
process.on('uncaughtException', (err) => {
  if (err && (err.code === 'ERR_FAILED' || err.code === 'ERR_NETWORK_CHANGED' || err.code === 'ERR_NAME_NOT_RESOLVED' || err.code === 'ERR_ABORTED')) {
    // Expected transient network or navigation aborts - suppress stack trace
    return;
  }
  console.warn('[Main Process] Handled exception:', err?.message || err);
});

process.on('unhandledRejection', (reason) => {
  if (reason && (reason.code === 'ERR_FAILED' || reason.code === 'ERR_NETWORK_CHANGED' || reason.code === 'ERR_NAME_NOT_RESOLVED' || reason.code === 'ERR_ABORTED')) {
    // Expected guest webview load rejections
    return;
  }
  console.warn('[Main Process] Handled rejection:', reason?.message || reason);
});

// Set Application User Model ID for Windows Taskbar grouping and high-res icon display
if (app && app.setAppUserModelId && process.platform === 'win32') {
  app.setAppUserModelId('com.mynetwork.browser');
}

// Disable automatic WebAuthn Conditional UI popups so Windows Security modal does not block typing ID/Password
if (app && app.commandLine) {
  app.commandLine.appendSwitch('disable-features', 'WebAuthenticationConditionalUI');
  app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');
  app.commandLine.appendSwitch('ignore-certificate-errors', 'true');
  app.commandLine.appendSwitch('log-level', '3');
}

// Gracefully handle SSL/TLS certificate warnings and AIA parse errors across third-party webviews
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true); // Trust and proceed without blocking navigation
});

// Global Chrome User Agent (prevents Google OAuth disallowed_useragent block)
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

if (app) {
  app.userAgentFallback = CHROME_USER_AGENT;
}

let mainWindow = null;

function createWindow() {
  const iconPngPath = path.join(__dirname, '../../ui/assets/mynetwork-logo.png');
  const iconSvgPath = path.join(__dirname, '../../ui/assets/icon.svg');
  const appIcon = nativeImage.createFromPath(iconPngPath);

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#ffffff',
    title: 'MyNetwork Browser',
    icon: !appIcon.isEmpty() ? appIcon : iconSvgPath,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  });

  if (!appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon);
  }

  // Load UI shell
  mainWindow.loadFile(path.join(__dirname, '../../ui/index.html'));

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.warn('[Main Process] Renderer process gone:', details.reason);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (app && app.whenReady) {
  app.whenReady().then(() => {
    const { session } = require('electron');

    // Clean request headers to ensure Google OAuth recognizes clean Chrome browser
    if (session && session.defaultSession) {
      session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = CHROME_USER_AGENT;
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      });
    }

    // Handle OAuth Popups, Google Login dialogs, and window.open calls across all webviews
    app.on('web-contents-created', (event, contents) => {
      contents.setUserAgent(CHROME_USER_AGENT);

      contents.setWindowOpenHandler((details) => {
        const url = details.url || '';
        const isAuthOrPopup = 
          url.includes('accounts.google.com') ||
          url.includes('google.com/signin') ||
          url.includes('github.com/login') ||
          url.includes('facebook.com') ||
          url.includes('appleid.apple.com') ||
          url.includes('twitter.com') ||
          url.includes('x.com') ||
          url.includes('oauth') ||
          url.includes('login') ||
          url.includes('signin') ||
          url.includes('auth') ||
          details.disposition === 'new-window' ||
          (details.features && (details.features.includes('width') || details.features.includes('height')));

        if (isAuthOrPopup) {
          return {
            action: 'allow',
            overrideBrowserWindowOptions: {
              width: 540,
              height: 680,
              autoHideMenuBar: true,
              title: 'Sign In',
              webPreferences: {
                nodeIntegration: false,
                contextIsolation: false
              }
            }
          };
        }

        // Standard links target="_blank" open inside the browser as a tab
        if (mainWindow && !mainWindow.isDestroyed() && url && url !== 'about:blank') {
          mainWindow.webContents.send('open-new-tab', { url });
        }
        return { action: 'deny' };
      });
    });

    // Network-level Ad & Tracker Blocker Interception
    const adTrackerRegexList = [
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

    const attachSessionFilters = (targetSession) => {
      if (!targetSession || !targetSession.webRequest) return;
      try {
        targetSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
          const url = details.url || '';
          const isBlocked = adTrackerRegexList.some(r => r.test(url));
          if (isBlocked) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('adblock-blocked', { url, webContentsId: details.webContentsId });
            }
            callback({ cancel: true });
          } else {
            callback({ cancel: false });
          }
        });
      } catch (e) {}
    };

    if (session && session.defaultSession) {
      attachSessionFilters(session.defaultSession);
    }
    app.on('session-created', (sess) => {
      attachSessionFilters(sess);
    });

    if (session && session.defaultSession) {
      // Smart Download Manager hook
      session.defaultSession.on('will-download', (event, item, webContents) => {
        const filename = item.getFilename();
        const totalBytes = item.getTotalBytes();
        const dlId = 'dl_' + Date.now();

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('download-will-start', {
            id: dlId,
            filename,
            totalBytes,
            url: item.getURL()
          });
        }

        item.on('updated', (event, state) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-progress-update', {
              id: dlId,
              receivedBytes: item.getReceivedBytes(),
              totalBytes: item.getTotalBytes(),
              state // 'progressing' | 'interrupted'
            });
          }
        });

        item.once('done', (event, state) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download-completed', {
              id: dlId,
              state, // 'completed' | 'cancelled' | 'interrupted'
              savePath: item.getSavePath()
            });
          }
        });
      });
    }

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

// Window Control, Proxy & Theme IPC Handlers
if (ipcMain) {
  ipcMain.on('window-minimize', (event) => {
    const win = (event && event.sender && BrowserWindow.fromWebContents(event.sender)) || mainWindow;
    if (win) win.minimize();
  });

  ipcMain.on('window-maximize-toggle', (event) => {
    const win = (event && event.sender && BrowserWindow.fromWebContents(event.sender)) || mainWindow;
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on('window-close', (event) => {
    const win = (event && event.sender && BrowserWindow.fromWebContents(event.sender)) || mainWindow;
    if (win) win.close();
  });

  ipcMain.on('set-theme-source', (event, theme) => {
    const { nativeTheme } = require('electron');
    if (nativeTheme) {
      nativeTheme.themeSource = (theme === 'dark' || theme === 'light') ? theme : 'system';
    }
  });

  // Proxy Configuration IPC
  ipcMain.on('set-network-proxy', (event, { proxyRules, proxyBypassRules = '' }) => {
    const { session } = require('electron');
    if (session && session.defaultSession) {
      session.defaultSession.setProxy({
        proxyRules: proxyRules || '',
        proxyBypassRules: proxyBypassRules || '<local>'
      }).then(() => {
        console.log('[Main Process] Network proxy updated:', proxyRules || 'Direct');
      }).catch(err => {
        console.warn('[Main Process] Failed to set proxy:', err);
      });
    }
  });
}


