const { contextBridge, ipcRenderer } = require('electron');

// Ce preload est attaché à TOUS les onglets. Par sécurité, l'API n'est
// exposée que sur notre propre page d'accueil locale — jamais sur un site
// distant, qui ne doit jamais pouvoir choisir/lire/effacer le fond d'écran.
const isOwnHomePage = location.protocol === 'file:' && location.pathname.endsWith('/home.html');

if (isOwnHomePage) {
  contextBridge.exposeInMainWorld('khaosWallpaper', {
    get: () => ipcRenderer.invoke('wallpaper:get'),
    choose: () => ipcRenderer.invoke('wallpaper:choose'),
    clear: () => ipcRenderer.invoke('wallpaper:clear')
  });
}
