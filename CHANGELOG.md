# Changelog

All notable changes to TitanClip will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning

### Semantic Versioning (SemVer)

TitanClip uses Semantic Versioning with the format `MAJOR.MINOR.PATCH`:

- **MAJOR** version for incompatible API changes or breaking changes
- **MINOR** version for backwards-compatible new features
- **PATCH** version for backwards-compatible bug fixes

### Release Schedule

- **Patch releases**: As needed for critical bug fixes
- **Minor releases**: Every 2-4 weeks with feature accumulations
- **Major releases**: As needed for significant architectural changes

## [Unreleased]

### Added
- CONTRIBUTING.md with code guidelines, PR process, and documentation standards
- Documentation Engineer role to the delivery team

### Changed
- Improved documentation structure and organization

### Fixed
- Initial documentation audit completed

## [0.3.1] - 2026-04-06

### Added
- Electron 33 with 23 native modules for desktop integration
- Multi-company support with data isolation
- Agent management with org chart visualization
- Task orchestration with atomic checkout and status tracking
- Project management with workspaces and execution environments
- Routine automation with scheduled triggers and cron-based execution
- Goal tracking with objectives hierarchy
- Approval workflows for agent actions requiring board approval
- Budget management with monthly caps and per-agent limits
- Cost tracking per provider, model, and project
- SLA management with policies and breach detection
- Skill-based routing to match tasks to agents by proficiency
- Activity audit logs for compliance

### Agent Adapters
- Claude (claude_local) - Claude Code CLI integration
- Codex (codex_local) - GitHub Copilot Codex integration
- Cursor (cursor) - Cursor AI integration
- Gemini (gemini_local) - Google Gemini integration
- OpenCode (opencode_local) - OpenCode CLI integration
- Pi (pi_local) - Pi inference integration
- OpenClaw (openclaw_gateway) - OpenClaw API gateway
- Process adapter - Generic command executor
- HTTP adapter - Generic HTTP integration

### Tech Stack
- **Desktop**: Electron 33 with native modules
- **Frontend**: React 19 / Vite 6 / Tailwind CSS 4 / Radix UI
- **Backend**: Node.js 20+ / Express / TypeScript
- **Database**: PostgreSQL (embedded) / SQLite (optional) / Drizzle ORM
- **Game Engine**: Phaser 3 for pixel-art workplace visualization
- **Realtime**: IPC push events (Electron) / WebSocket fallback
- **Package Manager**: pnpm 9.15+ (monorepo workspace)

### Fixed
- IPC route matching for dynamic segments
- Server child process lifecycle management
- Database initialization with SQLite/PostgreSQL support

## [0.3.0] - 2026-04-05

### Added
- Initial TitanClip Electron rewrite
- Native Electron app structure with main and preload processes
- Server embedded in Electron with child process management
- UI served via Express with Vite proxy in development
- IPC router for native mode communication
- Window manager with state persistence
- Native menus, system tray, and global shortcuts
- Drag-and-drop file handling
- macOS Touch Bar support
- Dock/taskbar progress indicators
- Custom protocol handler (titanclip://)

### Changed
- Migrated from web-only to Electron desktop application
- Restructured project as pnpm monorepo

## [0.2.0] - 2025-12-15

### Added
- TitanClaw CLI integration for agentic tool calling
- Chat interface for CEO agent communication
- Agent gallery with pre-configured templates
- Issue tracking with auto task breakdown
- Team communication via Chatter channels
- Three-point theme system (Light, Dark, TitanClip)
- Fun mode with pixel art villains and character agent names

### Fixed
- Multi-LLM adapter configuration
- Real-time chat event propagation

## [0.1.0] - 2025-11-01

### Added
- Initial project setup
- Basic agent orchestration framework
- Simple task management
- Single LLM adapter (OpenAI)

---

## Release Notes Process

### For Developers

1. **Track changes** in your pull requests using the changelog format
2. **Add entries** to the [Unreleased] section when merging to main
3. **Categorize changes** appropriately:
   - `Added` - New features
   - `Changed` - Changes in existing functionality
   - `Deprecated` - Soon-to-be removed features
   - `Removed` - Removed features
   - `Fixed` - Bug fixes
   - `Security` - Security improvements

### For Release Managers

1. **Review [Unreleased]** section before release
2. **Update version number** in package.json files
3. **Move [Unreleased]** entries to new version section with date
4. **Add new [Unreleased]** section at top
5. **Update comparison links** at bottom (if using)
6. **Tag release** in Git with version number

### Example Entry Format

```markdown
### Added
- Feature description with context (#issue-number)

### Changed
- Modified behavior description

### Fixed
- Bug fix description (#issue-number)
```

---

*For more information on this changelog format, visit [Keep a Changelog](https://keepachangelog.com/).*
