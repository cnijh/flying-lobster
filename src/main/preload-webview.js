// Preload script that runs inside the OpenClaw webview
// This has access to the page's DOM before it renders

const CSS = `
  :host {
    --shell-nav-width: 0px !important;
    --shell-topbar-height: 0px !important;
  }
  .shell {
    --shell-nav-width: 0px !important;
    --shell-topbar-height: 0px !important;
    grid-template-columns: 0px minmax(0,1fr) !important;
    grid-template-rows: 0px 1fr !important;
    grid-template-areas: "content" "content" !important;
  }
  .nav { display: none !important; }
  .topbar { display: none !important; }
  .content-header { display: none !important; }
  .content {
    padding: 0 4px !important;
    gap: 0 !important;
    grid-area: 1 / 1 / -1 / -1 !important;
  }
  .chat-controls { display: none !important; }
  .chat-compose { padding: 8px 4px 4px !important; }
  .chat-compose__row { gap: 6px !important; }
  .chat-compose__field textarea {
    min-height: 40px !important;
    width: 100% !important;
  }
  .chat-compose__actions .btn:not(.primary) { display: none !important; }
  .chat-compose__actions .btn .btn-kbd { display: none !important; }
  .chat-compose__actions .btn { padding: 0 10px !important; }
  .chat-group-messages { max-width: 100% !important; }
  .chat-group { margin-right: 4px !important; margin-left: 4px !important; }
`;

function injectCSS(root) {
  if (!root || root.querySelector("[data-fl]")) return;
  const s = document.createElement("style");
  s.setAttribute("data-fl", "1");
  s.textContent = CSS;
  root.appendChild(s);
}

function inject() {
  // Inject into document head
  injectCSS(document.head);

  // Set CSS vars on root
  document.documentElement.style.setProperty(
    "--shell-nav-width",
    "0px",
    "important",
  );
  document.documentElement.style.setProperty(
    "--shell-topbar-height",
    "0px",
    "important",
  );

  // Find openclaw-app and inject into its shadow root
  const app = document.querySelector("openclaw-app");
  if (app && app.shadowRoot) {
    injectCSS(app.shadowRoot);

    // Add collapse class to shell
    const shell = app.shadowRoot.querySelector(".shell");
    if (shell) {
      shell.classList.add("shell--nav-collapsed");
    }

    // Walk deeper shadow roots
    app.shadowRoot.querySelectorAll("*").forEach((el) => {
      if (el.shadowRoot) {
        injectCSS(el.shadowRoot);
      }
    });
  }
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inject);
} else {
  inject();
}

// Keep retrying as Lit components render asynchronously
let attempts = 0;
const iv = setInterval(() => {
  inject();
  if (++attempts > 60) clearInterval(iv);
}, 300);

// Also watch for DOM changes
const observer = new MutationObserver(inject);
window.addEventListener("DOMContentLoaded", () => {
  observer.observe(document.body, { childList: true, subtree: true });
});

// Stop observer after 30s
setTimeout(() => {
  observer.disconnect();
  clearInterval(iv);
}, 30000);
