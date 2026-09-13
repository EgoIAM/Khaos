const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

const params = new URLSearchParams(location.search);

contextBridge.exposeInMainWorld('khaos', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximizeToggle: () => ipcRenderer.send('window:maximize-toggle'),
  close: () => ipcRenderer.send('window:close'),
  onMaximizedChange: (cb) => ipcRenderer.on('window:maximized', (_e, val) => cb(val)),
  newIncognitoWindow: () => ipcRenderer.send('window:new-incognito'),

  isIncognito: params.get('incognito') === '1',
  partition: params.get('partition') || 'persist:khaos-main',

  webviewPreloadPath: 'file://' + path.join(__dirname, 'webview-preload.js').replace(/\\/g, '/'),

  wallpaper: {
    get: () => ipcRenderer.invoke('wallpaper:get'),
    choose: () => ipcRenderer.invoke('wallpaper:choose'),
    clear: () => ipcRenderer.invoke('wallpaper:clear')
  },

  favorites: {
    list: () => ipcRenderer.invoke('favorites:list'),
    add: (entry) => ipcRenderer.invoke('favorites:add', entry),
    remove: (url) => ipcRenderer.invoke('favorites:remove', url)
  },

  history: {
    add: (entry) => ipcRenderer.invoke('history:add', entry),
    list: (query) => ipcRenderer.invoke('history:list', query),
    clear: () => ipcRenderer.invoke('history:clear')
  },

  blocking: {
    get: () => ipcRenderer.invoke('blocking:get'),
    toggle: () => ipcRenderer.invoke('blocking:toggle')
  },

  downloads: {
    list: () => ipcRenderer.invoke('downloads:list'),
    openFile: (savePath) => ipcRenderer.invoke('downloads:openFile', savePath),
    openFolder: (savePath) => ipcRenderer.invoke('downloads:openFolder', savePath),
    onChanged: (cb) => ipcRenderer.on('downloads:changed', (_e, list) => cb(list))
  }
});
