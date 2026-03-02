const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Window management
  closeWindow: () => {
    const window = require("@electron/remote").getCurrentWindow();
    window.close();
  },

  // Theme support
  getTheme: () => ipcRenderer.invoke("get-theme"),
  onThemeChanged: (cb) =>
    ipcRenderer.on("theme-changed", (_event, theme) => cb(theme)),
  onToggleWebviewTheme: (cb) =>
    ipcRenderer.on("toggle-webview-theme", (_event, theme) => cb(theme)),

  // Session loading
  onLoadSession: (cb) =>
    ipcRenderer.on("load-session", (_event, sessionData) => cb(sessionData)),

  // Screen Vision
  toggleScreenVision: () => ipcRenderer.invoke("toggle-screen-vision"),
  onScreenVisionStatus: (cb) =>
    ipcRenderer.on("screen-vision-status", (_e, enabled) => cb(enabled)),
});
