const { app, BrowserWindow, ipcMain, session, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const windows = new Set();
const preparedPartitions = new Set();
const downloadsByPartition = new Map(); // partition -> [{id, filename, receivedBytes, totalBytes, state, savePath}]

// --- Blocage de traqueurs/publicités (liste courte, non exhaustive) ---
const TRACKER_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'adnxs.com', 'scorecardresearch.com', 'criteo.com', 'criteo.net',
  'taboola.com', 'outbrain.com', 'amazon-adsystem.com', 'adsafeprotected.com',
  'moatads.com', 'hotjar.com', 'connect.facebook.net', 'analytics.tiktok.com',
  'ads.pinterest.com', 'ads.linkedin.com', 'adservice.google.com'
];

// --- Blocage des appels publicitaires spécifiques à YouTube ---
// (les vidéos publicitaires elles-mêmes transitent par le même CDN que le
// contenu normal — c'est le script injecté côté page qui s'en charge, ici on
// coupe les requêtes de métadonnées/traçage publicitaire)
const YOUTUBE_AD_PATTERNS = [
  '/pagead/', '/api/stats/ads', '/ptracking', 'youtube.com/csi_204',
  'youtube.com/api/stats/qoe', 'doubleclick.net', 'googlesyndication.com',
  '/get_midroll_info', 'video-ad-stats'
];

// --- Stockage JSON simple (userData) ---
function dataPath(name) {
  return path.join(app.getPath('userData'), name);
}

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(dataPath(name), 'utf-8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(name, data) {
  fs.writeFileSync(dataPath(name), JSON.stringify(data, null, 2));
}

// --- Fond d'écran ---
function currentWallpaperUrl() {
  const settings = readJson('settings.json', {});
  if (!settings.wallpaperFile) return null;
  const fullPath = path.join(app.getPath('userData'), 'wallpaper', settings.wallpaperFile);
  if (!fs.existsSync(fullPath)) return null;
  return 'file://' + fullPath.replace(/\\/g, '/');
}

// --- Blocage de traqueurs ---
function isBlockingEnabled() {
  const settings = readJson('settings.json', {});
  return settings.blockingEnabled !== false; // activé par défaut
}

// --- Téléchargements ---
function broadcastDownloads(partition) {
  const list = downloadsByPartition.get(partition) || [];
  for (const win of windows) {
    if (win.khaosPartition === partition && !win.isDestroyed()) {
      win.webContents.send('downloads:changed', list);
    }
  }
}

// --- Prépare une session (partition) : blocage + téléchargements ---
function prepareSession(partition) {
  if (preparedPartitions.has(partition)) return;
  preparedPartitions.add(partition);

  const sess = session.fromPartition(partition);

  sess.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const blocked = isBlockingEnabled() &&
      (TRACKER_DOMAINS.some((d) => details.url.includes(d)) ||
       YOUTUBE_AD_PATTERNS.some((p) => details.url.includes(p)));
    callback({ cancel: blocked });
  });

  sess.on('will-download', (_event, item) => {
    const id = crypto.randomBytes(6).toString('hex');
    const entry = {
      id,
      filename: item.getFilename(),
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      state: 'progressing',
      savePath: null
    };
    const list = downloadsByPartition.get(partition) || [];
    list.unshift(entry);
    downloadsByPartition.set(partition, list.slice(0, 100));
    broadcastDownloads(partition);

    item.on('updated', (_e, state) => {
      entry.receivedBytes = item.getReceivedBytes();
      entry.totalBytes = item.getTotalBytes();
      entry.state = state;
      entry.savePath = item.getSavePath();
      broadcastDownloads(partition);
    });

    item.once('done', (_e, state) => {
      entry.state = state;
      entry.receivedBytes = item.getReceivedBytes();
      entry.savePath = item.getSavePath();
      broadcastDownloads(partition);
    });
  });
}

// --- Fenêtres ---
function createWindow({ incognito = false } = {}) {
  const partition = incognito ? 'incognito-' + crypto.randomBytes(6).toString('hex') : 'persist:khaos-main';
  prepareSession(partition);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 760,
    minHeight: 480,
    frame: false,
    backgroundColor: '#0c0a10',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false
    }
  });

  win.khaosPartition = partition;
  win.loadFile('index.html', { query: { incognito: incognito ? '1' : '0', partition } });
  windows.add(win);
  win.on('closed', () => {
    windows.delete(win);
    if (incognito) {
      downloadsByPartition.delete(partition);
      preparedPartitions.delete(partition);
    }
  });

  win.on('maximize', () => win.webContents.send('window:maximized', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized', false));

  return win;
}

app.whenReady().then(() => {
  // Bloque les permissions intrusives par défaut (notifications, géoloc, etc.)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['clipboard-read', 'fullscreen'];
    callback(allowed.includes(permission));
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- Contrôles de la fenêtre (titlebar custom) ---
ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('window:maximize-toggle', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.on('window:new-incognito', () => createWindow({ incognito: true }));

// --- Fond d'écran ---
ipcMain.handle('wallpaper:get', () => currentWallpaperUrl());

ipcMain.handle('wallpaper:choose', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Choisir un fond d’écran',
    filters: [{ name: 'Images et GIF', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const sourcePath = result.filePaths[0];
  const ext = path.extname(sourcePath);
  const wallpaperDir = path.join(app.getPath('userData'), 'wallpaper');
  fs.mkdirSync(wallpaperDir, { recursive: true });

  // Nettoie les anciens fonds d'écran avant de copier le nouveau
  for (const f of fs.readdirSync(wallpaperDir)) fs.unlinkSync(path.join(wallpaperDir, f));

  const fileName = 'current' + ext;
  fs.copyFileSync(sourcePath, path.join(wallpaperDir, fileName));
  writeJson('settings.json', { ...readJson('settings.json', {}), wallpaperFile: fileName });

  return currentWallpaperUrl();
});

ipcMain.handle('wallpaper:clear', () => {
  const wallpaperDir = path.join(app.getPath('userData'), 'wallpaper');
  if (fs.existsSync(wallpaperDir)) {
    for (const f of fs.readdirSync(wallpaperDir)) fs.unlinkSync(path.join(wallpaperDir, f));
  }
  const settings = readJson('settings.json', {});
  delete settings.wallpaperFile;
  writeJson('settings.json', settings);
  return null;
});

// --- Favoris ---
ipcMain.handle('favorites:list', () => readJson('favorites.json', []));

ipcMain.handle('favorites:add', (_e, { url, title }) => {
  const favorites = readJson('favorites.json', []);
  if (!favorites.some((f) => f.url === url)) {
    favorites.push({ url, title: title || url, addedAt: Date.now() });
    writeJson('favorites.json', favorites);
  }
  return favorites;
});

ipcMain.handle('favorites:remove', (_e, url) => {
  const favorites = readJson('favorites.json', []).filter((f) => f.url !== url);
  writeJson('favorites.json', favorites);
  return favorites;
});

// --- Historique ---
const MAX_HISTORY = 1500;

ipcMain.handle('history:add', (_e, { url, title }) => {
  const history = readJson('history.json', []);
  history.unshift({ url, title: title || url, visitedAt: Date.now() });
  writeJson('history.json', history.slice(0, MAX_HISTORY));
});

ipcMain.handle('history:list', (_e, query) => {
  const history = readJson('history.json', []);
  if (!query) return history;
  const q = query.toLowerCase();
  return history.filter((h) => h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q));
});

ipcMain.handle('history:clear', () => {
  writeJson('history.json', []);
});

// --- Blocage de traqueurs ---
ipcMain.handle('blocking:get', () => isBlockingEnabled());
ipcMain.handle('blocking:toggle', () => {
  const settings = readJson('settings.json', {});
  settings.blockingEnabled = !isBlockingEnabled();
  writeJson('settings.json', settings);
  return settings.blockingEnabled;
});

// --- Téléchargements ---
ipcMain.handle('downloads:list', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  return downloadsByPartition.get(win?.khaosPartition) || [];
});
ipcMain.handle('downloads:openFile', (_e, savePath) => savePath && shell.openPath(savePath));
ipcMain.handle('downloads:openFolder', (_e, savePath) => savePath && shell.showItemInFolder(savePath));
