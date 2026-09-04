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

  on(channel, callback) {
    if (ipcRenderer && typeof ipcRenderer.on === 'function') {
      ipcRenderer.on(channel, callback);
    }
  }
}

const ipcBridge = new IpcBridge();

module.exports = { IpcBridge, ipcBridge };
