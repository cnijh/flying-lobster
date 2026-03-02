# PRD: Screen Vision for Flying Lobster

## Overview

Give OpenClaw agents the ability to see what the user sees on their screen. An "eye" toggle button in each FL session titlebar enables screen capture mode — every user message automatically includes a screenshot of the current screen, so the agent can reference what the user is looking at.

## Problem

Users currently need to manually screenshot, copy/paste, or describe what's on their screen when discussing visual content with agents. This breaks flow and loses context (cursor position, active app, highlighted text).

## Solution

A per-session toggle in Flying Lobster that captures screen context and attaches it to every outgoing message while active.

## User Flow

1. User clicks the 👁 (eye) button in a session's titlebar
2. Button glows/activates to indicate screen vision is ON
3. User types a message (e.g., "what do you think of this layout?")
4. Before the message is sent, FL captures:
   - Full screen screenshot (PNG, scaled to reasonable size)
   - Active window name + app
   - Mouse cursor position (x, y)
   - Selected text (if any, via Accessibility API)
5. Screenshot is attached to the message as an image
6. Metadata (cursor, active app, selection) is prepended as a system note
7. Agent receives the message + screenshot + metadata and responds contextually
8. User clicks 👁 again to turn OFF

## Technical Design

### Titlebar Eye Button (renderer: session.html)

- Add a `👁` button in the titlebar's right spacer area
- Toggle state stored per session window (in-memory)
- Visual states:
  - OFF: dim/gray eye icon
  - ON: glowing accent-colored eye with subtle pulse animation
- No-drag region so it's clickable

### Screen Capture (main process: index.js)

- IPC channel: `toggle-screen-vision` (renderer → main)
- IPC channel: `screen-vision-status` (main → renderer)
- IPC channel: `capture-screen` (renderer → main, returns data)

**Capture implementation:**

```
screencapture -x -C -t png /tmp/fl-screen-capture-{sessionId}.png
```

- `-x` = no sound
- `-C` = capture cursor
- `-t png` = PNG format

**Resize:** Scale to max 1920px wide (or 50% of original) to keep token cost reasonable. Use `sips` (built-in macOS):

```
sips --resampleWidth 1920 /tmp/fl-screen-capture-{sessionId}.png
```

### Metadata Collection (main process)

Use AppleScript / native APIs:

- **Active app + window:** `osascript -e 'tell application "System Events" to get {name, title} of first process whose frontmost is true'`
- **Cursor position:** `osascript -e 'tell application "System Events" to get position of mouse'` (or CGEvent via native module)
- **Selected text:** `osascript -e 'tell application "System Events" to keystroke "c" using command down'` then read clipboard — OR use Accessibility API via a small Swift helper

For v1, use AppleScript for active app + cursor. Skip selected text (requires Accessibility permission setup — add in v2).

### Message Injection (preload-webview.js)

When screen vision is ON and user submits a message:

1. Intercept the form submit in the webview
2. Call `capture-screen` IPC to get screenshot + metadata
3. Prepend metadata context to the message:
   ```
   [Screen Context: Active app: "Figma", Window: "Dashboard — Figma", Cursor: (842, 391)]
   ```
4. Attach the screenshot image to the message

**Image attachment approach:**

- Convert screenshot to base64 data URL
- Inject it into OpenClaw's webchat message as an image attachment
- OpenClaw webchat supports image paste/upload — simulate a paste event with the image data

### Per-Session Independence

- Each `BrowserWindow` (session) has its own `screenVisionEnabled` boolean
- Toggling in one session doesn't affect others
- Capture uses session-specific temp files to avoid race conditions

### Permissions

- **Screen Recording** permission required (macOS System Preferences → Privacy → Screen Recording)
- On first toggle, if permission not granted, show a native dialog explaining the requirement
- Check permission status via: `tccutil` or attempt capture and check for failure

## Scope

### v1 (This ticket)

- [x] Eye button in titlebar with toggle state
- [x] Screen capture via `screencapture` CLI on each message
- [x] Active app + window name via AppleScript
- [x] Image attachment to webchat message
- [x] Per-session independent toggle
- [x] Permission check + user prompt

### v2 (Future)

- [ ] Selected text via Accessibility API
- [ ] Cursor position overlay on screenshot
- [ ] Configurable capture area (full screen vs active window only)
- [ ] Resolution/quality settings
- [ ] Continuous mode (periodic capture without message trigger)

## Files to Modify

1. `src/renderer/session.html` — Add eye button + styles + toggle logic
2. `src/main/preload-session.js` — Add IPC bindings for screen vision
3. `src/main/index.js` — Add screen capture IPC handlers
4. `src/main/preload-webview.js` — Add message interception + image injection

## Edge Cases

- User switches screens between message and capture → capture what's current, that's fine
- Multiple displays → `screencapture` captures all displays by default; use `-D` flag for primary only
- Permission denied → graceful fallback, disable toggle, show message
- Large screenshots → resize keeps token cost manageable (~2-4K tokens per image)
