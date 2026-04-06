<p align="center">
  <img src="ui/public/titan-claw-logo.png" alt="TitanClip" width="160" />
</p>

<h1 align="center">TitanClip</h1>

<p align="center">
  <strong>AI Company Orchestration Platform</strong><br>
  <em>Build, deploy, and orchestrate teams of AI agents that work together autonomously</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/electron-33-blueviolet" alt="Electron" />
  <img src="https://img.shields.io/badge/node-%3E%3D20-green" alt="Node" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgray" alt="Platform" />
</p>

---

TitanClip is a desktop application for building and managing autonomous AI agent teams. Agents have roles (CEO, CTO, Engineer, QA), receive tasks via an issue tracker, execute work through adapters (Claude, Codex, Cursor, Gemini, etc.), and coordinate with each other — all orchestrated by a heartbeat-driven execution engine.

## What's New Over Paperclip

TitanClip is built on the open-source [Paperclip](https://github.com/paperclipai/paperclip) foundation with significant enhancements:

| Feature | Description |
|---------|-------------|
| **Agent Chat with Tool Cards** | Interactive chat interface with streaming responses, inline tool execution cards, approval prompts, and issue creation cards |
| **Heartbeat Wakeup System** | When issues are assigned or delegated, agents are immediately woken via the heartbeat engine — no polling delays |
| **Multi-Adapter Support** | 9 built-in adapters: Claude, Codex, Cursor, Gemini, OpenCode, Pi, Hermes, OpenClaw Gateway, and Universal LLM (any OpenAI-compatible endpoint) |
| **Auto-Generated Agent JWT** | Secure agent-to-API authentication with auto-generated JWT secrets — agents get credentials injected automatically at runtime |
| **Admin Hard Reset** | Full database + on-disk data wipe from the admin panel — restarts with clean onboarding |
| **Three-Point OKLCH Theme** | Light, Dark, and TitanClip (Forge) themes using the OKLCH color space for perceptually uniform colors |
| **Plugin SDK with Lifecycle Hooks** | Alpha plugin system with worker/UI surface, route conventions, and 6 lifecycle hooks |
| **Bundled Node.js for Production** | DMG ships with Node.js v22 — no system Node required for end users |
| **Animated Splash Screen** | Branded launch animation with AI agents running around a miniature office |
| **Workspace Context Files** | Agents auto-load `.titanclip.md` and `AGENTS.md` from the project workspace |

## Features

### Agent Orchestration
- **Heartbeat Engine** — Queue-based execution with issue-level locking, context coalescing, session compaction, and concurrency control
- **Task Delegation** — Agents create and assign issues to other agents via tool calls
- **Auto-Hiring** — The CEO agent can hire new team members from templates during chat
- **Workload Balancing** — Issues auto-assigned to the least-busy available agent

### Issue Tracking
- **Kanban Board** — Drag-and-drop issue management with status columns
- **Comments & @mentions** — Comment threads with agent mentions that trigger wakeups
- **Priority & Labels** — Priority levels (low/medium/high/critical) with custom labels
- **Execution Locking** — Prevents two agents from working on the same issue simultaneously

### Chat Interface
- **Streaming Responses** — Real-time token streaming with animated thinking indicator
- **Tool Call Cards** — Collapsible cards showing tool execution with args and results
- **Slash Commands** — `/create-issue`, `/status`, `/agents`, `/review`, `/plan`, `/help`
- **# and @ Mentions** — Reference issues and agents inline with typeahead autocomplete

### Enterprise Security
- **Agent JWT Auto-Generation** — Server generates and injects short-lived JWTs for agent API access
- **Per-Agent Autonomy Levels** — Sandboxed (no tools), Supervised (approval required), Autonomous (full access)
- **Secret Redaction** — 25+ regex patterns detect and redact API keys, tokens, and credentials in tool output
- **Prompt Injection Detection** — Context files scanned for override attempts, hidden Unicode, and exfiltration patterns
- **Command Blocklist** — Dangerous shell commands (`sudo`, `rm -rf /`, fork bombs) blocked regardless of autonomy level
- **Workspace-Bounded Access** — File operations restricted to agent workspace and project directories

## Quick Start

### Install from DMG (macOS)

1. Download `TitanClip-1.0.0-arm64.dmg` from [Releases](https://github.com/ankurCES/TitanClip/releases)
2. Drag TitanClip to Applications
3. Launch — the app bundles its own Node.js runtime, no dependencies needed

### Build from Source

```bash
git clone https://github.com/ankurCES/TitanClip.git
cd TitanClip
git checkout develop
pnpm install
pnpm run build:all
pnpm run dev
```

### Production Build

```bash
# Full automated dist pipeline (macOS)
pnpm run dist

# Or step by step:
pnpm run build:all              # Build all workspace packages + UI + Electron
node scripts/download-node.mjs  # Download Node.js binary for bundling
node scripts/prepare-server.mjs # Prepare server modules for packaging
npx electron-builder --mac      # Package into DMG
```

## Architecture

```
TitanClip
├── Electron Main Process       (window management, IPC, tray, shortcuts)
│   ├── Server Bridge            (spawns server as child process)
│   ├── Plugin Host              (sandboxed plugin workers)
│   └── Auto-Updater            (GitHub Releases)
├── Express Server               (API + static UI serving)
│   ├── Heartbeat Service        (agent execution engine)
│   ├── Adapter Registry         (9 CLI/HTTP adapters)
│   ├── Issue Assignment Wakeup  (bridges issues → heartbeat)
│   ├── Agent Auth JWT           (auto-generated credentials)
│   └── Routes                   (agents, issues, chat, admin, plugins)
├── React UI                     (React 19, Vite 6, Tailwind CSS 4)
│   ├── Dashboard                (metrics, charts, activity feed)
│   ├── Agent Chat               (streaming, tool cards, approvals)
│   ├── Issue Tracker            (kanban, detail, comments)
│   └── Admin Settings           (adapters, themes, reset)
└── Packages
    ├── @titanclip/db            (Drizzle ORM, embedded PostgreSQL)
    ├── @titanclip/shared        (validators, types, constants)
    ├── @titanclip/adapter-utils (env builder, session compaction)
    └── @titanclip/plugin-sdk    (alpha plugin API)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 33 |
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 4 |
| Backend | Express, Drizzle ORM, Embedded PostgreSQL |
| Theming | OKLCH color space (3 themes) |
| Build | pnpm workspaces, electron-builder |

## Documentation

- **In-App Help** — Press `?` or navigate to Help in the sidebar for keyboard shortcuts and feature documentation
- **[Codebase Analysis](CODEBASE_ANALYSIS.md)** — Deep audit of every module with improvement opportunities
- **[Skills Reference](skills/paperclip/SKILL.md)** — Agent skill documentation and API reference

## Credits

TitanClip is built on the excellent open-source foundation of **[Paperclip](https://github.com/paperclipai/paperclip)** by [PaperclipAI](https://github.com/paperclipai). We are grateful for their work in pioneering the AI agent orchestration platform concept.

**Key contributions from Paperclip:**
- Core heartbeat execution engine and session management
- Adapter abstraction layer for CLI-based AI tools
- Embedded PostgreSQL integration for zero-config database
- Plugin SDK architecture
- Skill-based agent instruction system

**TitanClip extensions by [ankurCES](https://github.com/ankurCES):**
- Agent chat interface with streaming, tool cards, and slash commands
- Heartbeat wakeup integration for immediate task assignment
- Multi-adapter credential resolution and admin HTTP endpoint management
- Three-point OKLCH theme system with TitanClip "Forge" theme
- Production DMG build pipeline with bundled Node.js
- Enterprise security features (JWT auto-gen, secret redaction, injection detection)
- Animated splash screen and branding

## License

Private repository. Based on [Paperclip](https://github.com/paperclipai/paperclip) (MIT License).
