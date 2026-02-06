/**
 * Auto-updater module for Flying Lobster
 * Checks npm registry for new versions and facilitates one-click upgrade
 */

const { app, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const store = require('./store');

const NPM_REGISTRY_URL = 'https://registry.npmjs.org/flying-lobster/latest';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let updateState = {
  available: false,
  latestVersion: null,
  currentVersion: null,
  checking: false,
  updating: false,
  error: null,
  progress: null
};

let mainWindow = null;
let allWindows = []; // Track all windows that need updates

/**
 * Compare semver versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a, b) {
  const partsA = a.replace(/^v/, '').split('.').map(Number);
  const partsB = b.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

/**
 * Check npm registry for latest version
 */
async function fetchLatestVersion() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(NPM_REGISTRY_URL, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.version;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Check for updates (respects cache interval unless forced)
 */
async function checkForUpdate(force = false) {
  console.log('[Updater] checkForUpdate called, force:', force);
  const now = Date.now();
  const lastCheck = store.get('lastUpdateCheck') || 0;
  const dismissedVersion = store.get('dismissedUpdateVersion');
  
  console.log('[Updater] now:', now, 'lastCheck:', lastCheck, 'diff:', now - lastCheck, 'interval:', CHECK_INTERVAL_MS);
  
  // Skip if checked recently (unless forced)
  if (!force && (now - lastCheck) < CHECK_INTERVAL_MS) {
    console.log('[Updater] Using cached result (checked recently)');
    // Still return cached state if we have one
    const cachedVersion = store.get('latestVersion');
    if (cachedVersion) {
      const currentVersion = app.getVersion();
      const isNewer = compareVersions(cachedVersion, currentVersion) > 0;
      const isDismissed = dismissedVersion === cachedVersion;
      
      // Important: Set checking to false since we're using cached data
      updateState.checking = false;
      updateState.currentVersion = currentVersion;
      updateState.latestVersion = cachedVersion;
      updateState.available = isNewer && !isDismissed;
      updateState.error = null; // Clear any previous errors
      
      console.log(`[Updater] Cached result: Current: ${currentVersion}, Latest: ${cachedVersion}, isNewer: ${isNewer}, isDismissed: ${isDismissed}, Update available: ${updateState.available}`);
      notifyRenderer();
    }
    return updateState;
  }
  
  updateState.checking = true;
  updateState.error = null;
  notifyRenderer();
  
  try {
    const latestVersion = await fetchLatestVersion();
    const currentVersion = app.getVersion();
    const isNewer = compareVersions(latestVersion, currentVersion) > 0;
    const isDismissed = dismissedVersion === latestVersion;
    
    // Cache the result
    store.set('lastUpdateCheck', now);
    store.set('latestVersion', latestVersion);
    
    updateState.checking = false;
    updateState.currentVersion = currentVersion;
    updateState.latestVersion = latestVersion;
    updateState.available = isNewer && !isDismissed;
    
    console.log(`[Updater] Current: ${currentVersion}, Latest: ${latestVersion}, isNewer: ${isNewer}, isDismissed: ${isDismissed}, Update available: ${updateState.available}`);
    
  } catch (err) {
    console.error('[Updater] Check failed:', err.message, err.stack);
    updateState.checking = false;
    updateState.error = err.message;
  }
  
  notifyRenderer();
  return updateState;
}

/**
 * Dismiss the current update (won't show again for this version)
 */
function dismissUpdate() {
  if (updateState.latestVersion) {
    store.set('dismissedUpdateVersion', updateState.latestVersion);
    updateState.available = false;
    notifyRenderer();
  }
}

/**
 * Start the update process
 * Shells out to npx to download and install the latest version
 */
async function startUpdate() {
  if (updateState.updating) return;
  
  updateState.updating = true;
  updateState.progress = 'Starting update...';
  updateState.error = null;
  notifyRenderer();
  
  try {
    // Run npx flying-lobster@latest install
    // This will:
    // 1. Download the latest package
    // 2. Build the app with electron-builder
    // 3. Open the DMG for drag-to-install
    
    updateState.progress = 'Downloading latest version...';
    notifyRenderer();
    
    // Use full shell command to ensure npx is found
    const command = 'npx --prefer-online --yes flying-lobster@latest install';
    console.log('[Updater] Running:', command);
    
    const npxProcess = spawn(command, [], {
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0', PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' }
    });
    
    let output = '';
    
    npxProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('[Updater]', text);
      
      // Update progress based on output
      if (text.includes('Building')) {
        updateState.progress = 'Building new version...';
        notifyRenderer();
      } else if (text.includes('Installing dependencies')) {
        updateState.progress = 'Installing dependencies...';
        notifyRenderer();
      } else if (text.includes('Opening installer')) {
        updateState.progress = 'Opening installer...';
        notifyRenderer();
      }
    });
    
    npxProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('[Updater stderr]', text);
      // Show stderr as progress if it looks like status
      if (text.includes('npm') || text.includes('npx')) {
        updateState.progress = 'Downloading...';
        notifyRenderer();
      }
    });
    
    // Handle spawn error immediately
    npxProcess.on('error', (err) => {
      console.error('[Updater] Spawn error:', err);
      updateState.updating = false;
      updateState.error = 'Failed to start update: ' + err.message;
      notifyRenderer();
    });
    
    await new Promise((resolve, reject) => {
      npxProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Update process exited with code ${code}`));
        }
      });
      npxProcess.on('error', reject);
    });
    
    // Success! DMG should be open now
    updateState.updating = false;
    updateState.progress = 'Installer opened! Drag to Applications to complete.';
    notifyRenderer();
    
    // Clear dismissed version since we're updating
    store.delete('dismissedUpdateVersion');
    
    // Show a dialog or notification
    // The user needs to drag-to-install and restart
    
  } catch (err) {
    console.error('[Updater] Update failed:', err);
    updateState.updating = false;
    updateState.progress = null;
    updateState.error = err.message || 'Update failed';
    notifyRenderer();
  }
}

/**
 * Notify all renderer processes of state changes
 */
function notifyRenderer() {
  const { BrowserWindow } = require('electron');
  // Send to all open windows (main + settings)
  BrowserWindow.getAllWindows().forEach(win => {
    if (win && !win.isDestroyed()) {
      win.webContents.send('update-state-changed', { ...updateState });
    }
  });
}

/**
 * Set the main window reference for IPC
 */
function setMainWindow(win) {
  mainWindow = win;
}

/**
 * Register IPC handlers
 */
function registerIpcHandlers() {
  console.log('[Updater] Registering IPC handlers');
  ipcMain.handle('check-for-update', (_e, force) => checkForUpdate(force));
  ipcMain.handle('get-update-state', () => ({ ...updateState }));
  ipcMain.handle('dismiss-update', () => dismissUpdate());
  ipcMain.handle('start-update', () => startUpdate());
  ipcMain.handle('get-app-version', () => app.getVersion());
}

/**
 * Start periodic update checks (every 24 hours)
 */
let periodicCheckInterval = null;
function startPeriodicChecks() {
  if (periodicCheckInterval) return; // Already running
  
  console.log('[Updater] Starting periodic update checks (every 24h)');
  periodicCheckInterval = setInterval(() => {
    console.log('[Updater] Periodic check triggered');
    checkForUpdate(true); // Force fresh check
  }, CHECK_INTERVAL_MS);
}

module.exports = {
  checkForUpdate,
  dismissUpdate,
  startUpdate,
  setMainWindow,
  registerIpcHandlers,
  startPeriodicChecks,
  getState: () => ({ ...updateState })
};
