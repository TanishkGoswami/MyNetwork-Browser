// Main Electron Process
const { app, BrowserWindow, ipcMain, nativeImage } = require('electron');
const path = require('path');

// Set Application User Model ID for Windows Taskbar grouping and high-res icon display
if (app && app.setAppUserModelId && process.platform === 'win32') {
  app.setAppUserModelId('com.mynetwork.browser');
}

// Disable automatic WebAuthn Conditional UI popups so Windows Security modal does not block typing ID/Password
if (app && app.commandLine) {
  app.commandLine.appendSwitch('disable-features', 'WebAuthenticationConditionalUI');
  app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

if (app && app.whenReady) {
  app.whenReady().then(() => {
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
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize-toggle', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.on('set-theme-source', (event, theme) => {
    const { nativeTheme } = require('electron');
    if (nativeTheme) {
      nativeTheme.themeSource = (theme === 'dark' || theme === 'light') ? theme : 'system';
    }
  });
}
