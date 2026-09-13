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

// Ce preload s'exécute avant même que <html> existe (document-start) : il
// faut attendre sa création — via MutationObserver sur `document` lui-même,
// qui fonctionne déjà avant que documentElement existe — pour pouvoir y
// insérer quoi que ce soit, sinon toute tentative plante silencieusement.
function whenDocumentElementReady(cb) {
  if (document.documentElement) { cb(); return; }
  const observer = new MutationObserver(() => {
    if (document.documentElement) {
      observer.disconnect();
      cb();
    }
  });
  observer.observe(document, { childList: true });
}

// --- Anti-fingerprinting ---
// Vérification synchrone (quasi instantanée) : le patch doit être en place
// avant le premier script de la page, sans quoi un script de fingerprinting
// qui lirait le canvas ou le GPU une fraction de seconde trop tôt le
// contournerait entièrement.
if (ipcRenderer.sendSync('fingerprint:get-sync')) {
  whenDocumentElementReady(injectFingerprintPatch);
}

function injectFingerprintPatch() {
  const script = document.createElement('script');
  script.textContent = `(() => {
    try {
      // Bruit de canvas : chaque lecture renvoie des pixels très légèrement
      // altérés, assez pour casser un hash de fingerprint, invisible à l'œil.
      const jitter = (v) => Math.min(255, Math.max(0, v + (Math.random() < 0.5 ? -1 : 1)));
      const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function (...args) {
        const data = origGetImageData.apply(this, args);
        for (let i = 0; i < data.data.length; i += 4) data.data[i] = jitter(data.data[i]);
        return data;
      };
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        const ctx = this.getContext('2d');
        if (ctx) {
          try {
            const data = ctx.getImageData(0, 0, this.width, this.height);
            ctx.putImageData(data, 0, 0);
          } catch (e) {}
        }
        return origToDataURL.apply(this, args);
      };

      // WebGL : masque le vrai modèle de GPU (fingerprint très fort sinon)
      const spoofGL = (proto) => {
        const orig = proto.getParameter;
        proto.getParameter = function (param) {
          if (param === 37445) return 'Google Inc. (Generic)';
          if (param === 37446) return 'ANGLE (Generic, Generic Renderer, OpenGL)';
          return orig.call(this, param);
        };
      };
      if (window.WebGLRenderingContext) spoofGL(WebGLRenderingContext.prototype);
      if (window.WebGL2RenderingContext) spoofGL(WebGL2RenderingContext.prototype);

      // AudioContext : bruit inaudible mais suffisant pour casser le hash
      if (window.AudioBuffer) {
        const origGetChannelData = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = function (...args) {
          const data = origGetChannelData.apply(this, args);
          for (let i = 0; i < data.length; i += 100) data[i] += (Math.random() - 0.5) * 1e-7;
          return data;
        };
      }

      // Signaux matériels normalisés (au lieu des vraies specs de la machine)
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
      if ('deviceMemory' in navigator) {
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });
      }
    } catch (e) {}
  })();`;
  (document.head || document.documentElement).prepend(script);
  script.remove();
}

// --- Blocage des publicités YouTube (masquage + saut automatique) ---
// Le blocage réseau (main.js) coupe les appels de métadonnées publicitaires,
// mais les vidéos-pub elles-mêmes transitent par le même CDN que le contenu
// normal : impossible de les bloquer par URL sans casser la lecture. On les
// laisse donc charger et on les saute/masque automatiquement côté page.
const isYouTube = /(^|\.)youtube\.com$/.test(location.hostname);

if (isYouTube && ipcRenderer.sendSync('blocking:get-sync')) {
  whenDocumentElementReady(injectYoutubeAdBlock);
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
