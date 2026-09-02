// IPC Bridge - Safe wrapper for renderer process
let ipcRenderer = null;
try {
  ({ ipcRenderer } = require('electron'));
} catch (e) {
  console.warn('[IpcBridge] Running outside electron runtime.');
}

class IpcBridge {
  minimizeWindow() {
    if (ipcRenderer) ipcRenderer.send('window-minimize');
  }

  minimize() {
    this.minimizeWindow();
  }

  toggleMaximize() {
    if (ipcRenderer) ipcRenderer.send('window-maximize-toggle');
  }

  toggleMaximizeWindow() {
    if (ipcRenderer) ipcRenderer.send('window-maximize-toggle');
  }

  maximize() {
    this.toggleMaximize();
  }

  closeWindow() {
    if (ipcRenderer) ipcRenderer.send('window-close');
  }

  close() {
    this.closeWindow();
  }
}

const ipcBridge = new IpcBridge();

module.exports = { IpcBridge, ipcBridge };
