const tabsEl = document.getElementById('tabs');
const webviewsEl = document.getElementById('webviews');
const tabTemplate = document.getElementById('tab-template');

const urlInput = document.getElementById('url-input');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const homeBtn = document.getElementById('home-btn');
const newTabBtn = document.getElementById('new-tab-btn');
const securityIcon = document.getElementById('security-icon');
const starBtn = document.getElementById('star-btn');
const progressBar = document.getElementById('progress-bar');
const menuBtn = document.getElementById('menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');
const menuWallpaperChoose = document.getElementById('menu-wallpaper-choose');
const menuWallpaperClear = document.getElementById('menu-wallpaper-clear');
const menuNewIncognito = document.getElementById('menu-new-incognito');
const menuHistory = document.getElementById('menu-history');
const menuToggleBookmarksBar = document.getElementById('menu-toggle-bookmarks-bar');
const menuToggleBlocking = document.getElementById('menu-toggle-blocking');
const menuToggleFingerprint = document.getElementById('menu-toggle-fingerprint');
const bookmarksBar = document.getElementById('bookmarks-bar');
const zoomIndicator = document.getElementById('zoom-indicator');
const incognitoBadge = document.getElementById('incognito-badge');
const readerBtn = document.getElementById('reader-btn');
const readerOverlay = document.getElementById('reader-overlay');
const readerContent = document.getElementById('reader-content');
const readerClose = document.getElementById('reader-close');
const downloadsBtn = document.getElementById('downloads-btn');
const downloadsBadge = document.getElementById('downloads-badge');
const downloadsDropdown = document.getElementById('downloads-dropdown');
const downloadsList = document.getElementById('downloads-list');
const downloadsEmpty = document.getElementById('downloads-empty');
const paletteHint = document.getElementById('palette-hint');
const commandPalette = document.getElementById('command-palette');
const commandPaletteInput = document.getElementById('command-palette-input');
const commandPaletteResults = document.getElementById('command-palette-results');

const LOCAL_PAGES = ['home.html', 'history.html'];
const isLocalPage = (url) => LOCAL_PAGES.some((p) => url.endsWith(p));

let tabs = [];
let activeId = null;
let counter = 0;
let favorites = [];

// --- Incognito ---
if (window.khaos.isIncognito) {
  incognitoBadge.style.display = 'flex';
  document.title = 'Khaos — Navigation privée';
}

function resolveInput(raw) {
  const value = raw.trim();
  if (!value) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  const looksLikeUrl = /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value) && !value.includes(' ');
  if (looksLikeUrl) return 'https://' + value;
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(value);
}

function createTab(url) {
  const id = 'tab-' + (++counter);

  const tabNode = tabTemplate.content.firstElementChild.cloneNode(true);
  tabNode.dataset.id = id;
  tabNode.classList.add('tab-enter');
  tabNode.draggable = true;
  tabsEl.appendChild(tabNode);
  requestAnimationFrame(() => requestAnimationFrame(() => tabNode.classList.remove('tab-enter')));

  const webview = document.createElement('webview');
  webview.dataset.id = id;
  webview.setAttribute('allowpopups', 'true');
  webview.setAttribute('preload', window.khaos.webviewPreloadPath);
  webview.setAttribute('partition', window.khaos.partition);
  webviewsEl.appendChild(webview);
  webview.setAttribute('src', url || 'home.html');

  const tab = { id, tabNode, webview, title: 'Nouvel onglet', url: url || '', zoomLevel: 0 };
  tabs.push(tab);

  tabNode.addEventListener('click', (e) => {
    if (e.target.closest('.tab-close')) return;
    setActive(id);
  });
  tabNode.querySelector('.tab-close').addEventListener('click', () => closeTab(id));
  attachDragHandlers(tabNode, id);

  webview.addEventListener('did-start-loading', () => {
    tabNode.classList.add('loading');
    if (id === activeId) startProgress();
  });
  webview.addEventListener('did-stop-loading', () => {
    tabNode.classList.remove('loading');
    if (id === activeId) finishProgress();
  });

  webview.addEventListener('page-title-updated', (e) => {
    tab.title = e.title;
    tabNode.querySelector('.tab-title').textContent = e.title;
    if (id === activeId) syncStar(tab);

    if (!window.khaos.isIncognito && tab.url && !isLocalPage(tab.url) && /^https?:\/\//.test(tab.url)) {
      window.khaos.history.add({ url: tab.url, title: e.title });
    }
  });

  webview.addEventListener('page-favicon-updated', (e) => {
    if (e.favicons && e.favicons[0]) {
      tabNode.querySelector('.tab-favicon').style.background = 'transparent';
      tabNode.querySelector('.tab-favicon').style.backgroundImage = `url(${e.favicons[0]})`;
      tabNode.querySelector('.tab-favicon').style.backgroundSize = 'cover';
    }
  });

  webview.addEventListener('did-navigate', (e) => {
    tab.url = e.url;
    tab.zoomLevel = 0;
    webview.setZoomLevel(0);
    if (id === activeId) { syncToolbar(tab); syncStar(tab); }
  });
  webview.addEventListener('did-navigate-in-page', (e) => {
    tab.url = e.url;
    if (id === activeId) { syncToolbar(tab); syncStar(tab); }
  });

  webview.addEventListener('new-window', (e) => {
    createTab(e.url);
  });

  webview.addEventListener('did-fail-load', (e) => {
    if (e.errorCode === -3) return; // navigation annulée (ex: remplacée par une autre)
    tab.title = 'Page inaccessible';
    tabNode.querySelector('.tab-title').textContent = tab.title;
  });

  setActive(id);
  return tab;
}

function setActive(id) {
  activeId = id;
  tabs.forEach((t) => {
    const isActive = t.id === id;
    t.tabNode.classList.toggle('active', isActive);
    t.webview.classList.toggle('active', isActive);
  });
  const tab = tabs.find((t) => t.id === id);
  if (tab) { syncToolbar(tab); syncStar(tab); }
}

function syncToolbar(tab) {
  const displayUrl = tab.url && !isLocalPage(tab.url) ? tab.url : '';
  if (document.activeElement !== urlInput) urlInput.value = displayUrl;
  securityIcon.style.color = displayUrl.startsWith('https://') ? '#6e4bff' : '#8d84a3';
  try {
    backBtn.disabled = !tab.webview.canGoBack();
    forwardBtn.disabled = !tab.webview.canGoForward();
  } catch (_) {
    backBtn.disabled = true;
    forwardBtn.disabled = true;
  }
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const [tab] = tabs.splice(idx, 1);

  tab.tabNode.classList.add('tab-exit');
  tab.webview.remove();
  setTimeout(() => tab.tabNode.remove(), 220);

  if (tabs.length === 0) {
    createTab();
    return;
  }
  if (activeId === id) {
    const next = tabs[idx] || tabs[idx - 1] || tabs[0];
    setActive(next.id);
  }
}

function activeTab() {
  return tabs.find((t) => t.id === activeId);
}

// --- Réorganisation des onglets (drag & drop) ---
let draggedId = null;

function attachDragHandlers(tabNode, id) {
  tabNode.addEventListener('dragstart', (e) => {
    draggedId = id;
    tabNode.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  tabNode.addEventListener('dragend', () => {
    tabNode.classList.remove('dragging');
    tabsEl.querySelectorAll('.tab').forEach((n) => n.classList.remove('drag-over-left', 'drag-over-right'));
  });
  tabNode.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (draggedId === id) return;
    const rect = tabNode.getBoundingClientRect();
    const before = e.clientX - rect.left < rect.width / 2;
    tabNode.classList.toggle('drag-over-left', before);
    tabNode.classList.toggle('drag-over-right', !before);
  });
  tabNode.addEventListener('dragleave', () => {
    tabNode.classList.remove('drag-over-left', 'drag-over-right');
  });
  tabNode.addEventListener('drop', (e) => {
    e.preventDefault();
    tabNode.classList.remove('drag-over-left', 'drag-over-right');
    if (draggedId === null || draggedId === id) return;

    const fromIdx = tabs.findIndex((t) => t.id === draggedId);
    const toIdx = tabs.findIndex((t) => t.id === id);
    if (fromIdx === -1 || toIdx === -1) return;

    const rect = tabNode.getBoundingClientRect();
    const before = e.clientX - rect.left < rect.width / 2;

    const [moved] = tabs.splice(fromIdx, 1);
    const insertAt = tabs.findIndex((t) => t.id === id) + (before ? 0 : 1);
    tabs.splice(insertAt, 0, moved);

    if (before) tabsEl.insertBefore(moved.tabNode, tabNode);
    else tabsEl.insertBefore(moved.tabNode, tabNode.nextSibling);

    draggedId = null;
  });
}

// --- Barre de progression ---
let progressTimeout;
function startProgress() {
  clearTimeout(progressTimeout);
  progressBar.style.transition = 'none';
  progressBar.style.width = '0%';
  progressBar.classList.add('active');
  requestAnimationFrame(() => {
    progressBar.style.transition = '';
    progressBar.style.width = '25%';
    progressTimeout = setTimeout(() => { progressBar.style.width = '65%'; }, 350);
  });
}
function finishProgress() {
  clearTimeout(progressTimeout);
  progressBar.style.width = '100%';
  setTimeout(() => {
    progressBar.classList.remove('active');
    setTimeout(() => { progressBar.style.width = '0%'; }, 300);
  }, 200);
}

// --- Barre d'adresse ---
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const url = resolveInput(urlInput.value);
    if (url) activeTab().webview.src = url;
    urlInput.blur();
  }
});
urlInput.addEventListener('focus', () => urlInput.select());

// --- Navigation ---
backBtn.addEventListener('click', () => activeTab()?.webview.goBack());
forwardBtn.addEventListener('click', () => activeTab()?.webview.goForward());
reloadBtn.addEventListener('click', () => activeTab()?.webview.reload());
homeBtn.addEventListener('click', () => { activeTab().webview.src = 'home.html'; });
newTabBtn.addEventListener('click', () => createTab());

// --- Contrôles de fenêtre ---
document.getElementById('min-btn').addEventListener('click', () => window.khaos.minimize());
document.getElementById('max-btn').addEventListener('click', () => window.khaos.maximizeToggle());
document.getElementById('close-btn').addEventListener('click', () => window.khaos.close());

// --- Favoris ---
function syncStar(tab) {
  const bookmarked = !isLocalPage(tab.url || '') && favorites.some((f) => f.url === tab.url);
  starBtn.classList.toggle('active', bookmarked);
}

function renderBookmarksBar() {
  bookmarksBar.innerHTML = '';
  favorites.forEach((f) => {
    const chip = document.createElement('div');
    chip.className = 'bookmark-chip';
    chip.title = f.url;
    chip.innerHTML = `
      <span class="dot"></span>
      <span class="label">${f.title}</span>
      <span class="remove">
        <svg width="9" height="9" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.3"/></svg>
      </span>
    `;
    chip.addEventListener('click', (e) => {
      if (e.target.closest('.remove')) return;
      activeTab().webview.src = f.url;
    });
    chip.querySelector('.remove').addEventListener('click', async (e) => {
      e.stopPropagation();
      favorites = await window.khaos.favorites.remove(f.url);
      renderBookmarksBar();
      syncStar(activeTab());
    });
    bookmarksBar.appendChild(chip);
  });
}

starBtn.addEventListener('click', async () => {
  const tab = activeTab();
  if (!tab || !tab.url || isLocalPage(tab.url)) return;
  const already = favorites.some((f) => f.url === tab.url);
  if (already) {
    favorites = await window.khaos.favorites.remove(tab.url);
  } else {
    favorites = await window.khaos.favorites.add({ url: tab.url, title: tab.title });
    bookmarksBar.classList.add('visible');
    localStorage.setItem('khaos:bookmarksBarVisible', '1');
  }
  syncStar(tab);
  renderBookmarksBar();
});

window.khaos.favorites.list().then((list) => {
  favorites = list;
  renderBookmarksBar();
  if (localStorage.getItem('khaos:bookmarksBarVisible') === '1') {
    bookmarksBar.classList.add('visible');
  }
});

// --- Raccourcis clavier ---
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 't') { e.preventDefault(); createTab(); }
  if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); if (activeId) closeTab(activeId); }
  if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); urlInput.focus(); }
  if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); activeTab()?.webview.reload(); }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); starBtn.click(); }
  if (mod && e.key.toLowerCase() === 'h') { e.preventDefault(); createTab('history.html'); }
  if (mod && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); window.khaos.newIncognitoWindow(); }
  if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); adjustZoom(0.5); }
  if (mod && e.key === '-') { e.preventDefault(); adjustZoom(-0.5); }
  if (mod && e.key === '0') { e.preventDefault(); setZoom(0); }
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
});

// --- Zoom ---
let zoomIndicatorTimeout;
function setZoom(level) {
  const tab = activeTab();
  if (!tab) return;
  tab.zoomLevel = Math.max(-4, Math.min(4, level));
  tab.webview.setZoomLevel(tab.zoomLevel);
  showZoomIndicator(tab.zoomLevel);
}
function adjustZoom(delta) {
  const tab = activeTab();
  if (!tab) return;
  setZoom(tab.zoomLevel + delta);
}
function showZoomIndicator(level) {
  const percent = Math.round(100 * Math.pow(1.2, level));
  zoomIndicator.textContent = percent + '%';
  zoomIndicator.classList.add('visible');
  clearTimeout(zoomIndicatorTimeout);
  zoomIndicatorTimeout = setTimeout(() => zoomIndicator.classList.remove('visible'), 1400);
}

// --- Menu déroulant ---
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle('open');
});
document.addEventListener('click', () => menuDropdown.classList.remove('open'));

menuNewIncognito.addEventListener('click', () => {
  menuDropdown.classList.remove('open');
  window.khaos.newIncognitoWindow();
});
menuHistory.addEventListener('click', () => {
  menuDropdown.classList.remove('open');
  createTab('history.html');
});
menuToggleBookmarksBar.addEventListener('click', () => {
  menuDropdown.classList.remove('open');
  const visible = bookmarksBar.classList.toggle('visible');
  localStorage.setItem('khaos:bookmarksBarVisible', visible ? '1' : '0');
});

// --- Fond d'écran (vit uniquement dans la page d'accueil, jamais dans la chrome) ---
function broadcastWallpaperChange(url) {
  tabs.forEach((t) => {
    if (isLocalPage(t.url || '') && (t.url || '').endsWith('home.html')) {
      t.webview.send('wallpaper:changed', url);
    }
  });
}

menuWallpaperChoose.addEventListener('click', async () => {
  menuDropdown.classList.remove('open');
  const url = await window.khaos.wallpaper.choose();
  if (url) broadcastWallpaperChange(url);
});

menuWallpaperClear.addEventListener('click', async () => {
  menuDropdown.classList.remove('open');
  await window.khaos.wallpaper.clear();
  broadcastWallpaperChange(null);
});

// --- Blocage de traqueurs ---
function syncBlockingLabel(enabled) {
  menuToggleBlocking.textContent = 'Bloqueur de traqueurs : ' + (enabled ? 'activé' : 'désactivé');
}
window.khaos.blocking.get().then(syncBlockingLabel);
menuToggleBlocking.addEventListener('click', async () => {
  menuDropdown.classList.remove('open');
  const enabled = await window.khaos.blocking.toggle();
  syncBlockingLabel(enabled);
});

// --- Anti-fingerprinting ---
function syncFingerprintLabel(enabled) {
  menuToggleFingerprint.textContent = 'Anti-fingerprinting : ' + (enabled ? 'activé' : 'désactivé');
}
window.khaos.fingerprint.get().then(syncFingerprintLabel);
menuToggleFingerprint.addEventListener('click', async () => {
  menuDropdown.classList.remove('open');
  const enabled = await window.khaos.fingerprint.toggle();
  syncFingerprintLabel(enabled);
});

// --- Téléchargements ---
function formatBytes(n) {
  if (!n) return '0 Ko';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return n.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

function renderDownloads(list) {
  downloadsEmpty.style.display = list.length ? 'none' : 'block';
  downloadsList.innerHTML = '';
  const active = list.filter((d) => d.state === 'progressing').length;
  downloadsBadge.style.display = active ? 'block' : 'none';
  downloadsBadge.textContent = active;

  list.forEach((d) => {
    const percent = d.totalBytes ? Math.round((d.receivedBytes / d.totalBytes) * 100) : 0;
    const item = document.createElement('div');
    item.className = 'download-item';
    const isDone = d.state === 'completed';
    item.innerHTML = `
      <div class="download-name">${d.filename}</div>
      ${!isDone ? `<div class="download-track"><div class="download-fill" style="width:${percent}%"></div></div>` : ''}
      <div class="download-meta">
        <span>${isDone ? formatBytes(d.receivedBytes) : percent + '%'}</span>
        <span class="download-actions">
          ${isDone ? '<button data-action="open">Ouvrir</button><button data-action="folder">Dossier</button>' : ''}
        </span>
      </div>
    `;
    const openBtn = item.querySelector('[data-action="open"]');
    const folderBtn = item.querySelector('[data-action="folder"]');
    if (openBtn) openBtn.addEventListener('click', () => window.khaos.downloads.openFile(d.savePath));
    if (folderBtn) folderBtn.addEventListener('click', () => window.khaos.downloads.openFolder(d.savePath));
    downloadsList.appendChild(item);
  });
}

window.khaos.downloads.list().then(renderDownloads);
window.khaos.downloads.onChanged(renderDownloads);

downloadsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  downloadsDropdown.classList.toggle('open');
});
document.addEventListener('click', () => downloadsDropdown.classList.remove('open'));

// --- Mode lecture ---
const READER_EXTRACT_SCRIPT = `(() => {
  function textLen(el) { return (el.innerText || '').length; }
  let candidates = Array.from(document.querySelectorAll('article, main, [role=main], .post, .article, #content, .entry-content'));
  if (!candidates.length) candidates = Array.from(document.querySelectorAll('div, section'));
  let best = null, bestScore = 0;
  for (const el of candidates) {
    const score = textLen(el);
    if (score > bestScore) { bestScore = score; best = el; }
  }
  if (!best || bestScore < 200) return null;
  const clone = best.cloneNode(true);
  clone.querySelectorAll('script,style,nav,aside,form,button,iframe,svg,noscript,header,footer').forEach((n) => n.remove());
  return { title: document.title, html: clone.innerHTML };
})()`;

function sanitizeReaderHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,iframe,object,embed,form,button,input,link,meta').forEach((n) => n.remove());
  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const isEventAttr = /^on/i.test(attr.name);
      const isJsHref = attr.name === 'href' && /^\s*javascript:/i.test(attr.value);
      if (isEventAttr || isJsHref || attr.name === 'style') el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML;
}

readerBtn.addEventListener('click', async () => {
  const tab = activeTab();
  if (!tab || !tab.url || isLocalPage(tab.url)) return;
  const result = await tab.webview.executeJavaScript(READER_EXTRACT_SCRIPT, true).catch(() => null);
  if (!result) return;
  readerContent.innerHTML = `<h1>${result.title}</h1>` + sanitizeReaderHtml(result.html);
  readerOverlay.classList.add('open');
});

readerClose.addEventListener('click', () => readerOverlay.classList.remove('open'));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && readerOverlay.classList.contains('open')) {
    readerOverlay.classList.remove('open');
  }
});

// --- Palette de commandes (Ctrl/Cmd+K) ---
const PALETTE_ACTIONS = [
  { label: 'Nouvel onglet', hint: 'Ctrl+T', run: () => createTab() },
  { label: 'Nouvelle fenêtre privée', hint: 'Ctrl+Shift+N', run: () => window.khaos.newIncognitoWindow() },
  { label: 'Ouvrir l\'historique', hint: 'Ctrl+H', run: () => createTab('history.html') },
  { label: 'Basculer le bloqueur de traqueurs', run: () => menuToggleBlocking.click() },
  { label: 'Basculer l\'anti-fingerprinting', run: () => menuToggleFingerprint.click() },
  { label: 'Changer le fond d\'écran…', run: () => menuWallpaperChoose.click() },
  { label: 'Mode lecture sur cet onglet', run: () => readerBtn.click() },
  { label: 'Aller à l\'accueil', hint: 'Ctrl+Shift+H', run: () => { if (activeTab()) activeTab().webview.src = 'home.html'; } }
];

let paletteItems = [];
let paletteSelected = 0;

function paletteIcon(svgInner) {
  return `<div class="cp-icon"><svg width="13" height="13" viewBox="0 0 16 16">${svgInner}</svg></div>`;
}
const ICONS = {
  tab: paletteIcon('<circle cx="8" cy="8" r="3" fill="currentColor"/>'),
  action: paletteIcon('<path d="M9 1L2.5 9.5h4L7 15l6.5-8.5h-4z" fill="currentColor"/>'),
  favorite: paletteIcon('<path d="M8 1.5l2 4.2 4.5.6-3.3 3.2.8 4.5L8 11.8l-4 2.2.8-4.5L1.5 6.3l4.5-.6z" fill="currentColor"/>'),
  history: paletteIcon('<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3.3l2.2 1.3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>')
};

async function buildPaletteItems(query) {
  const q = query.trim().toLowerCase();
  const items = [];

  const matchingTabs = tabs.filter((t) => !q || t.title.toLowerCase().includes(q) || (t.url || '').toLowerCase().includes(q));
  matchingTabs.slice(0, 6).forEach((t) => {
    items.push({
      group: 'Onglets ouverts', icon: ICONS.tab,
      title: t.title, subtitle: isLocalPage(t.url || '') ? '' : t.url,
      run: () => setActive(t.id)
    });
  });

  const matchingActions = PALETTE_ACTIONS.filter((a) => !q || a.label.toLowerCase().includes(q));
  matchingActions.slice(0, q ? 6 : 4).forEach((a) => {
    items.push({ group: 'Actions', icon: ICONS.action, title: a.label, subtitle: a.hint || '', run: a.run });
  });

  if (q) {
    const matchingFavorites = favorites.filter((f) => f.title.toLowerCase().includes(q) || f.url.toLowerCase().includes(q));
    matchingFavorites.slice(0, 5).forEach((f) => {
      items.push({
        group: 'Favoris', icon: ICONS.favorite, title: f.title, subtitle: f.url,
        run: () => { activeTab().webview.src = f.url; }
      });
    });

    const historyResults = await window.khaos.history.list(q).catch(() => []);
    historyResults.slice(0, 6).forEach((h) => {
      items.push({
        group: 'Historique', icon: ICONS.history, title: h.title, subtitle: h.url,
        run: () => { activeTab().webview.src = h.url; }
      });
    });
  }

  return items;
}

function renderPalette(items) {
  paletteItems = items;
  paletteSelected = 0;
  commandPaletteResults.innerHTML = '';

  if (!items.length) {
    commandPaletteResults.innerHTML = '<div class="cp-empty">Aucun résultat</div>';
    return;
  }

  let lastGroup = null;
  items.forEach((item, i) => {
    if (item.group !== lastGroup) {
      const label = document.createElement('div');
      label.className = 'cp-group-label';
      label.textContent = item.group;
      commandPaletteResults.appendChild(label);
      lastGroup = item.group;
    }
    const row = document.createElement('div');
    row.className = 'cp-item' + (i === 0 ? ' selected' : '');
    row.dataset.index = i;
    row.innerHTML = `${item.icon}<div class="cp-text"><div class="cp-title">${item.title}</div>${item.subtitle ? `<div class="cp-subtitle">${item.subtitle}</div>` : ''}</div>`;
    row.addEventListener('click', () => runPaletteItem(i));
    row.addEventListener('mousemove', () => setPaletteSelected(i));
    commandPaletteResults.appendChild(row);
  });
}

function setPaletteSelected(i) {
  paletteSelected = i;
  commandPaletteResults.querySelectorAll('.cp-item').forEach((el) => {
    el.classList.toggle('selected', Number(el.dataset.index) === i);
  });
  const el = commandPaletteResults.querySelector(`.cp-item[data-index="${i}"]`);
  if (el) el.scrollIntoView({ block: 'nearest' });
}

function runPaletteItem(i) {
  const item = paletteItems[i];
  if (!item) return;
  closePalette();
  item.run();
}

let paletteDebounce;
async function refreshPalette() {
  const items = await buildPaletteItems(commandPaletteInput.value);
  renderPalette(items);
}

function openPalette() {
  commandPalette.classList.add('open');
  commandPaletteInput.value = '';
  commandPaletteInput.focus();
  refreshPalette();
}
function closePalette() {
  commandPalette.classList.remove('open');
}

paletteHint.addEventListener('click', openPalette);
commandPalette.addEventListener('mousedown', (e) => {
  if (e.target === commandPalette) closePalette();
});

commandPaletteInput.addEventListener('input', () => {
  clearTimeout(paletteDebounce);
  paletteDebounce = setTimeout(refreshPalette, 100);
});

commandPalette.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); setPaletteSelected(Math.min(paletteSelected + 1, paletteItems.length - 1)); }
  if (e.key === 'ArrowUp') { e.preventDefault(); setPaletteSelected(Math.max(paletteSelected - 1, 0)); }
  if (e.key === 'Enter') { e.preventDefault(); runPaletteItem(paletteSelected); }
});

createTab();
