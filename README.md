# TitanClip

AI Company Orchestration Platform — a standalone Electron desktop app for managing teams of AI agents as autonomous companies.

## Features

- **Multi-company support** with data isolation
- **Agent management** — hire, configure, and monitor AI agents with org chart hierarchy
- **Task orchestration** — atomic task checkout, status tracking, work products
- **Adapter system** — Claude, Codex, Cursor, Gemini, OpenCode, Pi, OpenClaw
- **Cost tracking** — monthly budgets, per-agent spend limits, auto-pause on overage
- **Governance** — approval workflows, activity audit logs
- **Plugin system** — extensible via worker-thread sandboxed plugins
- **Real-time updates** — WebSocket live events for agent runs and task changes
- **Embedded database** — PostgreSQL runs automatically, zero configuration

## Enterprise Security (Phases 1-3)

- **Admin PIN authentication** — secured admin section with scrypt-hashed PIN (default: 1234)
- **Microsoft SSO support** — production SSO via environment variables (replaces PIN)
- **Agent creation governance** — admin-controlled allowlists for adapter types, models, and roles
- **Server-side enforcement** — all governance policies validated on the server, not just UI

### Admin API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/instance/settings/admin` | Get admin settings (PIN hash stripped) |
| `GET` | `/api/instance/settings/admin/auth-mode` | Returns `"pin"` or `"sso"` |
| `POST` | `/api/instance/settings/admin/verify-pin` | Verify PIN, get admin token |
| `PATCH` | `/api/instance/settings/admin` | Update governance settings |
| `POST` | `/api/instance/settings/admin/change-pin` | Change admin PIN |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 33 |
| Backend | Node.js 20+ / Express 5 / TypeScript |
| Frontend | React 19 / Vite 6 / TailwindCSS 4 / Radix UI |
| Database | PostgreSQL (embedded) / Drizzle ORM |
| Realtime | WebSocket |
| Package Manager | pnpm 9.15+ (monorepo workspace) |

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm -r build

# Launch Electron app in dev mode
pnpm dev
```

### Environment Variables (Optional)

```env
# Microsoft SSO (production)
TITANCLIP_SSO_CLIENT_ID=your-client-id
TITANCLIP_SSO_TENANT_ID=your-tenant-id
TITANCLIP_SSO_CLIENT_SECRET=your-client-secret
```

## Project Structure

```
TitanClip/
├── src/                    # Electron main process
├── server/                 # Express API + services
├── ui/                     # React frontend
├── packages/
│   ├── shared/             # Shared types & validators
│   ├── db/                 # Database schema & migrations
│   ├── adapter-utils/      # Adapter utilities
│   ├── adapters/           # Agent runtime adapters
│   └── plugins/            # Plugin SDK & examples
├── skills/                 # Agent skill definitions
└── assets/                 # App icons & branding
```

---

Enterprise Security built on [Paperclip](https://github.com/paperclipai/paperclip)
