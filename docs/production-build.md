# Production Build Guide

## macOS (Apple Silicon)

### One Command Build

```bash
pnpm dist
```

This runs: `build:all` → `patch-server-modules.sh` → `electron-builder --mac` → `sign-mac.sh`

### Step-by-Step Build

```bash
# 1. Build all workspace packages
pnpm -r build

# 2. Build Electron-optimized UI
cd ui && ELECTRON_BUILD=true pnpm run build && cd ..

# 3. Compile Electron main process
pnpm build:electron

# 4. Patch server modules for ESM compatibility
bash scripts/patch-server-modules.sh

# 5. Package with electron-builder
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --arm64

# 6. Sign the app bundle
bash scripts/sign-mac.sh release/mac-arm64/ZeusClip.app
```

### Output

```
release/
├── ZeusClip-1.0.0-arm64.dmg          # DMG installer (~175MB)
├── ZeusClip-1.0.0-arm64-mac.zip      # ZIP archive (~175MB)
└── mac-arm64/
    └── ZeusClip.app/                  # App bundle (~560MB)
        └── Contents/
            ├── MacOS/ZeusClip         # Electron binary
            ├── Frameworks/            # Electron framework
            ├── Resources/
            │   ├── app/               # Main process JS (dist/)
            │   ├── ui-dist/           # Built React app
            │   ├── server-dist/       # Compiled server + node_modules
            │   ├── skills/            # Agent skills
            │   ├── migrations-sqlite/ # SQLite migrations
            │   └── package.json       # Server version info
            └── Info.plist             # App metadata + protocol registration
```

## macOS (Intel)

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --x64
bash scripts/sign-mac.sh release/mac/ZeusClip.app
```

## Windows

```bash
pnpm dist:win
```

Produces NSIS installer + ZIP in `release/`.

## Linux

```bash
pnpm dist:linux
```

Produces AppImage + DEB in `release/`.

## Code Signing

### macOS (Ad-hoc, Development)

The `scripts/sign-mac.sh` script signs with an ad-hoc identity (no Apple Developer account required). This allows running on your own machine but triggers Gatekeeper warnings for other users.

```bash
bash scripts/sign-mac.sh release/mac-arm64/ZeusClip.app
```

### macOS (Notarized, Distribution)

Set environment variables before building:

```bash
export APPLE_TEAM_ID=YOUR_TEAM_ID
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=certificate-password
pnpm dist
```

### Windows (Code Signing)

```bash
export WIN_CSC_LINK=/path/to/certificate.pfx
export WIN_CSC_KEY_PASSWORD=certificate-password
pnpm dist:win
```

## Auto-Update

Configured to publish to GitHub Releases. Set up:

1. Create a GitHub personal access token with `repo` scope
2. Set `GH_TOKEN` environment variable
3. Run `pnpm exec electron-builder --mac --publish always`

The app checks for updates on launch and periodically.

## ESM Compatibility

The production server runs on system Node.js (not Electron's built-in Node) because Electron 33's Node v20 has an ASAR filesystem wrapper that conflicts with `--experimental-require-module`.

The `scripts/patch-server-modules.sh` script patches `@exodus/bytes` (an ESM-only dependency of `jsdom`) with CJS-compatible stubs.

If you encounter `ERR_REQUIRE_ESM` errors in production:

1. Identify the ESM-only package
2. Add a CJS stub file (`.cjs` extension) in its directory
3. Patch the consumer to use the stub via direct path
4. Or add the package to `patch-server-modules.sh`

## Troubleshooting

### Build fails with "Cannot find module '@titanclip/db'"
Rebuild packages: `pnpm -r build`

### Server crashes with "slaPolicies not exported"
The bundled `@titanclip/db` is stale. Update it:
```bash
cd packages/db && pnpm run build
cp -R dist /tmp/titanclip-server-modules/@titanclip/db/dist
```

### macOS: "not valid for use in process: different Team IDs"
Re-sign: `bash scripts/sign-mac.sh release/mac-arm64/ZeusClip.app`

### Blank screen after build
Server failed to start. Check terminal output for errors. Common causes:
- Stale bundled packages → rebuild all with `pnpm -r build`
- Port 3100 in use → `lsof -ti :3100 | xargs kill`
- Missing Node.js → ensure `node` is in PATH
