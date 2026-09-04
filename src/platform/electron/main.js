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

    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

// Window Control & Theme IPC Handlers
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
}

