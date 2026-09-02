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

  toggleMaximizeWindow() {
    if (ipcRenderer) ipcRenderer.send('window-maximize-toggle');
  }

  closeWindow() {
    if (ipcRenderer) ipcRenderer.send('window-close');
  }
}

const ipcBridge = new IpcBridge();

module.exports = { IpcBridge, ipcBridge };
