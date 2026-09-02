// Main Electron Process
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Disable automatic WebAuthn Conditional UI popups so Windows Security modal does not block typing ID/Password
app.commandLine.appendSwitch('disable-features', 'WebAuthenticationConditionalUI');
app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#ffffff',
    title: 'MyNetwork Browser',
    icon: path.join(__dirname, '../../ui/assets/icon.svg'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    }
  });

  // Load UI shell
  mainWindow.loadFile(path.join(__dirname, '../../ui/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Window Control IPC Handlers
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
