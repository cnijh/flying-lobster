const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getGateways: () => ipcRenderer.invoke('get-gateways'),
  addGateway: (gateway) => ipcRenderer.invoke('add-gateway', gateway),
  updateGateway: (gateway) => ipcRenderer.invoke('update-gateway', gateway),
  deleteGateway: (id) => ipcRenderer.invoke('delete-gateway', id),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  // Theme support
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChanged: (cb) => ipcRenderer.on('theme-changed', (_event, theme) => cb(theme)),
  // Session management
  getSessions: (gatewayId) => ipcRenderer.invoke('get-sessions', gatewayId),
  refreshSessions: (gatewayId) => ipcRenderer.invoke('refresh-sessions', gatewayId),
  // Visibility management
  getHiddenGateways: () => ipcRenderer.invoke('get-hidden-gateways'),
  setGatewayVisibility: (gatewayId, visible) => ipcRenderer.invoke('set-gateway-visibility', gatewayId, visible),
  // Auto-update support
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdate: (force) => ipcRenderer.invoke('check-for-update', force),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  startUpdate: () => ipcRenderer.invoke('start-update'),
  onUpdateStateChanged: (cb) => ipcRenderer.on('update-state-changed', (_event, state) => cb(state)),
  // Open add form trigger
  onOpenAddForm: (cb) => ipcRenderer.on('open-add-form', () => cb()),
  // Switch to gateway and show main window
  setActiveGateway: (id) => ipcRenderer.invoke('set-active-gateway', id),
  showMainWindow: () => ipcRenderer.invoke('show-main-window'),
  // Open external URL
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
