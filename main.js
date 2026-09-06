const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// --- Fond d'écran ---
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'));
  } catch (_) {
    return {};
  }
}

function writeSettings(settings) {
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

function currentWallpaperUrl() {
  const settings = readSettings();
  if (!settings.wallpaperFile) return null;
  const fullPath = path.join(app.getPath('userData'), 'wallpaper', settings.wallpaperFile);
  if (!fs.existsSync(fullPath)) return null;
  return 'file://' + fullPath.replace(/\\/g, '/');
}

function createWindow() {
  mainWindow = new BrowserWindow({
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

  mainWindow.loadFile('index.html');

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false));
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
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize-toggle', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow.close());

// --- Fond d'écran ---
ipcMain.handle('wallpaper:get', () => currentWallpaperUrl());

ipcMain.handle('wallpaper:choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
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
  writeSettings({ ...readSettings(), wallpaperFile: fileName });

  return currentWallpaperUrl();
});

ipcMain.handle('wallpaper:clear', () => {
  const wallpaperDir = path.join(app.getPath('userData'), 'wallpaper');
  if (fs.existsSync(wallpaperDir)) {
    for (const f of fs.readdirSync(wallpaperDir)) fs.unlinkSync(path.join(wallpaperDir, f));
  }
  const settings = readSettings();
  delete settings.wallpaperFile;
  writeSettings(settings);
  return null;
});
