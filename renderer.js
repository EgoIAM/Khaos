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
const progressBar = document.getElementById('progress-bar');
const menuBtn = document.getElementById('menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');
const menuWallpaperChoose = document.getElementById('menu-wallpaper-choose');
const menuWallpaperClear = document.getElementById('menu-wallpaper-clear');

let tabs = [];
let activeId = null;
let counter = 0;

function resolveInput(raw) {
  const value = raw.trim();
  if (!value) return null;
  const looksLikeUrl = /^https?:\/\//i.test(value) ||
    (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value) && !value.includes(' '));
  if (looksLikeUrl) {
    return /^https?:\/\//i.test(value) ? value : 'https://' + value;
  }
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(value);
}

function createTab(url) {
  const id = 'tab-' + (++counter);

  const tabNode = tabTemplate.content.firstElementChild.cloneNode(true);
  tabNode.dataset.id = id;
  tabNode.classList.add('tab-enter');
  tabsEl.appendChild(tabNode);
  requestAnimationFrame(() => requestAnimationFrame(() => tabNode.classList.remove('tab-enter')));

  const webview = document.createElement('webview');
  webview.dataset.id = id;
  webview.setAttribute('allowpopups', 'true');
  webview.setAttribute('preload', window.khaos.webviewPreloadPath);
  webviewsEl.appendChild(webview);
  webview.setAttribute('src', url || 'home.html');

  const tab = { id, tabNode, webview, title: 'Nouvel onglet', url: url || '' };
  tabs.push(tab);

  tabNode.addEventListener('click', (e) => {
    if (e.target.closest('.tab-close')) return;
    setActive(id);
  });
  tabNode.querySelector('.tab-close').addEventListener('click', () => closeTab(id));

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
    if (id === activeId) syncToolbar(tab);
  });
  webview.addEventListener('did-navigate-in-page', (e) => {
    tab.url = e.url;
    if (id === activeId) syncToolbar(tab);
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
  if (tab) syncToolbar(tab);
}

function syncToolbar(tab) {
  const displayUrl = tab.url && !tab.url.endsWith('home.html') ? tab.url : '';
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

// --- Raccourcis clavier ---
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 't') { e.preventDefault(); createTab(); }
  if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); if (activeId) closeTab(activeId); }
  if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); urlInput.focus(); }
  if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); activeTab()?.webview.reload(); }
});

// --- Menu déroulant ---
menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle('open');
});
document.addEventListener('click', () => menuDropdown.classList.remove('open'));

// --- Fond d'écran (appliqué aussi à la chrome du navigateur) ---
function applyWallpaper(url) {
  const layer = document.getElementById('wallpaper-layer');
  if (url) {
    layer.style.backgroundImage = `url("${url}")`;
    document.body.classList.add('has-wallpaper');
  } else {
    document.body.classList.remove('has-wallpaper');
    layer.style.backgroundImage = '';
  }
}

window.khaos.wallpaper.get().then(applyWallpaper);

menuWallpaperChoose.addEventListener('click', async () => {
  menuDropdown.classList.remove('open');
  const url = await window.khaos.wallpaper.choose();
  if (url) applyWallpaper(url);
});

menuWallpaperClear.addEventListener('click', async () => {
  menuDropdown.classList.remove('open');
  await window.khaos.wallpaper.clear();
  applyWallpaper(null);
});

createTab();
