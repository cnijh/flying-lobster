const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const Store = require('electron-store').default || require('electron-store');

const store = new Store({
  defaults: {
    windowBounds: { x: undefined, y: undefined, width: 420, height: 700 },
    chatUrl: null // will be set after user picks a chat
  }
});

let win = null;
let tray = null;

function createWindow() {
  const { x, y, width, height } = store.get('windowBounds');

  win = new BrowserWindow({
    x, y, width, height,
    minWidth: 320,
    minHeight: 400,
    alwaysOnTop: true,
    // Appear on ALL Spaces and over fullscreen apps (macOS)
    visibleOnAllWorkspaces: true,
    fullscreenable: false,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 8, y: 8 },
    transparent: false,
    skipTaskbar: false,
    show: false,
    // Float above fullscreen apps
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:telegram'
    }
  });

  // macOS: set window level to float above fullscreen
  if (process.platform === 'darwin') {
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  // Load saved chat URL or Telegram root for first-time setup
  const chatUrl = store.get('chatUrl');
  if (chatUrl) {
    win.loadURL(chatUrl);
  } else {
    win.loadURL('https://web.telegram.org/a/');
  }

  // Watch for navigation — when user picks a chat, save that URL
  win.webContents.on('did-navigate-in-page', (event, url) => {
    // Telegram Web uses hash routing: https://web.telegram.org/a/#1234567
    if (url.match(/web\.telegram\.org\/a\/#-?\d+/)) {
      store.set('chatUrl', url);
    }
  });

  // Save bounds on move/resize
  const saveBounds = () => {
    if (win && !win.isMinimized() && !win.isMaximized()) {
      store.set('windowBounds', win.getBounds());
    }
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  // Hide instead of close
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible() && win.isFocused()) {
    win.hide();
  } else {
    win.show();
    win.focus();
  }
}

function resetChat() {
  store.delete('chatUrl');
  if (win) {
    win.loadURL('https://web.telegram.org/a/');
  }
}

function createTray() {
  // Create a simple 16x16 tray icon (lobster emoji placeholder)
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA' +
    'mElEQVQ4T2NkoBAwUqifAY8B/xkY/v9nYPj/n4Hh338Ghn//GRj+MTAw/GNgYPjHwMDw' +
    'F8z+z8Dwl4GB4Q8DA8MfBgaG3wwMDL8YGBh+MjAw/GBgYPjOwMDwjYGB4SsDA8MXBgaG' +
    'zwwMDJ8YGBg+MjAwfGBgYHjPwMDwjoGB4S0DA8MbBgaG1wwMDK8YGBheAukvAQBNjCYR' +
    'jE8ZzQAAAABJRU5ErkJggg=='
  );

  tray = new Tray(icon);
  tray.setToolTip('Flying Lobster');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show/Hide', click: toggleWindow },
    { label: 'Switch Chat', click: resetChat },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', toggleWindow);
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Global shortcut: Cmd+Shift+M (Mac) / Ctrl+Shift+M (Win)
  const shortcut = process.platform === 'darwin' ? 'CommandOrControl+Shift+M' : 'Ctrl+Shift+M';
  globalShortcut.register(shortcut, toggleWindow);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  // Don't quit on window close
});

app.on('activate', () => {
  if (win) {
    win.show();
    win.focus();
  }
});
