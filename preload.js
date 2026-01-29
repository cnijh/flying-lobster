// Preload script — optimize Telegram Web for floating compact window
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    /* All interactive elements must not be blocked */
    a, button, input, textarea, select, [contenteditable],
    [role="button"], [role="link"], [role="textbox"],
    .chat-list, .messages-container, .ListItem, .ChatInfo,
    .input-message-container, .input-message-input,
    .bubbles, .bubbles-inner, .scrollable, .sidebar,
    .Message, .message, .bubble {
      pointer-events: auto !important;
    }

    /* When in a chat, hide the left sidebar to maximize chat space */
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
