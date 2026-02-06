const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getGateways: () => ipcRenderer.invoke('get-gateways'),
  getActiveGateway: () => ipcRenderer.invoke('get-active-gateway'),
  setActiveGateway: (id) => ipcRenderer.invoke('set-active-gateway', id),
  addGateway: (gateway) => ipcRenderer.invoke('add-gateway', gateway),
  removeGateway: (id) => ipcRenderer.invoke('delete-gateway', id),
  pingGateway: (url) => ipcRenderer.invoke('ping-gateway', url),
  onGatewaysUpdated: (cb) => ipcRenderer.on('gateways-updated', cb),
  openSettings: (opts) => ipcRenderer.invoke('open-settings', opts),
  // Theme support
  getTheme: () => ipcRenderer.invoke('get-theme'),
  onThemeChanged: (cb) => ipcRenderer.on('theme-changed', (_event, theme) => cb(theme)),
  onToggleWebviewTheme: (cb) => ipcRenderer.on('toggle-webview-theme', (_event, theme) => cb(theme)),
  // Agent switching
  onSwitchGateway: (cb) => ipcRenderer.on('switch-gateway', (_event, gatewayId) => cb(gatewayId)),
  onCycleAgent: (cb) => ipcRenderer.on('cycle-agent', (_event, direction) => cb(direction)),
  // Session management
  getSessions: (gatewayId) => ipcRenderer.invoke('get-sessions', gatewayId),
  refreshSessions: (gatewayId) => ipcRenderer.invoke('refresh-sessions', gatewayId),
  openSession: (gatewayId, sessionData) => ipcRenderer.invoke('open-session', gatewayId, sessionData),
  closeSession: (sessionId) => ipcRenderer.invoke('close-session', sessionId),
  // Visibility management
  getHiddenGateways: () => ipcRenderer.invoke('get-hidden-gateways'),
  setGatewayVisibility: (gatewayId, visible) => ipcRenderer.invoke('set-gateway-visibility', gatewayId, visible),
  // Auto-update support
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdate: (force) => ipcRenderer.invoke('check-for-update', force),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  dismissUpdate: () => ipcRenderer.invoke('dismiss-update'),
  startUpdate: () => ipcRenderer.invoke('start-update'),
  onUpdateStateChanged: (cb) => ipcRenderer.on('update-state-changed', (_event, state) => cb(state)),
});
