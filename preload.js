// Preload script — drag bar + compact layout
const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  // Inject drag bar
  const dragBar = document.createElement('div');
  dragBar.id = 'fl-drag-bar';
  dragBar.innerHTML = '<span style="opacity:0.5;font-size:11px;user-select:none;">☰ Flying Lobster</span>';
  dragBar.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 28px;
    background: #2b2b2b;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    color: #aaa;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  `;
  document.body.prepend(dragBar);

  // Push content down
  const spacer = document.createElement('div');
  spacer.style.cssText = 'height: 28px; flex-shrink: 0;';
  document.body.prepend(spacer);

  // Manual drag handling via IPC
  let isDragging = false;
  let startX, startY;

  dragBar.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.screenX;
    startY = e.screenY;
    dragBar.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.screenX - startX;
    const dy = e.screenY - startY;
    startX = e.screenX;
    startY = e.screenY;
    ipcRenderer.send('window-drag', dx, dy);
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    dragBar.style.cursor = 'grab';
  });

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    a, button, input, textarea, select, [contenteditable],
    [role="button"], [role="link"], [role="textbox"],
    .input-message-container, .input-message-input,
    .bubbles, .scrollable, .sidebar,
    .Message, .message, .bubble, .ListItem, .ChatInfo {
      pointer-events: auto !important;
    }

    @media (max-width: 800px) {
      .sidebar-left {
        display: none !important;
      }
      .chat-column, .messages-layout {
        width: 100% !important;
        max-width: 100% !important;
      }
    }
  `;
  document.head.appendChild(style);
});
