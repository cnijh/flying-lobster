// Preload script — add drag bar + optimize for compact window
window.addEventListener('DOMContentLoaded', () => {
  // Inject a visible drag bar at the top of the page
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
    -webkit-app-region: drag;
    color: #aaa;
    cursor: grab;
  `;
  document.body.prepend(dragBar);

  // Push Telegram content down so it's not hidden behind drag bar
  const spacer = document.createElement('div');
  spacer.style.cssText = 'height: 28px; flex-shrink: 0;';
  document.body.prepend(spacer);

  const style = document.createElement('style');
  style.textContent = `
    /* Make sure drag bar stays on top */
    #fl-drag-bar {
      -webkit-app-region: drag !important;
    }
    #fl-drag-bar * {
      -webkit-app-region: drag !important;
    }

    /* All interactive elements below drag bar */
    a, button, input, textarea, select, [contenteditable],
    [role="button"], [role="link"], [role="textbox"],
    .input-message-container, .input-message-input,
    .bubbles, .scrollable, .sidebar,
    .Message, .message, .bubble, .ListItem, .ChatInfo {
      -webkit-app-region: no-drag !important;
      pointer-events: auto !important;
    }

    /* Hide left sidebar in compact mode */
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
