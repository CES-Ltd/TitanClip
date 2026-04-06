# ZeusClip (TitanClip)

AI Company Orchestration Platform — a native Electron desktop app for managing teams of AI agents. Features multi-LLM support, agentic tool calling via TitanClaw CLI, real-time chat with CEO agent, automated task delegation, and enterprise governance.

## Key Features

- **Chat Interface** — Talk to your team's CEO agent to orchestrate projects, hire agents, and track progress
- **TitanClaw Integration** — Standalone agentic CLI framework with 13 built-in tools (shell_exec, web_search, delegate, hire, issue management, chatter)
- **Agent Gallery** — Pre-configured templates (Tech Lead, Backend/Frontend Engineer, QA, DevOps, PM, SRE, Security, Docs, Performance)
- **Multi-LLM Support** — OpenAI, Anthropic, Ollama, OpenRouter, Gemini, Azure via HTTP adapters
- **Issue Tracking** — Auto task breakdown, delegation, status tracking, comments
- **Team Communication** — Chatter channels for agent-to-agent awareness
- **Three-Point Theme** — Light, Dark, TitanClip themes with OKLCH color system
- **Fun Mode** — Pixel art villains, Bollywood/Hollywood character agent names

## Quick Start

```bash
# Prerequisites: Node.js 20+, pnpm 9.15+
# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Launch in development mode
pnpm dev
```

The app will open with native menus, system tray, and all features active.

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 20+ | Server runtime, build tools |
| **pnpm** | 9.15+ | Package manager (monorepo workspaces) |
| **macOS / Windows / Linux** | macOS 12+, Win 10+, Ubuntu 20+ | Desktop platform |
| **Git** | 2.x | Version control |

Optional (for agent adapters):
- **Claude CLI** — for the `claude_local` adapter
- **Codex CLI** — for the `codex_local` adapter
- **Cursor** — for the `cursor` adapter
- **OpenCode** — for the `opencode_local` adapter

## Development

### Running the App

```bash
# Standard development mode (server as child process)
pnpm dev

# Build only the Electron main process
pnpm build:electron

# Type-check all packages
pnpm typecheck
```

### Build Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Compile Electron + launch app (server mode) |
| `pnpm build` | Build all workspace packages |
| `pnpm build:electron` | Compile Electron main process only |
| `pnpm build:all` | Build everything (packages + UI + Electron) |
| `pnpm start` | Launch pre-built Electron app |
| `pnpm typecheck` | Type-check all packages recursively |

### Project Structure

```
ZeusClip/
├── src/
│   ├── main/                  # Electron main process (23 modules)
│   │   ├── index.ts           # App lifecycle, startup orchestration
│   │   ├── window-manager.ts  # Window creation, state persistence
│   │   ├── menu.ts            # Native application menu + shortcuts
│   │   ├── tray.ts            # System tray icon + context menu
│   │   ├── notifications.ts   # OS-level notifications
│   │   ├── context-menu.ts    # Native right-click menus
│   │   ├── global-shortcuts.ts# System-wide keyboard shortcuts
│   │   ├── clipboard.ts       # Native clipboard operations
│   │   ├── drag-drop.ts       # Native drag & drop
│   │   ├── touchbar.ts        # macOS Touch Bar
│   │   ├── dock-progress.ts   # Dock/taskbar progress indicator
│   │   ├── deep-links.ts      # titanclip:// protocol handler
│   │   ├── protocol.ts        # Custom app:// protocol for UI
│   │   ├── paths.ts           # ASAR-safe path resolution
│   │   ├── server-bridge.ts   # Server child process lifecycle
│   │   ├── database.ts        # Database init (SQLite/PostgreSQL)
│   │   ├── service-container.ts # Service layer initialization
│   │   ├── ipc-router.ts      # Core IPC handlers
│   │   ├── ipc-service-handlers.ts # Business logic IPC (80+ channels)
│   │   ├── adapter-manager.ts # Adapter process tracking
│   │   ├── plugin-host.ts     # Plugin utility processes
│   │   ├── file-storage.ts    # Direct filesystem storage + backups
│   │   └── updater.ts         # Auto-update support
│   └── preload/
│       └── index.ts           # Secure IPC bridge (40+ APIs)
├── server/                    # Express API server
│   └── src/
│       ├── routes/            # 36 API route files
│       ├── services/          # 85+ business logic services
│       ├── adapters/          # Agent adapter registry
│       └── middleware/        # Auth, validation, logging
├── ui/                        # React frontend
│   └── src/
│       ├── api/               # 35 API modules + IPC client
│       ├── components/        # 100+ React components
│       ├── pages/             # 61 page components
│       ├── context/           # React context providers
│       ├── plugins/           # Plugin UI bridge
│       └── workplace/         # Phaser 3 pixel-art office
├── packages/
│   ├── shared/                # Shared types, validators, IPC channels
│   ├── db/                    # Database schema (PG + SQLite)
│   ├── adapter-utils/         # Adapter type definitions
│   ├── adapters/              # 7 agent adapters (Claude, Codex, etc.)
│   └── plugins/               # Plugin SDK + examples
├── scripts/
│   ├── sign-mac.sh            # macOS code signing
│   └── patch-server-modules.sh # Production ESM compatibility
├── build/
│   ├── entitlements.mac.plist # macOS hardened runtime entitlements
│   └── entitlements.mac.inherit.plist
├── skills/                    # Agent skill definitions
└── assets/                    # App icons & branding
```

## Production Build

### macOS

```bash
# Full build + package + sign
pnpm dist

# Or step by step:
pnpm build:all                              # Build everything
pnpm exec electron-builder --mac --arm64    # Package for Apple Silicon
bash scripts/sign-mac.sh release/mac-arm64/ZeusClip.app  # Sign
```

Output:
- `release/ZeusClip-1.0.0-arm64.dmg` — DMG installer
- `release/ZeusClip-1.0.0-arm64-mac.zip` — ZIP archive
- `release/mac-arm64/ZeusClip.app` — App bundle

### Windows

```bash
pnpm dist:win
```

### Linux

```bash
pnpm dist:linux
```

## Architecture

### Electron Native Design

The app uses a **native Electron architecture** with 23 main process modules:

```
┌─────────────────────────────────────────────────────┐
│              Electron Main Process                   │
│                                                      │
│  Menu │ Tray │ Notifications │ Shortcuts │ Clipboard │
│  Touch Bar │ Dock Progress │ Context Menus           │
│  Deep Links │ Auto-Update │ File Storage             │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐                   │
│  │ IPC Router  │  │ Server       │                   │
│  │ (296 routes)│  │ Bridge       │                   │
│  └──────┬──────┘  └──────┬───────┘                   │
│         │                │ spawn()                    │
└─────────┼────────────────┼───────────────────────────┘
          │ IPC            │
          ▼                ▼
┌─────────────────┐  ┌──────────────────┐
│   BrowserWindow │  │  Node.js Server  │
│   (React 19)    │  │  (Express API)   │
│   40+ preload   │  │  85+ services    │
│   APIs exposed  │  │  PostgreSQL      │
└─────────────────┘  └──────────────────┘
```

### IPC Transport Layer

All 35 UI API modules transparently route through IPC when running in Electron:

```typescript
// UI code calls the same API as always:
agentsApi.list(companyId)
  → api.get("/companies/abc/agents")
  → client.ts matches URL pattern → IPC channel "agents:list"
  → window.electronAPI.invoke("agents:list", { companyId })
  → main process service call → result (no HTTP overhead)
```

296 URL→IPC route patterns cover the entire API surface. Unmatched routes fall back to HTTP with a console warning.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 33, 23 native modules |
| Frontend | React 19 / Vite 6 / Tailwind CSS 4 / Radix UI |
| Backend | Node.js 20+ / Express / TypeScript |
| Database | PostgreSQL (embedded) / SQLite (optional) / Drizzle ORM |
| Game Engine | Phaser 3 (pixel-art workplace) |
| Realtime | IPC push events (Electron) / WebSocket (browser fallback) |
| Package Manager | pnpm 9.15+ (monorepo workspace) |

## Features

### Core Platform
- **Multi-company support** with data isolation
- **Agent management** — hire, configure, monitor AI agents with org chart
- **Task orchestration** — atomic checkout, status tracking, work products
- **Project management** — workspaces, execution environments
- **Routine automation** — scheduled triggers, cron-based execution
- **Goal tracking** — objectives hierarchy with progress

### Agent Adapters
- **Claude** (claude_local) — Claude Code CLI
- **Codex** (codex_local) — GitHub Copilot Codex
- **Cursor** (cursor) — Cursor AI
- **Gemini** (gemini_local) — Google Gemini
- **OpenCode** (opencode_local) — OpenCode CLI
- **Pi** (pi_local) — Pi inference
- **OpenClaw** (openclaw_gateway) — OpenClaw API gateway
- **Process** — generic command executor
- **HTTP** — generic HTTP adapter

### Enterprise Features
- **Approval workflows** — agent actions require board approval
- **Budget management** — monthly caps, per-agent limits, auto-pause
- **Cost tracking** — per-provider, per-model, per-project breakdowns
- **SLA management** — policies, breach detection, escalation rules
- **Skill-based routing** — match tasks to agents by proficiency
- **Compliance** — activity audit logs, governance policies
- **Vault** — credential management with timed checkouts
- **Plugin system** — worker-thread sandboxed extensibility

### Native Desktop Features
- **Application menu** with keyboard shortcuts (Cmd+1-5 navigation, Cmd+K command palette)
- **System tray** with status, quick navigation, badge count
- **OS notifications** for agent completion, approvals, budget alerts, errors
- **Global shortcuts** — Cmd+Shift+T quick issue capture, Cmd+Shift+P toggle window
- **Native clipboard** — copy issues as markdown, agent configs as JSON, paste images
- **Drag & drop** — drag agents/issues out as files
- **macOS Touch Bar** — contextual controls per view
- **Dock/taskbar progress** — indeterminate during agent runs
- **Context menus** — right-click with cut/copy/paste, spell check, inspect
- **Deep links** — `titanclip://agents/abc` opens specific views
- **Single instance** lock with deep link forwarding
- **Window state persistence** — remembers position, size, maximized state
- **Auto-updater** — checks GitHub Releases (when configured)
- **Quit button** in title bar for clean shutdown

### Gamified Workplace
A retro pixel-art office powered by **Phaser 3**:
- Boss character with WASD movement and camera follow
- Agent sprites colored by role (CEO gold, CTO blue, etc.)
- Thought bubbles showing real-time agent status
- RPG-style task assignment (walk up, press E)
- Live updates from WebSocket/IPC events

## Configuration

### Environment Variables

```env
# Database (optional — defaults to embedded PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Microsoft SSO (production, optional)
TITANCLIP_SSO_CLIENT_ID=your-client-id
TITANCLIP_SSO_TENANT_ID=your-tenant-id
TITANCLIP_SSO_CLIENT_SECRET=your-client-secret

# Deployment mode
TITANCLIP_DEPLOYMENT_MODE=local_trusted    # or "authenticated"
TITANCLIP_DEPLOYMENT_EXPOSURE=private      # or "public"
```

### Admin Settings

Default admin PIN: `1234`. Change via Settings > Admin.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/instance/settings/admin/auth-mode` | Returns `"pin"` or `"sso"` |
| `POST` | `/api/instance/settings/admin/verify-pin` | Verify PIN, get admin token |
| `PATCH` | `/api/instance/settings/admin` | Update governance settings |
| `POST` | `/api/instance/settings/admin/change-pin` | Change admin PIN |

## Troubleshooting

### App shows blank screen
The bundled server packages may be stale. Rebuild everything:
```bash
pnpm -r build && pnpm build:electron
```

### "Command not found: opencode" on startup
Non-fatal. The adapter tries to discover CLI tools in PATH. Install the adapter's CLI or ignore the warning.

### Server won't start in production (ESM errors)
The production build uses system Node.js (not Electron's built-in Node) to avoid ASAR/ESM conflicts. Ensure Node.js 20+ is installed and in PATH.

### macOS: "damaged and can't be opened"
The app needs re-signing after packaging:
```bash
bash scripts/sign-mac.sh release/mac-arm64/ZeusClip.app
```

### Port 3100 already in use
Another instance is running. Kill it:
```bash
lsof -ti :3100 | xargs kill
```

## License

Private repository. Based on [Paperclip](https://github.com/paperclipai/paperclip).
