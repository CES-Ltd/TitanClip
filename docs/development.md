# Development Guide

## Prerequisites

1. **Node.js 20+**: Download from [nodejs.org](https://nodejs.org) or use nvm/fnm
2. **pnpm 9.15+**: `npm install -g pnpm` or `corepack enable`
3. **Git**: For version control

Verify:
```bash
node --version   # v20.x or higher
pnpm --version   # 9.15.x or higher
```

## Setup

```bash
# Clone the repository
git clone https://github.com/ankurCES/ZeusClip.git
cd ZeusClip

# Install all workspace dependencies
pnpm install

# Build all packages (shared, db, adapters, server, UI)
pnpm -r build

# Launch the Electron app in development mode
pnpm dev
```

## Development Workflow

### Daily Development

```bash
# Start the app (compiles Electron main process + launches)
pnpm dev
```

This:
1. Compiles `src/main/*.ts` and `src/preload/*.ts` to `dist/`
2. Launches Electron
3. Electron spawns the server using `tsx` (TypeScript directly)
4. Server starts embedded PostgreSQL
5. UI loads from `http://127.0.0.1:3100`

### After Changing Server Code

The server runs via `tsx` in dev mode — most changes are picked up automatically. If you add new files or change imports, restart the app.

### After Changing UI Code

The UI is served by the Express server which proxies Vite in dev mode. Changes hot-reload automatically.

### After Changing Electron Main Process Code

```bash
# Recompile and restart
pnpm dev
```

### After Changing Shared/DB Packages

```bash
# Rebuild the changed package
cd packages/shared && pnpm run build
# or
cd packages/db && pnpm run build

# Then restart the app
pnpm dev
```

## Type Checking

```bash
# Check all packages
pnpm typecheck

# Check specific packages
pnpm -r --filter @titanclip/shared typecheck
pnpm -r --filter @titanclip/db typecheck

# Check Electron main process only
node node_modules/typescript/bin/tsc -p tsconfig.electron.json --noEmit

# Check UI only
node node_modules/typescript/bin/tsc -p ui/tsconfig.json --noEmit
```

## Package Scripts Reference

### Root

| Script | Description |
|--------|-------------|
| `pnpm dev` | Compile Electron + launch (server mode) |
| `pnpm start` | Launch pre-built Electron app |
| `pnpm build` | Build all workspace packages |
| `pnpm build:electron` | Compile Electron main/preload |
| `pnpm build:all` | Build packages + UI (electron) + Electron |
| `pnpm dist` | Full production build (macOS) |
| `pnpm dist:win` | Full production build (Windows) |
| `pnpm dist:linux` | Full production build (Linux) |
| `pnpm typecheck` | Type-check all packages |

### Server (`server/`)

| Script | Description |
|--------|-------------|
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm typecheck` | Type-check |

### UI (`ui/`)

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Vite dev server (standalone) |
| `pnpm build` | Build for production |
| `pnpm typecheck` | Type-check |

### Database (`packages/db/`)

| Script | Description |
|--------|-------------|
| `pnpm build` | Compile schema + copy migrations |
| `pnpm generate` | Generate new migration after schema change |
| `pnpm migrate` | Apply pending migrations |
| `pnpm seed` | Seed initial data |

## Adding New IPC Routes

When adding a new API endpoint:

1. **Server**: Add the Express route in `server/src/routes/`
2. **UI API**: Add the function in `ui/src/api/`
3. **IPC Route**: Add a URL→IPC pattern in `ui/src/api/client.ts`:

```typescript
{ method: "GET", pattern: /^\/companies\/([^/]+)\/my-endpoint$/, channel: "my-endpoint:list",
  args: (m) => ({ companyId: m[1] }) },
```

4. **IPC Handler** (optional, for native mode): Add in `src/main/ipc-service-handlers.ts`
5. **IPC Channel Type** (optional): Add in `packages/shared/src/ipc-channels.ts`

Run in dev to verify — any unmatched routes will log: `[IPC] No route for GET /path — falling back to HTTP`

## Debugging

### Electron Main Process
- Console output goes to terminal
- Use `--inspect` for Node.js debugger: `electron --inspect .`

### Renderer (UI)
- Open DevTools: View menu > Toggle Developer Tools (or Cmd+Option+I)
- React DevTools and React Query DevTools work normally

### Server
- Server logs prefixed with `[server]` in terminal
- Pino logger with structured JSON output

### IPC Issues
- Unmatched IPC routes log `[IPC] No route for METHOD /path` in browser console
- Check `src/main/ipc-router.ts` for handler registration errors
