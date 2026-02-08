const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, ipcMain, webContents, nativeTheme, shell } = require('electron');
const path = require('path');
const store = require('./store');
const { randomUUID } = require('crypto');
const updater = require('./updater');
const { initTelemetry } = require('./telemetry');

// CSS to inject into OpenClaw webview to create chat-only view
const OPENCLAW_CSS = `
  :root, :host {
    --shell-nav-width: 0px !important;
    --shell-topbar-height: 0px !important;
  }
  .shell {
    --shell-nav-width: 0px !important;
    --shell-topbar-height: 0px !important;
    grid-template-columns: 0px minmax(0,1fr) !important;
    grid-template-rows: 0px 1fr !important;
    grid-template-areas: "content" "content" !important;
  }
  .nav { display: none !important; }
  .topbar { display: none !important; }
  .content-header { display: none !important; }
  .content {
    padding: 0 4px !important;
    gap: 0 !important;
    grid-area: 1 / 1 / -1 / -1 !important;
  }
  .chat-controls { display: none !important; }
  .chat-compose { padding: 8px 4px 4px !important; }
  .chat-compose__row { gap: 6px !important; }
  .chat-compose__field textarea {
    min-height: 40px !important;
    width: 100% !important;
  }
  .chat-compose__actions .btn:not(.primary) { display: none !important; }
  .chat-compose__actions .btn .btn-kbd { display: none !important; }
  .chat-compose__actions .btn { padding: 0 10px !important; }
  .chat-group-messages { max-width: 100% !important; }
  .chat-group { margin-right: 4px !important; margin-left: 4px !important; }
  /* Hide tool call/result cards */
  .chat-tool-card { display: none !important; }
`;

const OPENCLAW_JS = `
(function() {
  const css = ${JSON.stringify(OPENCLAW_CSS)};
  function injectCSS(root) {
    if (!root || root.querySelector('[data-fl]')) return;
    const s = document.createElement('style');
    s.setAttribute('data-fl', '1');
    s.textContent = css;
    root.appendChild(s);
  }
  function inject() {
    injectCSS(document.head);
    document.documentElement.style.setProperty('--shell-nav-width', '0px', 'important');
    document.documentElement.style.setProperty('--shell-topbar-height', '0px', 'important');
    const app = document.querySelector('openclaw-app');
    if (app && app.shadowRoot) {
      injectCSS(app.shadowRoot);
      const shell = app.shadowRoot.querySelector('.shell');
      if (shell) shell.classList.add('shell--nav-collapsed');
      app.shadowRoot.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) injectCSS(el.shadowRoot);
      });
    }
  }
  inject();
  let n = 0;
  const iv = setInterval(() => { inject(); if (++n > 60) clearInterval(iv); }, 300);
  const ob = new MutationObserver(inject);
  if (document.body) ob.observe(document.body, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => ob.observe(document.body, { childList: true, subtree: true }));
  setTimeout(() => { ob.disconnect(); clearInterval(iv); }, 30000);
})();
`;

let mainWindow = null;
let settingsWindow = null;
let sessionWindows = new Map(); // Map of sessionId -> BrowserWindow
let tray = null;

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('get-gateways', () => store.get('gateways'));

ipcMain.handle('add-gateway', (_e, { name, url, token }) => {
  const gateways = store.get('gateways');
  const gw = { id: randomUUID(), name, url, token: token || '' };
  gateways.push(gw);
  store.set('gateways', gateways);
  // If first gateway, auto-activate
  if (!store.get('activeGateway')) store.set('activeGateway', gw.id);
  return gw;
});

ipcMain.handle('update-gateway', (_e, { id, name, url, token }) => {
  const gateways = store.get('gateways').map(g =>
    g.id === id ? { ...g, name, url, token: token || '' } : g
  );
  store.set('gateways', gateways);
  return gateways;
});

ipcMain.handle('delete-gateway', (_e, id) => {
  const gateways = store.get('gateways').filter(g => g.id !== id);
  store.set('gateways', gateways);
  if (store.get('activeGateway') === id) {
    store.set('activeGateway', gateways.length ? gateways[0].id : null);
  }
  return gateways;
});

ipcMain.handle('get-active-gateway', () => {
  const id = store.get('activeGateway');
  console.log('[Main] get-active-gateway:', id);
  return id;
});

ipcMain.handle('set-active-gateway', (_e, id) => {
  console.log('[Main] set-active-gateway:', id);
  const gateways = store.get('gateways');
  const gw = gateways.find(g => g.id === id);
  console.log('[Main] Gateway details:', gw?.name, gw?.url);
  store.set('activeGateway', id);
  return id;
});

ipcMain.handle('show-main-window', () => {
  // Close settings if open (mutually exclusive)
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.handle('open-external', (_e, url) => {
  shell.openExternal(url);
});

ipcMain.handle('get-settings', () => ({
  hotkey: store.get('hotkey'),
  nextAgentHotkey: store.get('nextAgentHotkey'),
  prevAgentHotkey: store.get('prevAgentHotkey'),
  toggleThemeHotkey: store.get('toggleThemeHotkey'),
}));

ipcMain.handle('update-settings', (_e, settings) => {
  let needsReregister = false;
  
  if (settings.hotkey && settings.hotkey !== store.get('hotkey')) {
    store.set('hotkey', settings.hotkey);
    needsReregister = true;
  }
  if (settings.nextAgentHotkey && settings.nextAgentHotkey !== store.get('nextAgentHotkey')) {
    store.set('nextAgentHotkey', settings.nextAgentHotkey);
    needsReregister = true;
  }
  if (settings.prevAgentHotkey && settings.prevAgentHotkey !== store.get('prevAgentHotkey')) {
    store.set('prevAgentHotkey', settings.prevAgentHotkey);
    needsReregister = true;
  }
  if (settings.toggleThemeHotkey && settings.toggleThemeHotkey !== store.get('toggleThemeHotkey')) {
    store.set('toggleThemeHotkey', settings.toggleThemeHotkey);
    needsReregister = true;
  }
  
  if (needsReregister) {
    registerHotkey();
  }
  
  return {
    hotkey: store.get('hotkey'),
    nextAgentHotkey: store.get('nextAgentHotkey'),
    prevAgentHotkey: store.get('prevAgentHotkey'),
    toggleThemeHotkey: store.get('toggleThemeHotkey'),
  };
});

ipcMain.handle('open-settings', (_e, opts) => {
  openSettings(opts);
});

ipcMain.handle('ping-gateway', async (_e, url) => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(url, { signal: ctrl.signal, method: 'HEAD' });
    clearTimeout(t);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
});

// ── Theme Support ─────────────────────────────────────────────

ipcMain.handle('get-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

// ── Session Management ────────────────────────────────────────

// Extract session name from session key
function extractSessionName(sessionKey) {
  if (!sessionKey) return 'main';
  
  // Handle patterns like "agent:main:main" -> "main"
  const parts = sessionKey.split(':');
  if (parts.length >= 3 && parts[0] === 'agent') {
    return parts[parts.length - 1]; // Return last part
  }
  
  // Handle other patterns, default to last part after ':'
  const lastPart = parts[parts.length - 1];
  return lastPart || 'session';
}

// Fetch sessions from a gateway
async function fetchGatewaySessions(gatewayUrl) {
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    
    const response = await fetch(`${gatewayUrl}/api/sessions`, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.log(`[Sessions] Gateway ${gatewayUrl} sessions API returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    // Expect sessions to be an array of strings (session keys)
    if (!Array.isArray(data)) {
      console.log(`[Sessions] Gateway ${gatewayUrl} returned non-array:`, typeof data);
      return [];
    }
    
    return data.map(sessionKey => ({
      id: sessionKey,
      name: extractSessionName(sessionKey),
      url: `${gatewayUrl}/chat?session=${sessionKey}`
    }));
    
  } catch (error) {
    console.log(`[Sessions] Failed to fetch sessions from ${gatewayUrl}:`, error.message);
    return [];
  }
}

// Update sessions for all gateways
async function refreshAllSessions() {
  const gateways = store.get('gateways');
  const allSessions = {};
  
  for (const gateway of gateways) {
    console.log(`[Sessions] Fetching sessions for gateway ${gateway.name}...`);
    const sessions = await fetchGatewaySessions(gateway.url);
    allSessions[gateway.id] = sessions;
    console.log(`[Sessions] Found ${sessions.length} sessions for ${gateway.name}:`, sessions.map(s => s.name));
  }
  
  store.set('sessions', allSessions);
  return allSessions;
}

// Create a session window
function createSessionWindow(gatewayId, session) {
  const gateway = store.get('gateways').find(g => g.id === gatewayId);
  if (!gateway) {
    console.error(`[Sessions] Gateway ${gatewayId} not found`);
    return null;
  }
  
  // Check if window already exists
  if (sessionWindows.has(session.id)) {
    const existingWindow = sessionWindows.get(session.id);
    if (!existingWindow.isDestroyed()) {
      existingWindow.show();
      existingWindow.focus();
      return existingWindow;
    } else {
      sessionWindows.delete(session.id);
    }
  }
  
  // Get saved bounds or default offset from main window
  const savedBounds = store.get('sessionWindowBounds')[session.id];
  const mainBounds = store.get('windowBounds');
  
  const bounds = savedBounds || {
    x: (mainBounds.x || 100) + 50,
    y: (mainBounds.y || 100) + 50,
    width: mainBounds.width || 400,
    height: mainBounds.height || 600
  };
  
  const sessionWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    transparent: false,
    visibleOnAllWorkspaces: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-session.js'),
      webviewTag: true,
    }
  });
  
  if (process.platform === 'darwin') {
    sessionWindow.setAlwaysOnTop(true, 'screen-saver');
    sessionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else {
    sessionWindow.setAlwaysOnTop(true, 'screen-saver');
  }
  
  // Load session-specific HTML (we'll create this)
  sessionWindow.loadFile(path.join(__dirname, '..', 'renderer', 'session.html'));
  
  // Store window reference
  sessionWindows.set(session.id, sessionWindow);
  
  // Track active session windows
  const activeWindows = store.get('activeSessionWindows');
  activeWindows[sessionWindow.id] = { gatewayId, sessionId: session.id };
  store.set('activeSessionWindows', activeWindows);
  
  // Inject CSS/JS into webview when attached
  sessionWindow.webContents.on('did-attach-webview', (event, wvWebContents) => {
    console.log(`[Sessions] Session ${session.name} webview attached`);
    
    wvWebContents.on('dom-ready', () => {
      wvWebContents.insertCSS(OPENCLAW_CSS).catch(e => console.error('Session CSS injection failed:', e));
      wvWebContents.executeJavaScript(OPENCLAW_JS).catch(e => console.error('Session JS injection failed:', e));
      console.log(`[Sessions] CSS/JS injection enabled for session ${session.name}`);
    });
  });
  
  // Save bounds on move/resize
  const saveBounds = () => {
    if (!sessionWindow.isDestroyed()) {
      const allBounds = store.get('sessionWindowBounds');
      allBounds[session.id] = sessionWindow.getBounds();
      store.set('sessionWindowBounds', allBounds);
    }
  };
  sessionWindow.on('move', saveBounds);
  sessionWindow.on('resize', saveBounds);
  
  // Hide on blur (like main window)
  sessionWindow.on('blur', () => {
    if (sessionWindow.isVisible()) {
      sessionWindow.hide();
    }
  });
  
  // Handle keyboard shortcuts
  sessionWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      sessionWindow.hide();
    }
    // Cycling shortcuts
    if (input.type === 'keyDown' && input.shift && (input.meta || input.control)) {
      if (input.key === 'ArrowRight') {
        event.preventDefault();
        cycleWindows('next');
      } else if (input.key === 'ArrowLeft') {
        event.preventDefault();
        cycleWindows('prev');
      } else if (input.key === 'k' || input.key === 'K') {
        event.preventDefault();
        toggleTheme();
      }
    }
  });
  
  // Clean up on close
  sessionWindow.on('closed', () => {
    sessionWindows.delete(session.id);
    const activeWindows = store.get('activeSessionWindows');
    delete activeWindows[sessionWindow.id];
    store.set('activeSessionWindows', activeWindows);
  });
  
  sessionWindow.once('ready-to-show', () => {
    sessionWindow.show();
    // Send session info to renderer
    sessionWindow.webContents.send('load-session', {
      gateway: gateway,
      session: session
    });
  });
  
  return sessionWindow;
}

// IPC handlers for session management
ipcMain.handle('get-sessions', async (e, gatewayId) => {
  if (gatewayId) {
    const sessions = store.get('sessions')[gatewayId] || [];
    return sessions;
  }
  return store.get('sessions');
});

ipcMain.handle('refresh-sessions', async (e, gatewayId) => {
  if (gatewayId) {
    const gateway = store.get('gateways').find(g => g.id === gatewayId);
    if (gateway) {
      const sessions = await fetchGatewaySessions(gateway.url);
      const allSessions = store.get('sessions');
      allSessions[gatewayId] = sessions;
      store.set('sessions', allSessions);
      return sessions;
    }
    return [];
  } else {
    return await refreshAllSessions();
  }
});

ipcMain.handle('open-session', (e, gatewayId, sessionData) => {
  const window = createSessionWindow(gatewayId, sessionData);
  return window !== null;
});

ipcMain.handle('close-session', (e, sessionId) => {
  const window = sessionWindows.get(sessionId);
  if (window && !window.isDestroyed()) {
    window.close();
    return true;
  }
  return false;
});

// ── Visibility Management ─────────────────────────────────────

ipcMain.handle('get-hidden-gateways', () => store.get('hiddenGateways'));

ipcMain.handle('set-gateway-visibility', (e, gatewayId, visible) => {
  const hiddenGateways = store.get('hiddenGateways');
  if (visible) {
    // Remove from hidden list
    const filtered = hiddenGateways.filter(id => id !== gatewayId);
    store.set('hiddenGateways', filtered);
  } else {
    // Add to hidden list
    if (!hiddenGateways.includes(gatewayId)) {
      hiddenGateways.push(gatewayId);
      store.set('hiddenGateways', hiddenGateways);
    }
  }
  return store.get('hiddenGateways');
});

// Session visibility API removed - was never implemented in UI

// Toggle between dark and light theme
function toggleTheme() {
  // Cycle: system -> dark -> light -> system
  // Or simply toggle: dark <-> light
  if (nativeTheme.themeSource === 'system') {
    nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? 'light' : 'dark';
  } else if (nativeTheme.themeSource === 'dark') {
    nativeTheme.themeSource = 'light';
  } else {
    nativeTheme.themeSource = 'dark';
  }
  
  // Also toggle theme in all webviews (OpenClaw chat UI)
  toggleWebviewTheme();
}

// Toggle theme in all OpenClaw webviews
function toggleWebviewTheme() {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  
  // Send theme toggle to main window webview
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('toggle-webview-theme', theme);
  }
  
  // Send theme toggle to all session windows
  for (const sessionWindow of sessionWindows.values()) {
    if (!sessionWindow.isDestroyed()) {
      sessionWindow.webContents.send('toggle-webview-theme', theme);
    }
  }
}

// Notify all windows when theme changes
nativeTheme.on('updated', () => {
  const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('theme-changed', theme);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('theme-changed', theme);
  }
});

// ── Main Window ───────────────────────────────────────────────

function createWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width || 400,
    height: bounds.height || 600,
    x: bounds.x,
    y: bounds.y,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    transparent: false,
    visibleOnAllWorkspaces: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
    }
  });

  if (process.platform === 'darwin') {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } else {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Open DevTools with Cmd+Option+I
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.meta && input.alt && input.key === 'i') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Inject CSS/JS into any webview that loads inside this window
  mainWindow.webContents.on('did-attach-webview', (event, wvWebContents) => {
    console.log('[Main] Webview attached, URL:', wvWebContents.getURL());
    
    wvWebContents.on('did-start-loading', () => console.log('[Main] Webview did-start-loading'));
    wvWebContents.on('did-stop-loading', () => console.log('[Main] Webview did-stop-loading'));
    wvWebContents.on('did-fail-load', (e, code, desc) => console.log('[Main] Webview did-fail-load:', code, desc));
    
    wvWebContents.on('dom-ready', () => {
      const url = wvWebContents.getURL();
      console.log('[Main] Webview dom-ready, URL:', url);
      
      wvWebContents.insertCSS(OPENCLAW_CSS).catch(e => console.error('Main insertCSS failed:', e));
      wvWebContents.executeJavaScript(OPENCLAW_JS).catch(e => console.error('Main executeJS failed:', e));
      console.log('[Main] CSS/JS injection enabled');
    });
  });

  const saveBounds = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  };
  mainWindow.on('move', saveBounds);
  mainWindow.on('resize', saveBounds);

  mainWindow.on('blur', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      mainWindow.hide();
    }
    // Catch window cycling shortcuts even when webview has focus
    if (input.type === 'keyDown' && input.shift && (input.meta || input.control)) {
      if (input.key === 'ArrowRight') {
        event.preventDefault();
        cycleWindows('next');
      } else if (input.key === 'ArrowLeft') {
        event.preventDefault();
        cycleWindows('prev');
      } else if (input.key === 'k' || input.key === 'K') {
        event.preventDefault();
        toggleTheme();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Settings Window ───────────────────────────────────────────

function openSettings(opts = {}) {
  // Hide main window (mutually exclusive)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    // If already open and requesting add form, send IPC to open it
    if (opts.openAddForm) {
      settingsWindow.webContents.send('open-add-form');
    }
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 520,
    height: 640,
    resizable: false,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-settings.js'),
    }
  });

  const queryString = opts.openAddForm ? '?openAddForm=1' : '';
  settingsWindow.loadFile(path.join(__dirname, '..', 'renderer', 'settings.html'), { query: opts.openAddForm ? { openAddForm: '1' } : {} });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    // Notify main window to refresh gateway list
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('gateways-updated');
    }
  });
}

// ── Enhanced Window Cycling (Gateway → Sessions → Next Gateway) ─

function getAllWindowsInOrder() {
  const gateways = store.get('gateways');
  const allSessions = store.get('sessions');
  const hiddenGateways = store.get('hiddenGateways');
  const windows = [];
  
  for (const gateway of gateways) {
    // Skip hidden gateways
    if (hiddenGateways.includes(gateway.id)) {
      continue;
    }
    
    // Add main gateway window
    windows.push({
      type: 'gateway',
      gatewayId: gateway.id,
      gateway: gateway,
      window: mainWindow
    });
    
    // Add session windows for this gateway
    const sessions = allSessions[gateway.id] || [];
    
    for (const session of sessions) {
      const sessionWindow = sessionWindows.get(session.id);
      if (sessionWindow && !sessionWindow.isDestroyed()) {
        windows.push({
          type: 'session',
          gatewayId: gateway.id,
          sessionId: session.id,
          gateway: gateway,
          session: session,
          window: sessionWindow
        });
      }
    }
  }
  
  return windows;
}

function getCurrentlyFocusedWindow() {
  const focused = BrowserWindow.getFocusedWindow();
  if (!focused) return null;
  
  if (focused === mainWindow) {
    return { type: 'gateway', window: mainWindow };
  }
  
  for (const [sessionId, sessionWindow] of sessionWindows.entries()) {
    if (sessionWindow === focused) {
      return { type: 'session', sessionId, window: sessionWindow };
    }
  }
  
  return null;
}

function cycleWindows(direction) {
  // For keyboard cycling, we want to cycle through gateways in the main window
  // instead of hiding/showing separate windows
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Show main window if hidden
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
    
    // Send cycling command to renderer which has the proper cycling logic
    mainWindow.webContents.send('cycle-agent', direction);
  }
}

// Legacy function for backward compatibility
function cycleGateway(direction) {
  cycleWindows(direction);
}

// ── Toggle / Tray / Hotkey ────────────────────────────────────

function toggleWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    // Update updater's main window reference
    updater.setMainWindow(mainWindow);
    return;
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    // Close settings if open (mutually exclusive)
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARElEQVQ4T2P8z8BQz0BAwMBAAGBhYGD4T4whBgYGRmIMkG4Ao2uQGECyC0h2wWgYjIYBVcKAZC+QnJBIdgHJXiDZAABhvBAR2MfUzgAAAABJRU5ErkJggg=='
  );

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Flying Lobster 🦞');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show/Hide', click: toggleWindow },
    { type: 'separator' },
    { label: 'Settings', click: openSettings },
    { label: 'Check for Updates...', click: () => updater.checkForUpdate(true) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', toggleWindow);
}

// Check if any Flying Lobster window is focused
function isAnyWindowFocused() {
  const { BrowserWindow } = require('electron');
  return BrowserWindow.getAllWindows().some(win => win && !win.isDestroyed() && win.isFocused());
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  
  const hotkey = store.get('hotkey');
  const nextAgentHotkey = store.get('nextAgentHotkey');
  const prevAgentHotkey = store.get('prevAgentHotkey');
  const toggleThemeHotkey = store.get('toggleThemeHotkey');
  
  // Main toggle hotkey (works globally)
  const registered = globalShortcut.register(hotkey, toggleWindow);
  if (!registered) {
    console.error(`Failed to register hotkey: ${hotkey}`);
  }
  
  // Window cycling shortcuts - only when FL is focused
  const nextRegistered = globalShortcut.register(nextAgentHotkey, () => {
    if (isAnyWindowFocused()) cycleWindows('next');
  });
  const prevRegistered = globalShortcut.register(prevAgentHotkey, () => {
    if (isAnyWindowFocused()) cycleWindows('prev');
  });
  
  if (!nextRegistered) console.error(`Failed to register next agent hotkey: ${nextAgentHotkey}`);
  if (!prevRegistered) console.error(`Failed to register prev agent hotkey: ${prevAgentHotkey}`);
  
  // Theme toggle shortcut - only when FL is focused
  const themeRegistered = globalShortcut.register(toggleThemeHotkey, () => {
    if (isAnyWindowFocused()) toggleTheme();
  });
  if (!themeRegistered) console.error(`Failed to register theme toggle hotkey: ${toggleThemeHotkey}`);
}

if (process.platform === 'darwin') {
  app.dock.hide();
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerHotkey();
  
  // Initialize anonymous telemetry (first launch only)
  initTelemetry(); // Fire-and-forget, never blocks startup
  
  // Initialize auto-updater
  updater.registerIpcHandlers();
  updater.setMainWindow(mainWindow);
  
  // Check for updates on launch (after window is ready)
  setTimeout(() => {
    updater.checkForUpdate(true); // Force fresh check on startup
    updater.startPeriodicChecks(); // Check every 24 hours
  }, 3000);
  
  // Refresh sessions for all gateways on startup
  setTimeout(() => {
    refreshAllSessions().then(() => {
      console.log('[Sessions] Initial session refresh completed');
    }).catch(err => {
      console.log('[Sessions] Initial session refresh failed:', err.message);
    });
  }, 2000); // Give gateways time to start
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault?.();
});
