// Preload script — optimize Telegram Web for floating compact window
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    /* Thin drag handle at very top */
    body::before {
      content: '';
      display: block;
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 10px;
      -webkit-app-region: drag;
      z-index: 99999;
      pointer-events: auto;
      background: transparent;
    }

    /* All interactive elements must not be blocked */
    a, button, input, textarea, select, [contenteditable],
    [role="button"], [role="link"], [role="textbox"],
    .chat-list, .messages-container, .ListItem, .ChatInfo,
    .input-message-container, .input-message-input,
    .bubbles, .bubbles-inner, .scrollable, .sidebar,
    .Message, .message, .bubble {
      -webkit-app-region: no-drag !important;
      pointer-events: auto !important;
    }

    /* When in a chat, hide the left sidebar to maximize chat space
       in the compact window. User can go back with <- button */
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
