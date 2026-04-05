# Architecture

## Overview

ZeusClip is a native Electron desktop application built as a monorepo with pnpm workspaces. The architecture consists of three layers: the Electron main process (native desktop shell), a Node.js server (business logic), and a React frontend (UI).

## Process Model

```
┌──────────────────────────────────────────────────────────┐
│                 Electron Main Process                     │
│                                                           │
│  ┌─────────┐ ┌──────┐ ┌───────┐ ┌──────────┐ ┌────────┐ │
│  │ Window  │ │ Menu │ │ Tray  │ │ Shortcuts│ │Clipboard│ │
│  │ Manager │ │      │ │       │ │          │ │         │ │
│  └────┬────┘ └──────┘ └───────┘ └──────────┘ └─────────┘ │
│       │                                                    │
│  ┌────┴──────────────────────────────────────────────────┐│
│  │              IPC Router (296 patterns)                 ││
│  │  URL→IPC transparent routing with HTTP fallback       ││
│  └────┬──────────────────────────────────────────────────┘│
│       │                                                    │
│  ┌────┴────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Server      │  │ Adapter      │  │ Plugin Host      │  │
│  │ Bridge      │  │ Manager      │  │ (utilityProcess) │  │
│  └──────┬──────┘  └──────────────┘  └──────────────────┘  │
└─────────┼─────────────────────────────────────────────────┘
          │ spawn(node)
          ▼
┌──────────────────────────┐     ┌─────────────────────────┐
│  Server (child process)  │     │  BrowserWindow          │
│                          │     │                          │
│  Express API (port 3100) │────▶│  React 19 SPA           │
│  85+ services            │ IPC │  35 API modules          │
│  36 route files          │     │  40+ preload APIs        │
│  PostgreSQL (embedded)   │     │  Phaser 3 workplace      │
└──────────────────────────┘     └─────────────────────────┘
```

## Main Process Modules (23)

| Module | Responsibility |
|--------|---------------|
| `index.ts` | App lifecycle, startup orchestration, single instance lock |
| `window-manager.ts` | BrowserWindow creation, position/size persistence, macOS hide-to-tray |
| `menu.ts` | Native menu bar with 5 menus, keyboard accelerators |
| `tray.ts` | System tray icon, context menu, dock badge count |
| `notifications.ts` | OS-level notifications (agent complete, approval, budget, error) |
| `context-menu.ts` | Right-click menus (cut/copy/paste, spell check, links, inspect) |
| `global-shortcuts.ts` | System-wide shortcuts (Cmd+Shift+T capture, Cmd+Shift+P toggle) |
| `clipboard.ts` | Read/write text, HTML, images; copy issues as markdown |
| `drag-drop.ts` | Drag agent configs as JSON, issues as markdown files |
| `touchbar.ts` | macOS Touch Bar with contextual controls |
| `dock-progress.ts` | Dock/taskbar progress during agent runs |
| `deep-links.ts` | `titanclip://` protocol handler |
| `protocol.ts` | Custom `app://` protocol for production UI serving |
| `paths.ts` | Centralized ASAR-safe path resolution (12 functions) |
| `server-bridge.ts` | Server child process lifecycle (spawn, stop, health poll) |
| `database.ts` | Database initialization (SQLite or PostgreSQL) |
| `service-container.ts` | Service layer instantiation (25+ services) |
| `ipc-router.ts` | Core IPC handlers (app info, shell, nav, theme, dialogs) |
| `ipc-service-handlers.ts` | Business logic IPC (80+ channels mapped to services) |
| `adapter-manager.ts` | Adapter process tracking, auto-restart with backoff |
| `plugin-host.ts` | Plugin utility processes with MessagePort IPC |
| `file-storage.ts` | Direct filesystem ops, backup management |
| `updater.ts` | Auto-update via electron-updater |

## IPC Transport

The UI makes API calls using the same `api.get("/path")` syntax as a web app. The `client.ts` transport layer intercepts these and routes through IPC when running in Electron:

```
api.get("/companies/abc/agents")
  ↓ client.ts tryIpcRoute()
  ↓ matches: GET /companies/([^/]+)/agents → "agents:list"
  ↓ window.electronAPI.invoke("agents:list", { companyId: "abc" })
  ↓ ipcMain.handle → service call → result
```

296 URL-to-IPC patterns cover the full API. Unmatched routes fall back to HTTP with a `console.warn`.

## Database

Two engines supported:

| Engine | Use Case | Startup Time |
|--------|----------|-------------|
| **PostgreSQL** (embedded) | Default, full feature set | ~10-15s |
| **SQLite** (better-sqlite3) | Future native mode, instant startup | <1s |

The SQLite schema (72 files) is auto-generated from the PostgreSQL schema with type conversions:
- `uuid` → `text`
- `jsonb` → `text` (JSON string)
- `timestamp with timezone` → `text` (ISO 8601)
- `boolean` → `integer` (mode: "boolean")

## Adapter System

Adapters execute agent work by spawning CLI tools as child processes:

```
Agent → Adapter Registry → spawn("claude", [...args])
                        → spawn("codex", [...args])
                        → spawn("cursor", [...args])
```

The adapter manager tracks active processes, streams stdout/stderr to the renderer, and handles crash recovery with exponential backoff (5 retries, 1s→16s).

## Plugin System

Plugins run in isolated Electron `utilityProcess` workers:
- MessagePort for efficient IPC (no JSON-RPC over stdio)
- Custom `plugin://` protocol for serving plugin UI assets
- Start/stop/restart lifecycle management
- Crash isolation (plugin crash doesn't affect main process)

## Production Build

The production build bundles:
- Electron main process (23 modules in `dist/`)
- Server compiled JS (in `extraResources/server-dist/`)
- Server `node_modules` (pre-bundled, with ESM→CJS patches)
- UI static files (in `extraResources/ui-dist/`)
- SQLite migrations, skills, entitlements

The server runs as a child process using **system Node.js** (not Electron's built-in Node) to avoid ASAR/ESM conflicts.
