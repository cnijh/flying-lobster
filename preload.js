// Preload script — clean up Telegram Web for floating window UX
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    /* Thin drag handle at the very top — doesn't block content */
    body::before {
      content: '';
      display: block;
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 12px;
      -webkit-app-region: drag;
      z-index: 99999;
      pointer-events: auto;
      background: transparent;
    }

    /* Ensure ALL interactive elements are not blocked by drag region */
    a, button, input, textarea, select, [contenteditable],
    [role="button"], [role="link"], [role="textbox"],
    .chat-list, .messages-container, .ListItem, .ChatInfo,
    .input-message-container {
      -webkit-app-region: no-drag !important;
      pointer-events: auto !important;
    }

    /* Hide Telegram left sidebar when a chat is open (single-chat mode) */
    /* Users can still access it via back button */
  `;
  document.head.appendChild(style);
});
