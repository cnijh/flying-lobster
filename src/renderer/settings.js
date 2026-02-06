const $ = (sel) => document.querySelector(sel);

let editingId = null;

// ── Theme support ─────────────────────────────────────────────
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
}

// Apply initial theme and listen for changes
window.api.getTheme().then(applyTheme);
window.api.onThemeChanged(applyTheme);

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => el.className = 'toast', 2000);
}

// ── Render gateway list ───────────────────────────────────────
async function renderGateways() {
  const gateways = await window.api.getGateways();
  const hiddenGateways = await window.api.getHiddenGateways();
  const list = $('#gw-list');

  if (!gateways.length) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = gateways.map(g => {
    const isVisible = !hiddenGateways.includes(g.id);
    return `
      <div class="gw-item" data-id="${g.id}">
        <div class="info">
          <div class="name">${esc(g.name)}</div>
          <div class="url">${esc(g.url)}${g.token ? ' 🔑' : ''}</div>
        </div>
        <div class="actions">
          <button class="chat-btn" data-id="${g.id}" title="Open chat">💬</button>
          <div class="visibility-toggle ${isVisible ? 'visible' : ''}" 
               data-id="${g.id}"
               title="${isVisible ? 'Hide' : 'Show'} gateway from cycling">
          </div>
          <button class="edit-btn" data-id="${g.id}" title="Edit">✏️</button>
          <button class="del-btn" data-id="${g.id}" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners for edit and delete buttons
  list.querySelectorAll('.edit-btn').forEach(btn =>
    btn.addEventListener('click', () => startEdit(gateways.find(g => g.id === btn.dataset.id)))
  );
  list.querySelectorAll('.del-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteGateway(btn.dataset.id))
  );

  // Add event listeners for visibility toggles
  list.querySelectorAll('.visibility-toggle').forEach(toggle => {
    toggle.addEventListener('click', async () => {
      const id = toggle.dataset.id;
      const isVisible = toggle.classList.contains('visible');
      const newVisible = !isVisible;
      
      try {
        await window.api.setGatewayVisibility(id, newVisible);
        toast(`Gateway ${newVisible ? 'shown' : 'hidden'} in cycling`);
        
        // Update UI
        toggle.classList.toggle('visible', newVisible);
        toggle.title = newVisible ? 'Hide gateway from cycling' : 'Show gateway from cycling';
        
      } catch (error) {
        console.error('Failed to update visibility:', error);
        toast('Failed to update visibility', true);
      }
    });
  });

  // Add event listeners for chat buttons
  list.querySelectorAll('.chat-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      await window.api.setActiveGateway(id);
      window.api.showMainWindow(); // This also closes settings
    });
  });
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Form visibility ───────────────────────────────────────────
function showForm() {
  $('#gw-form').style.display = '';
  $('#gw-add-btn').style.display = 'none';
  $('#gw-name').focus();
}

function hideForm() {
  $('#gw-form').style.display = 'none';
  $('#gw-add-btn').style.display = '';
  editingId = null;
  $('#gw-name').value = '';
  $('#gw-url').value = '';
  $('#gw-token').value = '';
  $('#gw-save').textContent = 'Add Gateway';
}

$('#gw-add-btn').addEventListener('click', showForm);

// ── Add / Edit ────────────────────────────────────────────────
function startEdit(gw) {
  editingId = gw.id;
  $('#gw-name').value = gw.name;
  $('#gw-url').value = gw.url;
  $('#gw-token').value = gw.token || '';
  $('#gw-save').textContent = 'Update Gateway';
  showForm();
}

function cancelEdit() {
  hideForm();
}

$('#gw-save').addEventListener('click', async () => {
  const name = $('#gw-name').value.trim();
  const url = $('#gw-url').value.trim();
  const token = $('#gw-token').value.trim();
  if (!name || !url) return toast('Name and URL required', true);

  if (editingId) {
    await window.api.updateGateway({ id: editingId, name, url, token });
    toast('Gateway updated');
  } else {
    await window.api.addGateway({ name, url, token });
    toast('Gateway added');
  }
  hideForm();
  renderGateways();
});

$('#gw-cancel').addEventListener('click', cancelEdit);

async function deleteGateway(id) {
  await window.api.deleteGateway(id);
  toast('Gateway deleted');
  renderGateways();
}

// ── Hotkey ────────────────────────────────────────────────────
// Stores the Electron-format hotkey string
// Shortcut editing state moved to shortcut editing section

// Map keys to display symbols (macOS style)
const MODIFIER_SYMBOLS = {
  meta: '⌘',     // Cmd
  ctrl: '⌃',     // Control
  alt: '⌥',      // Option
  shift: '⇧',    // Shift
};

// Special key display names
const KEY_DISPLAY = {
  'ArrowUp': '↑',
  'ArrowDown': '↓',
  'ArrowLeft': '←',
  'ArrowRight': '→',
  'Escape': 'Esc',
  'Backspace': '⌫',
  'Delete': '⌦',
  'Enter': '↵',
  'Tab': '⇥',
  'Space': '␣',
  ' ': '␣',
};

// Convert keyboard event to display string and Electron format
function parseHotkey(e) {
  const modifiers = [];
  const electronParts = [];
  
  // Order: Ctrl, Alt, Shift, Meta (standard order for display)
  // But for macOS feel, we show: ⌃⌥⇧⌘
  if (e.ctrlKey && !e.metaKey) {
    modifiers.push(MODIFIER_SYMBOLS.ctrl);
    electronParts.push('Control');
  }
  if (e.altKey) {
    modifiers.push(MODIFIER_SYMBOLS.alt);
    electronParts.push('Alt');
  }
  if (e.shiftKey) {
    modifiers.push(MODIFIER_SYMBOLS.shift);
    electronParts.push('Shift');
  }
  if (e.metaKey) {
    modifiers.push(MODIFIER_SYMBOLS.meta);
    electronParts.push('CommandOrControl');
  }
  
  // Get the main key (ignore standalone modifier keys)
  const key = e.key;
  const code = e.code;
  
  // Skip if only modifier pressed
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
    return null;
  }
  
  // Determine display and Electron key
  let displayKey = KEY_DISPLAY[key] || KEY_DISPLAY[code] || key.toUpperCase();
  let electronKey = key.length === 1 ? key.toUpperCase() : key;
  
  // Handle special cases for Electron
  if (code.startsWith('Arrow')) {
    electronKey = code.replace('Arrow', '');
  } else if (key === ' ') {
    electronKey = 'Space';
  }
  
  // Must have at least one modifier for a global hotkey
  if (modifiers.length === 0) {
    return null;
  }
  
  return {
    display: modifiers.join('') + displayKey,
    electron: [...electronParts, electronKey].join('+'),
  };
}

// Convert Electron format back to display symbols
function electronToDisplay(electronStr) {
  if (!electronStr) return '';
  
  const parts = electronStr.split('+');
  const display = [];
  let mainKey = '';
  
  for (const part of parts) {
    switch (part) {
      case 'CommandOrControl':
      case 'Command':
      case 'Cmd':
        display.push('⌘');
        break;
      case 'Control':
      case 'Ctrl':
        display.push('⌃');
        break;
      case 'Alt':
      case 'Option':
        display.push('⌥');
        break;
      case 'Shift':
        display.push('⇧');
        break;
      default:
        // Main key
        mainKey = KEY_DISPLAY[part] || KEY_DISPLAY['Arrow' + part] || part;
    }
  }
  
  return display.join('') + mainKey;
}

// ── Shortcut Editing ──────────────────────────────────────────
const SHORTCUT_KEYS = {
  hotkey: 'hotkey',
  nextAgent: 'nextAgentHotkey',
  prevAgent: 'prevAgentHotkey',
  toggleTheme: 'toggleThemeHotkey'
};

let editingShortcut = null;
let editingElectronValue = null;

// Render keyboard shortcuts display
function renderShortcutKeys(settingsKey, electronValue) {
  const display = electronToDisplay(electronValue);
  const keysEl = $(`#${settingsKey}-keys`);
  if (keysEl && display) {
    keysEl.innerHTML = display.split('').map(k => `<kbd>${k}</kbd>`).join('');
  }
}

// Initialize all shortcut items
document.querySelectorAll('.shortcut-item[data-shortcut]').forEach(item => {
  const shortcutId = item.dataset.shortcut;
  const editIcon = item.querySelector('.edit-icon');
  const input = item.querySelector('.shortcut-input');
  const saveBtn = item.querySelector('.btn:not(.cancel-btn)');
  const cancelBtn = item.querySelector('.cancel-btn');

  // Click pencil to edit
  editIcon.addEventListener('click', () => {
    // Close any other editing
    document.querySelectorAll('.shortcut-item.editing').forEach(el => el.classList.remove('editing'));
    
    item.classList.add('editing');
    editingShortcut = shortcutId;
    editingElectronValue = null;
    input.value = '';
    input.focus();
  });

  // Capture keydown
  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const result = parseHotkey(e);
    if (result) {
      input.value = result.display;
      editingElectronValue = result.electron;
    }
  });

  // Save button
  saveBtn.addEventListener('click', async () => {
    if (!editingElectronValue) {
      toast('Press a key combination first', true);
      return;
    }
    
    try {
      const updateObj = {};
      updateObj[SHORTCUT_KEYS[shortcutId]] = editingElectronValue;
      await window.api.updateSettings(updateObj);
      
      renderShortcutKeys(shortcutId, editingElectronValue);
      item.classList.remove('editing');
      toast('Shortcut saved');
    } catch (e) {
      toast('Failed to save shortcut', true);
    }
  });

  // Cancel button
  cancelBtn.addEventListener('click', () => {
    item.classList.remove('editing');
    editingShortcut = null;
    editingElectronValue = null;
  });
});

// ── Close / Back ──────────────────────────────────────────────
$('#close-btn').addEventListener('click', () => {
  window.api.showMainWindow();
});
$('#back-btn').addEventListener('click', () => {
  window.api.showMainWindow();
});

// ── Feedback ──────────────────────────────────────────────────
$('#feedback-btn').addEventListener('click', () => {
  window.api.openExternal('https://tally.so/r/ZjaxLv');
});

// ── Auto-Update ───────────────────────────────────────────────
const updateStatusItem = $('#update-status-item');
const updateStatusText = $('#update-status-text');
const updateActions = $('#update-actions');
const checkUpdateBtn = $('#check-update-btn');

function renderUpdateState(state) {
  console.log('[Settings] Update state:', state);
  
  if (state.checking) {
    updateStatusItem.style.display = '';
    updateStatusText.textContent = '🔍 Checking for updates...';
    updateActions.innerHTML = '';
    checkUpdateBtn.disabled = true;
    checkUpdateBtn.textContent = 'Checking...';
  } else if (state.updating) {
    updateStatusItem.style.display = '';
    updateStatusText.textContent = '⏳ ' + (state.progress || 'Updating...');
    updateActions.innerHTML = '';
    checkUpdateBtn.disabled = true;
  } else if (state.available && state.latestVersion) {
    updateStatusItem.style.display = '';
    updateStatusText.innerHTML = `<span style="color: var(--success);">✓</span> Version ${state.latestVersion} available`;
    updateActions.innerHTML = `<button class="btn" id="do-update-btn">Update Now</button>`;
    $('#do-update-btn').addEventListener('click', () => {
      window.api.startUpdate();
    });
    checkUpdateBtn.disabled = false;
    checkUpdateBtn.textContent = 'Check for Updates';
  } else if (state.error) {
    updateStatusItem.style.display = '';
    updateStatusText.innerHTML = `<span style="color: var(--danger);">✕</span> ${state.error}`;
    updateActions.innerHTML = '';
    checkUpdateBtn.disabled = false;
    checkUpdateBtn.textContent = 'Check for Updates';
  } else if (state.currentVersion) {
    updateStatusItem.style.display = '';
    updateStatusText.innerHTML = `<span style="color: var(--success);">✓</span> You're up to date (${state.currentVersion})`;
    updateActions.innerHTML = '';
    checkUpdateBtn.disabled = false;
    checkUpdateBtn.textContent = 'Check for Updates';
  } else {
    updateStatusItem.style.display = 'none';
    checkUpdateBtn.disabled = false;
    checkUpdateBtn.textContent = 'Check for Updates';
  }
}

// Listen for update state changes
if (window.api.onUpdateStateChanged) {
  window.api.onUpdateStateChanged(renderUpdateState);
}

checkUpdateBtn.addEventListener('click', async () => {
  checkUpdateBtn.disabled = true;
  checkUpdateBtn.textContent = 'Checking...';
  await window.api.checkForUpdate(true); // force=true to bypass cache
});

// ── Init ──────────────────────────────────────────────────────
(async () => {
  renderGateways();
  const settings = await window.api.getSettings();
  
  // Load and display all shortcuts
  if (settings.hotkey) {
    renderShortcutKeys('hotkey', settings.hotkey);
  }
  if (settings.nextAgentHotkey) {
    renderShortcutKeys('nextAgent', settings.nextAgentHotkey);
  }
  if (settings.prevAgentHotkey) {
    renderShortcutKeys('prevAgent', settings.prevAgentHotkey);
  }
  if (settings.toggleThemeHotkey) {
    renderShortcutKeys('toggleTheme', settings.toggleThemeHotkey);
  }
  
  // Show app version
  const version = await window.api.getAppVersion();
  $('#app-version').textContent = `v${version}`;
  
  // Don't show update status on load - only after user clicks "Check for Updates"
  // Hide the status item initially
  updateStatusItem.style.display = 'none';
  
  // Check if we should auto-open the add gateway form
  const params = new URLSearchParams(window.location.search);
  if (params.get('openAddForm')) {
    showForm();
  }
})();

// Listen for IPC trigger to open add form (when settings already open)
if (window.api.onOpenAddForm) {
  window.api.onOpenAddForm(() => showForm());
}
