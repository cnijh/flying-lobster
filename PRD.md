# Flying Lobster 🦞 — PRD v1

## What
Lightweight, always-on-top desktop chat window for talking to OpenClaw bot gateway instances. One hotkey away, anywhere on your computer, even over fullscreen apps.

## Tech Stack
- **Electron** (cross-platform: Mac, Windows, Linux)
- **electron-store** for persistent config (JSON on disk)
- **BrowserWindow/WebView** embedding OpenClaw web UI (chat only)

## Core Features (MVP)

### 1. Global Hotkey
- Default: `Cmd+Shift+L` (Mac) / `Ctrl+Shift+L` (Win)
- User-customizable in settings
- Toggles window show/hide

### 2. Always-on-Top Window
- Floats above ALL windows including fullscreen apps
- Small footprint (~400x600, resizable)
- Remembers position/size across restarts
- Hide: hotkey, Esc, or click outside
- Show: hotkey or tray icon click

### 3. System Tray
- Tray icon (🦞 or lobster icon)
- Click to toggle window
- Right-click menu: show, settings, quit

### 4. Gateway Management
- Add/edit/delete gateway configs (name + URL)
- Switch between gateways via dropdown in app
- Connection status indicator (green/red dot)
- Persisted via electron-store

### 5. Chat-Only UI
- Loads OpenClaw gateway web UI in webview
- CSS injected to hide header, sidebar, nav — only chat visible
- Auto-loads active gateway on startup

### 6. Settings
- Gateway list management
- Hotkey customization
- Window behavior preferences

## Config Schema (electron-store)
```json
{
  "gateways": [
    { "id": "uuid", "name": "Rooty", "url": "http://localhost:19002" }
  ],
  "activeGateway": "uuid",
  "hotkey": "CommandOrControl+Shift+L",
  "windowBounds": { "x": 100, "y": 100, "width": 400, "height": 600 }
}
```

## Architecture
```
System Tray 🦞
    │
Electron Main Process
├── Global hotkey listener (globalShortcut)
├── Window manager (show/hide/position)
├── Config store (electron-store)
└── BrowserWindow
    ├── Gateway selector bar (top)
    └── WebView → OpenClaw UI (CSS-injected, chat only)
```

## Out of Scope (v2+)
- Native chat UI (replace webview)
- Notifications/badges
- File drag & drop
- Multi-window
- Auto-discovery of local gateways
