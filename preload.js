const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('khaos', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximizeToggle: () => ipcRenderer.send('window:maximize-toggle'),
  close: () => ipcRenderer.send('window:close'),
  onMaximizedChange: (cb) => ipcRenderer.on('window:maximized', (_e, val) => cb(val)),

  webviewPreloadPath: 'file://' + path.join(__dirname, 'webview-preload.js').replace(/\\/g, '/'),

  wallpaper: {
    get: () => ipcRenderer.invoke('wallpaper:get'),
    choose: () => ipcRenderer.invoke('wallpaper:choose'),
    clear: () => ipcRenderer.invoke('wallpaper:clear')
  }
});
