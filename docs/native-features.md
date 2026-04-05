# Native Desktop Features

## Application Menu

Full native menu bar with keyboard shortcuts:

| Menu | Shortcut | Action |
|------|----------|--------|
| **File > New Agent** | Cmd+N | Navigate to agent creation |
| **File > New Issue** | Cmd+Shift+N | Open new issue dialog |
| **File > Preferences** | Cmd+, | Open instance settings |
| **Edit** | — | Undo, Redo, Cut, Copy, Paste, Select All |
| **View > Dashboard** | Cmd+1 | Navigate to dashboard |
| **View > Agents** | Cmd+2 | Navigate to agents |
| **View > Issues** | Cmd+3 | Navigate to issues |
| **View > Projects** | Cmd+4 | Navigate to projects |
| **View > Costs** | Cmd+5 | Navigate to costs |
| **View > Command Palette** | Cmd+K | Open command palette |

The Edit menu is critical on macOS — without it, Cmd+C/V/X don't work in text fields.

## System Tray

Persistent tray icon with:
- Click to show/hide window
- Context menu: Show, Dashboard, Agents, Issues, Quit
- Badge count for pending approvals (macOS dock)

## Notifications

OS-level notifications for:
- **Agent completed task** — click to view the issue
- **Approval required** — click to review
- **Budget threshold breach** — click to view costs
- **Agent error** — click to view details

## Global Shortcuts

System-wide shortcuts that work even when the app is not focused:

| Shortcut | Action |
|----------|--------|
| **Cmd+Shift+T** | Quick issue capture — opens a mini floating window |
| **Cmd+Shift+P** | Toggle app visibility |

The quick capture window supports:
- Title and description fields
- Cmd+Enter to submit
- Escape to dismiss
- Auto-closes on blur

## Clipboard

Native clipboard operations available to the UI:

- **Copy issue as markdown** — identifier, title, status, priority, description
- **Copy agent config as JSON** — full adapter configuration
- **Read clipboard images** — for pasting screenshots into issues
- **Rich clipboard** — write HTML + plain text simultaneously

## Drag & Drop

Drag items from the app to other applications:
- **Agent config** → JSON file on desktop
- **Issue details** → Markdown file on desktop

## Touch Bar (macOS)

Context-sensitive Touch Bar controls:

| View | Controls |
|------|----------|
| **Default** | Dashboard, Agents, Issues, Costs, Cmd+K |
| **Approvals** | Back, Approve (green), Reject (red), pending count |
| **Agents** | + New Agent, agent/active run count |

## Dock Progress

Shows progress indicators in the OS dock (macOS) or taskbar (Windows):
- **Indeterminate** during agent runs
- **Normal** for export/import operations
- **Error** state (auto-clears after 5s)

## Context Menus

Right-click context menus with:
- Cut, Copy, Paste, Select All (for text fields)
- Spell check suggestions
- Copy Link Address, Open in Browser (for links)
- Inspect Element (development mode only)
- Custom context menus via IPC from the renderer

## Deep Links

Register `titanclip://` protocol for opening views from external links:

```
titanclip://dashboard
titanclip://agents/abc123
titanclip://issues/xyz456
titanclip://approvals/def789
```

Supports second-instance forwarding — if the app is already running, the deep link is forwarded to the existing instance.

## Window Management

- **Position/size persistence** — saved to `userData/window-state.json`
- **Multi-display support** — validates position is on a visible screen
- **macOS hide-to-tray** — closing the window hides to tray (Quit from menu or tray to exit)
- **Single instance lock** — prevents multiple app instances

## Quit Button

A power icon button in the title bar (next to theme toggle) for clean shutdown. Only shown when running in Electron. Triggers `app.quit()` which:
1. Sets `forceQuit = true`
2. Stops the server child process (SIGTERM → 5s → SIGKILL)
3. Unregisters global shortcuts
4. Kills adapter processes
5. Stops plugin workers
6. Destroys tray
7. Exits
