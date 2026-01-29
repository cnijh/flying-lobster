const { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const Store = require('electron-store').default || require('electron-store');

const store = new Store({
  defaults: {
    windowBounds: null, // will be computed on first launch
    chatUrl: null
  }
});

let win = null;
let tray = null;

function getDefaultBounds() {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;
  // Wide but short, centered at bottom
  const winW = Math.min(700, screenW - 100);
  const winH = 340;
  const x = Math.round((screenW - winW) / 2);
  const y = screenH - winH - 20; // 20px from bottom
  return { x, y, width: winW, height: winH };
}

function createWindow() {
  // Always use computed defaults on first launch
  let bounds = store.get('windowBounds');
  if (!bounds || !bounds.width) {
    bounds = getDefaultBounds();
    store.set('windowBounds', bounds);
  }

  win = new BrowserWindow({
    ...bounds,
    minWidth: 400,
    minHeight: 200,
    alwaysOnTop: true,
    visibleOnAllWorkspaces: true,
    fullscreenable: false,
    frame: false,
    transparent: false,
    skipTaskbar: false,
    show: false,
    hasShadow: true,
    roundedCorners: true,
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:telegram'
    }
  });

  if (process.platform === 'darwin') {
    win.setAlwaysOnTop(true, 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  const chatUrl = store.get('chatUrl');
  if (chatUrl) {
    win.loadURL(chatUrl);
  } else {
    win.loadURL('https://web.telegram.org/a/');
  }

  // When page loads, focus the input and scroll to bottom
  win.webContents.on('did-finish-load', () => {
    // Wait for Telegram to render, then focus input and scroll to latest
    setTimeout(() => {
      win.webContents.executeJavaScript(`
        (function() {
          // Scroll chat to bottom
          var msgs = document.querySelector('.messages-container .scrollable');
          if (msgs) msgs.scrollTop = msgs.scrollHeight;
          // Alternative scroll target
          var bubble = document.querySelector('.bubbles-inner');
          if (bubble) bubble.scrollTop = bubble.scrollHeight;
          // Focus the message input
          var input = document.querySelector('[contenteditable="true"]');
          if (input) input.focus();
          var textInput = document.querySelector('.input-message-input');
          if (textInput) textInput.focus();
        })();
      `).catch(() => {});
    }, 2000);
  });

  // Save chat URL when user navigates to a chat
  win.webContents.on('did-navigate-in-page', (event, url) => {
    if (url.match(/web\.telegram\.org\/a\/#-?\d+/)) {
      store.set('chatUrl', url);
    }
  });

  const saveBounds = () => {
    if (win && !win.isMinimized() && !win.isMaximized()) {
      store.set('windowBounds', win.getBounds());
    }
  };
  win.on('resize', saveBounds);
  win.on('move', saveBounds);

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
    // Re-focus input when showing
    setTimeout(() => {
      win.webContents.executeJavaScript(`
        (function() {
          var input = document.querySelector('[contenteditable="true"]');
          if (input) input.focus();
          var textInput = document.querySelector('.input-message-input');
          if (textInput) textInput.focus();
        })();
      `).catch(() => {});
    }, 200);
  }
}

function resetChat() {
  store.delete('chatUrl');
  if (win) {
    win.loadURL('https://web.telegram.org/a/');
  }
}

function resetPosition() {
  if (win) {
    const bounds = getDefaultBounds();
    win.setBounds(bounds);
    store.set('windowBounds', bounds);
  }
}

function createTray() {
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
    { label: 'Reset Position', click: resetPosition },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', toggleWindow);
}

app.whenReady().then(() => {
  createWindow();
  createTray();

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
