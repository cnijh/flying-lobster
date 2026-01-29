// Preload script — injects minimal CSS to hide Telegram's native header for cleaner floating UX
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = `
    /* Allow dragging the window from the top area */
    body::before {
      content: '';
      display: block;
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 28px;
      -webkit-app-region: drag;
      z-index: 99999;
      pointer-events: auto;
    }
    /* Make sure inputs/buttons remain clickable */
    button, input, a, textarea, [contenteditable] {
      -webkit-app-region: no-drag;
    }
  `;
  document.head.appendChild(style);
});
