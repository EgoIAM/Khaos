const { contextBridge, ipcRenderer } = require('electron');

// Ce preload est attaché à TOUS les onglets. Par sécurité, les API privilégiées
// ne sont exposées que sur nos propres pages locales — jamais sur un site
// distant, qui ne doit jamais pouvoir choisir le fond d'écran ni lire l'historique.
const isFileUrl = location.protocol === 'file:';
const isOwnHomePage = isFileUrl && location.pathname.endsWith('/home.html');
const isOwnHistoryPage = isFileUrl && location.pathname.endsWith('/history.html');

if (isOwnHomePage) {
  contextBridge.exposeInMainWorld('khaosWallpaper', {
    get: () => ipcRenderer.invoke('wallpaper:get'),
    choose: () => ipcRenderer.invoke('wallpaper:choose'),
    clear: () => ipcRenderer.invoke('wallpaper:clear'),
    onChange: (cb) => ipcRenderer.on('wallpaper:changed', (_e, url) => cb(url))
  });
}

if (isOwnHistoryPage) {
  contextBridge.exposeInMainWorld('khaosHistory', {
    list: (query) => ipcRenderer.invoke('history:list', query),
    clear: () => ipcRenderer.invoke('history:clear')
  });
}

// --- Blocage des publicités YouTube (masquage + saut automatique) ---
// Le blocage réseau (main.js) coupe les appels de métadonnées publicitaires,
// mais les vidéos-pub elles-mêmes transitent par le même CDN que le contenu
// normal : impossible de les bloquer par URL sans casser la lecture. On les
// laisse donc charger et on les saute/masque automatiquement côté page.
const isYouTube = /(^|\.)youtube\.com$/.test(location.hostname);

if (isYouTube) {
  ipcRenderer.invoke('blocking:get').then((enabled) => {
    if (enabled) injectYoutubeAdBlock();
  });
}

function injectYoutubeAdBlock() {
  const style = document.createElement('style');
  style.textContent = `
    .ytp-ad-overlay-container, .ytp-ad-image-overlay, .ytp-ad-text-overlay,
    ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer,
    ytd-promoted-video-renderer, ytd-ad-slot-renderer,
    ytd-in-feed-ad-layout-renderer, #masthead-ad,
    ytd-banner-promo-renderer, ytd-statement-banner-renderer,
    ytd-companion-slot-renderer, ytd-action-companion-ad-renderer {
      display: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  function tick() {
    const player = document.querySelector('.html5-video-player');
    if (player && player.classList.contains('ad-showing')) {
      const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
      if (skipBtn) { skipBtn.click(); return; }
      const video = document.querySelector('video');
      if (video && isFinite(video.duration) && video.duration > 0) {
        video.muted = true;
        video.currentTime = video.duration;
      }
    }
  }

  const start = () => {
    new MutationObserver(tick).observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class']
    });
    setInterval(tick, 400);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}
