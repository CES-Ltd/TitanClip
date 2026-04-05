# TitanClip Native Electron Rewrite Plan

## Executive Summary

TitanClip currently runs as a **thin Electron shell wrapping a full Express.js HTTP server** spawned as a child process. The renderer communicates with business logic entirely over `http://127.0.0.1:3100` REST + WebSocket — treating Electron as a glorified browser window. This plan rewrites the architecture to be **Electron-native**: business logic runs in the main process (or utility processes), the renderer communicates via IPC, and native desktop capabilities replace browser workarounds.

---

## Current Architecture (Problems)

```
┌─────────────────────────────┐
│  Electron Main Process      │  ← Only 8 IPC channels, ~200 LOC
│  (thin launcher shell)      │     Just spawns server + manages window
└──────────┬──────────────────┘
           │ spawn()
           ▼
┌─────────────────────────────┐
│  Express Server (child)     │  ← Full HTTP stack: 36 route files,
│  127.0.0.1:3100             │     85+ services, middleware, CORS,
│  REST + WebSocket           │     auth, etc. — all over localhost
└──────────┬──────────────────┘
           │ HTTP/WS
           ▼
┌─────────────────────────────┐
│  BrowserWindow (Renderer)   │  ← React 19 SPA loaded from
│  loads http://localhost:3100│     localhost, fetch()-based API
└─────────────────────────────┘
```

### Key Anti-Patterns

| Problem | Impact |
|---------|--------|
| **HTTP over localhost for local-only app** | Unnecessary serialization, port conflicts, startup delay (polls health for up to 120s), CORS config for self |
| **Child process server** | Complex lifecycle mgmt, crash recovery absent, stdout/stderr piping, environment variable ceremony |
| **8 IPC channels total** | Main process is wasted — no native menus, no tray, no notifications, no file dialogs, no global shortcuts |
| **WebSocket for live events** | Could be direct IPC (faster, no connection management, no reconnect logic) |
| **Service worker for offline** | Electron apps are inherently offline-capable; SW adds complexity for no gain |
| **No native menus** | No keyboard shortcuts, no Edit menu (copy/paste broken on macOS without it), no Help menu |
| **No tray icon** | App disappears when window closes on macOS |
| **Browser-style navigation (back/forward)** | Desktop apps should use proper navigation, not browser history |
| **Embedded PostgreSQL as separate process** | Additional process to manage; SQLite would be simpler for local-first |
| **IPC channel name mismatch** | `get-version` vs `get-app-version` — bug in current code |

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Electron Main Process                   │
│                                                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ Service Layer │  │ Database      │  │ Native APIs  │  │
│  │ (85+ services│  │ (better-      │  │ (Tray, Menu, │  │
│  │  in-process) │  │  sqlite3 /    │  │  Dialogs,    │  │
│  │              │  │  PostgreSQL)  │  │  Notif, etc) │  │
│  └──────┬───────┘  └───────────────┘  └──────────────┘  │
│         │                                                │
│  ┌──────┴───────┐  ┌───────────────┐                     │
│  │ IPC Router   │  │ Adapter Mgr   │                     │
│  │ (replaces    │  │ (subprocess   │                     │
│  │  Express)    │  │  orchestrator)│                     │
│  └──────┬───────┘  └───────────────┘                     │
└─────────┼───────────────────────────────────────────────┘
          │ contextBridge / ipcMain.handle
          ▼
┌─────────────────────────────────────────────────────────┐
│               BrowserWindow (Renderer)                   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  React 19 SPA (loaded from file:// or asar://)   │    │
│  │  API client calls window.electronAPI.*            │    │
│  │  Live events via IPC (no WebSocket)               │    │
│  └──────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 0: Foundation & Infrastructure (Week 1-2)

### 0.1 — Project Setup & Build System

**Goal**: Establish the rewrite build infrastructure without breaking existing functionality.

- [ ] Create `tsconfig.main.json` for main process (target: ESNext, module: ESNext with NodeNext resolution)
- [ ] Add `electron-vite` or configure Vite for main/preload/renderer triple-build
- [ ] Configure `electron-builder.yml` to use `asar: true` (current: false — security/perf issue)
- [ ] Add proper code signing configuration for macOS (notarization) and Windows (EV cert)
- [ ] Pin Electron version (currently `^33.0.0` — pin to exact `33.x.y`)
- [ ] Add `electron-updater` for auto-update support
- [ ] Set up proper dev workflow: `electron-vite dev` with HMR for renderer + restart for main

**Files to modify/create:**
- `package.json` — add electron-vite, update scripts
- `electron.vite.config.ts` — new triple-target config
- `tsconfig.main.json` — new main process TS config
- `electron-builder.yml` — asar, signing, auto-update

### 0.2 — IPC Architecture Design

**Goal**: Define the IPC contract that replaces the REST API.

Create a typed IPC system using a shared channel map:

```typescript
// packages/shared/src/ipc-channels.ts
export type IpcChannelMap = {
  // Companies
  'companies:list': { args: void; result: Company[] }
  'companies:get': { args: { id: string }; result: Company }
  'companies:create': { args: CreateCompanyInput; result: Company }
  'companies:update': { args: { id: string; data: UpdateCompanyInput }; result: Company }
  'companies:delete': { args: { id: string }; result: void }

  // Agents
  'agents:list': { args: { companyId: string }; result: Agent[] }
  'agents:get': { args: { id: string }; result: Agent }
  'agents:create': { args: CreateAgentInput; result: Agent }
  'agents:wake': { args: { id: string }; result: void }
  // ... 200+ channels mapping all 36 route files

  // Live events (main → renderer push)
  'live:event': { args: LiveEvent; result: void }

  // Native
  'native:showOpenDialog': { args: OpenDialogOptions; result: string[] }
  'native:showSaveDialog': { args: SaveDialogOptions; result: string }
  'native:showNotification': { args: NotificationOptions; result: void }
  'native:setTrayTooltip': { args: string; result: void }
}
```

**Files to create:**
- `packages/shared/src/ipc-channels.ts` — typed channel definitions
- `packages/shared/src/ipc-helpers.ts` — typesafe invoke/handle wrappers

---

## Phase 1: Native Electron Shell (Week 2-3)

### 1.1 — Application Menu & Keyboard Shortcuts

**Goal**: Proper native menu bar with keyboard shortcuts.

```typescript
// src/main/menu.ts
const template: MenuItemConstructorOptions[] = [
  // macOS app menu
  { role: 'appMenu' },
  // File menu
  {
    label: 'File',
    submenu: [
      { label: 'New Agent', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('navigate', '/agents/new') },
      { label: 'New Issue', accelerator: 'CmdOrCtrl+Shift+N', click: () => ... },
      { type: 'separator' },
      { label: 'Import Company...', click: () => showImportDialog() },
      { label: 'Export Company...', click: () => showExportDialog() },
      { type: 'separator' },
      { role: 'quit' }
    ]
  },
  // Edit menu (CRITICAL for macOS copy/paste!)
  { role: 'editMenu' },
  // View menu
  {
    label: 'View',
    submenu: [
      { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => navigate('/dashboard') },
      { label: 'Agents', accelerator: 'CmdOrCtrl+2', click: () => navigate('/agents') },
      { label: 'Issues', accelerator: 'CmdOrCtrl+3', click: () => navigate('/issues') },
      { type: 'separator' },
      { label: 'Command Palette', accelerator: 'CmdOrCtrl+K', click: () => win.webContents.send('open-command-palette') },
      { type: 'separator' },
      { role: 'toggleDevTools' },
      { role: 'togglefullscreen' }
    ]
  },
  // Window menu
  { role: 'windowMenu' },
  // Help menu
  {
    label: 'Help',
    submenu: [
      { label: 'Documentation', click: () => shell.openExternal('https://docs.titanclip.com') },
      { label: 'Report Issue', click: () => shell.openExternal('https://github.com/...') },
      { type: 'separator' },
      { label: `TitanClip v${app.getVersion()}`, enabled: false }
    ]
  }
]
```

**Files to create:**
- `src/main/menu.ts` — native menu with accelerators
- `src/main/shortcuts.ts` — global shortcuts (Cmd+Shift+Space for quick capture)

### 1.2 — System Tray

**Goal**: Persistent tray icon with status indication and quick actions.

```typescript
// src/main/tray.ts
- Tray icon showing agent activity status (idle/active/error)
- Context menu: Show Window, Quick Actions, Running Agents count, Quit
- Badge count for pending approvals (macOS dock badge)
- Animate icon when agents are executing
```

**Files to create:**
- `src/main/tray.ts`
- `assets/tray-icon.png`, `assets/tray-icon-active.png` (template images for macOS)

### 1.3 — Native Notifications

**Goal**: Replace toast-only notifications with OS-level notifications.

```typescript
// src/main/notifications.ts
- Agent completed task → native notification with action buttons
- Approval required → notification with "Approve" / "Review" actions
- Budget threshold → warning notification
- Agent error → error notification with "View Details" action
- Respect system Do Not Disturb
- Group notifications by company
```

**Files to create:**
- `src/main/notifications.ts`

### 1.4 — Native File Dialogs

**Goal**: Use `dialog.showOpenDialog` / `dialog.showSaveDialog` instead of browser file inputs.

```typescript
// IPC handlers for file operations
ipcMain.handle('native:showOpenDialog', async (_, options) => {
  return dialog.showOpenDialog(mainWindow, options)
})
ipcMain.handle('native:showSaveDialog', async (_, options) => {
  return dialog.showSaveDialog(mainWindow, options)
})
```

**Files to modify:**
- `src/main.ts` → `src/main/index.ts` (refactor into module structure)
- `src/preload.ts` — expose dialog APIs
- `ui/src/components/*` — replace `<input type="file">` with IPC calls

### 1.5 — Window Management

**Goal**: Multi-window support, proper window state persistence.

```typescript
// src/main/window-manager.ts
- Remember window position/size across restarts (electron-window-state)
- Support detachable panels (agent detail, issue detail in separate windows)
- Proper close behavior: hide to tray on macOS, minimize to tray on Windows
- Deep link support: titanclip:// protocol handler
- Single instance lock (prevent multiple app instances)
```

**Files to create:**
- `src/main/window-manager.ts`
- `src/main/deep-links.ts` — protocol handler registration

---

## Phase 2: Eliminate HTTP Server — Move to IPC (Week 3-6)

This is the **core architectural change**. The Express server's services move into the main process, and all renderer↔main communication uses IPC instead of HTTP.

### 2.1 — IPC Router (Replace Express)

**Goal**: Create an IPC-based router that maps channel names to service calls.

```typescript
// src/main/ipc-router.ts
import { ipcMain } from 'electron'
import type { IpcChannelMap } from '@titanclip/shared/ipc-channels'

export function registerIpcHandlers(services: ServiceContainer) {
  // Auto-register all handlers from channel map
  handle('companies:list', () => services.company.list())
  handle('companies:get', ({ id }) => services.company.get(id))
  handle('companies:create', (input) => services.company.create(input))
  // ... all 200+ routes

  // Live events: push from main to renderer
  services.liveEvents.on('event', (event) => {
    mainWindow.webContents.send('live:event', event)
  })
}
```

**Migration strategy** (per route file):
1. Take one route file (e.g., `server/src/routes/agents.ts`)
2. Extract the handler logic (strip Express req/res boilerplate)
3. Register as IPC handler with typed channel
4. Update UI API client to use `window.electronAPI.invoke('agents:list')` instead of `fetch('/api/agents')`
5. Remove the Express route
6. Repeat for all 36 route files

### 2.2 — Service Layer Migration

**Goal**: Move all 85+ services from the server child process into the main process.

```
server/src/services/* → src/main/services/*
```

**Key changes:**
- Services no longer need `req.actor` from middleware — actor context comes from IPC metadata
- Remove Express-specific patterns (req, res, next)
- Services become pure functions: `(db, input) → result`
- Error handling: throw typed errors instead of `res.status(4xx).json()`

**Migration order** (by dependency and usage frequency):
1. `companyService` — foundational, everything depends on it
2. `agentService` — most-used entity
3. `issueService` — core workflow
4. `dashboardService` — home page
5. `activityService` — audit log
6. `liveEventsService` — convert WebSocket → IPC push
7. `costService`, `financeService` — financial tracking
8. `secretService`, `vaultService` — security (keep encryption in main process)
9. `pluginLoader`, `pluginLifecycleManager`, etc. — plugin system
10. All remaining services

### 2.3 — Live Events: WebSocket → IPC

**Goal**: Replace the WebSocket connection with direct IPC event pushing.

**Current flow:**
```
Server → ws.send(event) → Browser WebSocket → LiveUpdatesProvider → React state
```

**New flow:**
```
Main process service → mainWindow.webContents.send('live:event', event) → preload bridge → React context
```

**Files to modify:**
- `server/src/services/live-events-ws.ts` → `src/main/services/live-events.ts`
- `ui/src/context/LiveUpdatesProvider.tsx` — listen to IPC instead of WebSocket
- `src/preload.ts` — expose `onLiveEvent` callback registration

### 2.4 — API Client Rewrite

**Goal**: Replace the fetch-based API client with IPC-based client.

```typescript
// ui/src/api/client.ts — BEFORE
export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: 'include' })
  if (!res.ok) throw new ApiError(res.status, await res.json())
  return res.json()
}

// ui/src/api/client.ts — AFTER
export async function invoke<C extends keyof IpcChannelMap>(
  channel: C,
  args: IpcChannelMap[C]['args']
): Promise<IpcChannelMap[C]['result']> {
  return window.electronAPI.invoke(channel, args)
}
```

**Each API module** (37 files in `ui/src/api/`) gets rewritten:
```typescript
// ui/src/api/agents.ts — BEFORE
export const listAgents = (companyId: string) => get<Agent[]>(`/companies/${companyId}/agents`)

// ui/src/api/agents.ts — AFTER
export const listAgents = (companyId: string) => invoke('agents:list', { companyId })
```

### 2.5 — Authentication Simplification

**Goal**: In local_trusted mode (primary use case), eliminate auth middleware entirely.

**Current**: Every HTTP request goes through `actorMiddleware` to resolve auth context.
**New**: Main process *is* the trusted context. No auth needed for local IPC.

For multi-user/remote modes, keep the existing auth but as a separate concern:
- `local_trusted` → IPC calls are inherently trusted (same user, same machine)
- `authenticated` → Keep server mode as a separate deployment target (not Electron)

### 2.6 — Remove Express & HTTP Dependencies

**Goal**: After all routes are migrated, remove the Express server entirely.

**Remove from dependencies:**
- `express`, `cors`, `helmet`, `compression`
- `ws` (WebSocket library)
- `better-auth` (only needed for server mode)
- HTTP client libraries used for self-calls

**Remove from codebase:**
- `server/src/app.ts` — Express app setup
- `server/src/routes/*` — all 36 route files
- `server/src/middleware/*` — all middleware
- `server/src/auth/*` — auth middleware
- Server health polling in `src/main.ts`
- Splash screen / loading spinner

---

## Phase 3: Database Migration (Week 4-5)

### 3.1 — Evaluate: Keep PostgreSQL vs Switch to SQLite

**Option A: Keep Embedded PostgreSQL**
- Pros: No schema migration, Drizzle ORM works unchanged, advanced queries (JSONB, arrays)
- Cons: Extra process, 100MB+ footprint, slower cold start, complex lifecycle

**Option B: Switch to better-sqlite3** (RECOMMENDED for local-first)
- Pros: In-process (no separate DB server), zero config, instant startup, smaller footprint, WAL mode for concurrent reads, simpler backups (copy file)
- Cons: Schema migration work, no JSONB (use JSON text columns), no array columns
- Migration effort: ~60 migration files to convert; Drizzle supports SQLite natively

**Recommendation**: Switch to **better-sqlite3** for the Electron app. Keep PostgreSQL support as an option for server deployments.

### 3.2 — Schema Migration (if switching to SQLite)

```typescript
// packages/db/src/schema-sqlite/
- Convert PostgreSQL-specific types:
  - `uuid` → `text` (store UUIDs as strings)
  - `jsonb` → `text` (JSON.stringify/parse)
  - `timestamp with time zone` → `text` (ISO 8601 strings)
  - `serial` → `integer` (autoincrement)
  - Array columns → junction tables or JSON text
- Keep Drizzle ORM (supports SQLite via `drizzle-orm/better-sqlite3`)
- Write new migration set for SQLite
- Add migration tool to convert existing PostgreSQL data → SQLite
```

### 3.3 — Database in Main Process

```typescript
// src/main/database.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const dbPath = path.join(app.getPath('userData'), 'titanclip.db')
const sqlite = new Database(dbPath, { /* WAL mode */ })
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
```

**Backup strategy**: Simple file copy of `titanclip.db` (no pg_dump needed).

---

## Phase 4: Native Desktop Features (Week 5-7)

### 4.1 — Auto-Updater

```typescript
// src/main/updater.ts
import { autoUpdater } from 'electron-updater'
- Check for updates on launch and periodically
- Show native dialog for update availability
- Download in background, install on restart
- Progress notification in tray
```

### 4.2 — Deep Link Protocol Handler

```typescript
// src/main/deep-links.ts
app.setAsDefaultProtocolClient('titanclip')
// Handle: titanclip://agents/abc123, titanclip://issues/xyz456
// Open specific views from external links (Slack, email, etc.)
```

### 4.3 — Native Drag & Drop

```typescript
// Enable dragging agent cards, issue cards between views
// Drag files into issue attachments
// Drag agent configs to export
```

### 4.4 — Clipboard Integration

```typescript
// src/main/clipboard.ts
- Copy agent instructions to clipboard
- Copy issue details as markdown
- Paste images into issue descriptions
- Rich clipboard (HTML + plain text)
```

### 4.5 — Touch Bar (macOS)

```typescript
// src/main/touchbar.ts
- Quick agent status indicators
- Approval action buttons
- Navigation shortcuts
```

### 4.6 — Native Context Menus

```typescript
// Right-click context menus for:
- Agent list items (Wake, Edit, Delete, Copy Config)
- Issue list items (Assign, Change Priority, Copy Link)
- Text areas (Cut, Copy, Paste, Select All — currently broken without Edit menu!)
```

### 4.7 — Global Shortcut for Quick Capture

```typescript
// src/main/global-shortcuts.ts
globalShortcut.register('CmdOrCtrl+Shift+T', () => {
  // Show quick-capture window for creating issues from anywhere
  showQuickCaptureWindow()
})
```

---

## Phase 5: Renderer Optimization (Week 6-8)

### 5.1 — Load UI from Local Files

**Current**: UI loaded from `http://127.0.0.1:3100` (served by Express).
**New**: UI loaded from `file://` or custom protocol.

```typescript
// src/main/index.ts
if (isDev) {
  mainWindow.loadURL('http://localhost:5173') // Vite dev server with HMR
} else {
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  // OR use custom protocol for proper path resolution:
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.replace('app://', '')
    callback({ path: path.join(__dirname, '../renderer', url) })
  })
}
```

### 5.2 — Remove Service Worker

Service workers are unnecessary in Electron (the app is already local). Remove:
- `ui/public/sw.js`
- Service worker registration in `ui/src/main.tsx`

### 5.3 — Preload Script Expansion

Expand the preload bridge to expose all IPC channels:

```typescript
// src/preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  // Typed invoke for all channels
  invoke: <C extends keyof IpcChannelMap>(channel: C, args: IpcChannelMap[C]['args']) =>
    ipcRenderer.invoke(channel, args),

  // Event subscriptions (main → renderer)
  onLiveEvent: (callback: (event: LiveEvent) => void) =>
    ipcRenderer.on('live:event', (_, event) => callback(event)),

  onNavigate: (callback: (path: string) => void) =>
    ipcRenderer.on('navigate', (_, path) => callback(path)),

  // Native APIs
  platform: process.platform,
  version: app.getVersion(), // available at preload time

  // File operations
  showOpenDialog: (options) => ipcRenderer.invoke('native:showOpenDialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('native:showSaveDialog', options),

  // Cleanup
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
})
```

### 5.4 — Remove Browser Navigation Workarounds

Remove the browser-style back/forward navigation from `AppTitleBar.tsx`. Replace with proper in-app navigation using React Router.

---

## Phase 6: Adapter System Optimization (Week 7-8)

### 6.1 — Adapter Registry in Main Process

Move adapter registry from server to main process:

```typescript
// src/main/adapters/registry.ts
- Import all adapter modules directly (no HTTP boundary)
- Adapters still spawn child processes (Claude CLI, Codex, Cursor, etc.)
- But orchestration is in-process (no Express routes involved)
- IPC handlers for adapter operations:
  'adapters:execute' — run an adapter
  'adapters:test-environment' — test adapter setup
  'adapters:list-models' — get available models
  'adapters:sync-skills' — sync skills from adapter
```

### 6.2 — Adapter Process Management

```typescript
// src/main/adapters/process-manager.ts
- Track spawned adapter processes in main process
- Graceful shutdown on app quit (send SIGTERM, then SIGKILL after timeout)
- Process monitoring: CPU/memory usage per adapter
- Automatic restart on crash (with backoff)
- Stream logs directly to renderer via IPC (no stdout piping through server)
```

---

## Phase 7: Plugin System Native Integration (Week 8-9)

### 7.1 — Plugin Worker in Utility Process

Replace worker threads with Electron utility processes:

```typescript
// src/main/plugins/plugin-host.ts
import { utilityProcess } from 'electron'

const worker = utilityProcess.fork(pluginWorkerPath, [], {
  serviceName: `plugin-${pluginId}`,
  stdio: 'pipe',
})

// Communication via MessagePort (faster than JSON-RPC over stdio)
const { port1, port2 } = new MessageChannelMain()
worker.postMessage({ type: 'init', port: port1 }, [port1])
```

### 7.2 — Plugin UI: Direct Renderer Integration

Instead of loading plugin UI from `/_plugins/:pluginId/ui/:entryFile` over HTTP, load from local file system:

```typescript
// Custom protocol for plugin assets
protocol.registerFileProtocol('plugin', (request, callback) => {
  const pluginPath = resolvePluginPath(request.url)
  callback({ path: pluginPath })
})
```

---

## Phase 8: Data & Storage (Week 8-9)

### 8.1 — File Storage: Direct Filesystem

Replace the `LocalDiskProvider` HTTP abstraction with direct file operations in the main process:

```typescript
// src/main/storage/file-storage.ts
- Direct fs.writeFile / fs.readFile (no HTTP upload/download)
- IPC handlers for file operations with progress reporting
- Drag & drop file handling in main process
- Thumbnail generation for images (sharp or native)
```

### 8.2 — Backup System

```typescript
// src/main/backup.ts
- SQLite: simple file copy (no pg_dump)
- Incremental backups using file modification timestamps
- Backup to user-specified directory
- iCloud/OneDrive/Dropbox integration via file system
- Export/import as JSON for company portability
```

---

## Phase 9: Testing & Quality (Week 9-10)

### 9.1 — Test Infrastructure

```typescript
// vitest.config.ts updates
- Main process tests: mock Electron APIs, test IPC handlers
- Renderer tests: mock window.electronAPI, test React components
- Integration tests: Playwright with Electron support (@playwright/test + electron)
- E2E: Full app launch, IPC round-trip verification
```

### 9.2 — IPC Contract Testing

```typescript
// Ensure all IPC channels have:
- Type-safe handler registration (compile-time check)
- Matching preload exposure
- Corresponding renderer API call
- Error serialization across process boundary
```

---

## Phase 10: Build & Distribution (Week 10)

### 10.1 — Electron Builder Update

```yaml
# electron-builder.yml
asar: true  # Package as asar archive (security + performance)
electronDownload:
  mirror: https://... # Cache Electron binaries

mac:
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: entitlements.mac.plist
  notarize:
    teamId: TEAM_ID
  target:
    - { target: dmg, arch: [arm64, x64] }
    - { target: zip, arch: [arm64, x64] }

win:
  certificateFile: ...
  target:
    - { target: nsis, arch: [x64, arm64] }

linux:
  target:
    - { target: AppImage, arch: [x64, arm64] }
    - { target: deb, arch: [x64, arm64] }

publish:
  provider: github  # Auto-update from GitHub Releases
```

### 10.2 — Remove Unnecessary Bundled Resources

Current `extraResources` bundles the full server and its node_modules. After rewrite:
- Remove `server-dist/` bundling
- Remove `server-dist/node_modules` copy from `/tmp`
- Keep `ui-dist/` for renderer HTML/JS/CSS
- Keep `skills/` for plugin/skill assets
- Add `migrations/` if using SQLite with Drizzle

---

## File Structure: Before vs After

### BEFORE (Current)
```
src/
  main.ts              ← ~300 LOC, just spawns server
  preload.ts           ← ~30 LOC, 8 channels
server/
  src/
    index.ts           ← server startup
    app.ts             ← Express setup
    routes/            ← 36 HTTP route files
    services/          ← 85+ services
    middleware/        ← Express middleware
    auth/              ← HTTP auth
    storage/           ← file storage
    adapters/          ← adapter registry
```

### AFTER (Rewrite)
```
src/
  main/
    index.ts           ← App lifecycle, window mgmt
    menu.ts            ← Native menus
    tray.ts            ← System tray
    notifications.ts   ← OS notifications
    shortcuts.ts       ← Global shortcuts
    deep-links.ts      ← Protocol handler
    window-manager.ts  ← Multi-window, state persistence
    updater.ts         ← Auto-update
    database.ts        ← SQLite/PG connection
    backup.ts          ← Backup system
    ipc-router.ts      ← IPC handler registration
    services/          ← 85+ services (moved from server/)
    adapters/          ← Adapter registry + process mgmt
    plugins/           ← Plugin host (utility processes)
    storage/           ← Direct file operations
  preload/
    index.ts           ← Full IPC bridge (200+ channels)
  renderer/            ← (built from ui/src via Vite)
ui/
  src/
    api/
      client.ts        ← IPC-based client (replaces fetch)
      *.ts             ← Domain modules using invoke()
    context/
      LiveUpdatesProvider.tsx  ← IPC-based (no WebSocket)
    ...                ← Rest of React app (mostly unchanged)
packages/
  shared/
    src/
      ipc-channels.ts  ← NEW: typed channel definitions
  db/                  ← Add SQLite support alongside PostgreSQL
  adapters/            ← Unchanged (still spawn subprocesses)
  plugins/             ← SDK unchanged; host uses utility processes
```

---

## Migration Order (Critical Path)

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3
(setup)     (native      (IPC         (database)
             shell)       migration)

             Phase 4 ────────────────────────→
             (native features — can parallelize)

                          Phase 5 ──→ Phase 6 ──→ Phase 7
                          (renderer)  (adapters)  (plugins)

                                                   Phase 8 ──→ Phase 9 ──→ Phase 10
                                                   (storage)   (testing)   (build)
```

**Critical path**: Phase 0 → 1 → 2 → 3 → 5 → 10
**Parallelizable**: Phase 4 can run alongside 2-3. Phase 6-8 can overlap.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| IPC serialization overhead for large payloads | Medium | Use `MessagePort` for bulk transfers, pagination for large lists |
| Main process blocking | High | Move CPU-heavy work (adapter orchestration) to utility processes |
| Plugin compatibility | Medium | Keep plugin SDK API surface unchanged; only change host implementation |
| Data migration (PG → SQLite) | High | Write automated migration tool; keep PG as fallback option |
| Multi-window IPC routing | Medium | Use `BrowserWindow` ID to target specific windows |
| Electron security (nodeIntegration) | Low | Already using contextIsolation — maintain this |
| Testing complexity | Medium | Invest in IPC contract tests early (Phase 0) |

---

## What NOT to Change

- **React 19 + Tailwind + Radix UI**: The component library is solid. Keep it.
- **React Query**: Server-state caching still valuable with IPC (same stale/refetch patterns).
- **Drizzle ORM**: Works with both PostgreSQL and SQLite. Keep it.
- **Adapter subprocess model**: Adapters (Claude CLI, Codex, etc.) must run as subprocesses. Keep spawning.
- **Plugin SDK API**: The `definePlugin()` / `ctx.*` API is well-designed. Only change the host runtime.
- **Phaser game**: The workplace visualization is independent. Keep as-is.
- **Monorepo structure**: pnpm workspaces work well. Keep packages layout.
- **Shared package**: Types, validators, constants — all portable. Keep and extend with IPC types.

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Cold start time | 15-30s (server startup + health poll) | <3s (no server, SQLite is instant) |
| Memory usage | ~500MB (Electron + Node server + PostgreSQL) | ~200MB (Electron + SQLite) |
| Process count | 3+ (Electron, server, PostgreSQL) | 1 (Electron with in-process SQLite) |
| IPC channels | 8 | 200+ (full API surface) |
| Native features | 0 (no menus, no tray, no notifications) | 15+ (menus, tray, notifications, dialogs, shortcuts, auto-update, deep links, etc.) |
| macOS copy/paste | Broken (no Edit menu) | Working (native Edit menu) |
| Auto-update | None | Built-in via electron-updater |
| asar packaging | Disabled | Enabled (security + performance) |
| Code signing | None | macOS notarization + Windows EV cert |
| Bundle size | ~150MB (includes server node_modules) | ~80MB (no server deps) |

---

## Estimated Timeline

| Phase | Duration | Effort |
|-------|----------|--------|
| Phase 0: Foundation | 1-2 weeks | Build system, IPC types |
| Phase 1: Native Shell | 1 week | Menus, tray, notifications, dialogs |
| Phase 2: IPC Migration | 3 weeks | Core rewrite — 36 routes → IPC handlers |
| Phase 3: Database | 1-2 weeks | SQLite schema, migration tool |
| Phase 4: Native Features | 2 weeks | Auto-update, deep links, shortcuts (parallel) |
| Phase 5: Renderer | 1 week | File loading, preload, cleanup |
| Phase 6: Adapters | 1 week | Move registry, process management |
| Phase 7: Plugins | 1 week | Utility processes, local protocol |
| Phase 8: Storage | 1 week | Direct FS, backup |
| Phase 9: Testing | 1 week | IPC tests, E2E |
| Phase 10: Build | 1 week | Signing, auto-update, distribution |
| **Total** | **~10 weeks** | |

---

*This plan preserves TitanClip's feature set while transforming it from a "web app in a window" into a proper native desktop application with full Electron capabilities.*
