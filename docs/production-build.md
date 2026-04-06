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

### Prerequisites

- **Windows 10** or later (64-bit)
- **Node.js 20+** (LTS recommended)
- **pnpm 9.15+**
- **Visual Studio Build Tools** with C++ workload (for native modules)
- **WiX Toolset** (optional, for MSI installer)

### Installation

```powershell
# Install Node.js (via winget or download from nodejs.org)
winget install OpenJS.NodeJS.LTS

# Install pnpm
npm install -g pnpm

# Clone and setup
git clone https://github.com/ankurCES/ZeusClip.git
cd ZeusClip
pnpm install
```

### One Command Build

```bash
pnpm dist:win
```

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
pnpm exec electron-builder --win --x64
```

### Output

```
release/
├── ZeusClip Setup 0.3.1.exe          # NSIS installer (~180MB)
├── ZeusClip-0.3.1-win.zip            # ZIP archive (~180MB)
└── win-unpacked/
    └── ZeusClip.exe                  # Unpacked application
```

### Code Signing (Windows)

For production distribution, sign the installer with a code signing certificate:

```bash
# Set environment variables
export WIN_CSC_LINK=/path/to/certificate.pfx
export WIN_CSC_KEY_PASSWORD=certificate-password

# Build with signing
pnpm dist:win
```

The installer will be signed with your certificate, reducing SmartScreen warnings.

### Installation (End User)

1. Download `ZeusClip Setup 0.3.1.exe`
2. Run installer (may show SmartScreen warning if not signed)
3. Choose install location (default: `%LOCALAPPDATA%\Programs\zeusclip`)
4. Launch from Start Menu or desktop shortcut

### Uninstallation

- Via Settings > Apps > ZeusClip > Uninstall
- Or run uninstaller from Start Menu

### Troubleshooting (Windows)

**"Cannot find module" errors:**
```powershell
# Rebuild packages
pnpm -r build
```

**SmartScreen warning:**
- Expected for unsigned apps
- Click "More info" > "Run anyway" for development builds
- Use code signing for distribution

**Native module build failures:**
```powershell
# Install build tools
npm install -g windows-build-tools
# Or install Visual Studio with C++ workload
```

## Linux

### Prerequisites

- **Ubuntu 20.04+** / **Debian 10+** / **Fedora 33+** (64-bit)
- **Node.js 20+** (LTS recommended)
- **pnpm 9.15+**
- **build-essential** package (for native modules)

### Installation (Ubuntu/Debian)

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install build dependencies
sudo apt-get install -y build-essential libxss1 libgtk-3-0 libnss3 libatspi2.0-0

# Clone and setup
git clone https://github.com/ankurCES/ZeusClip.git
cd ZeusClip
pnpm install
```

### Installation (Fedora)

```bash
# Install Node.js
sudo dnf install -y nodejs

# Install pnpm
npm install -g pnpm

# Install build dependencies
sudo dnf install -y @development-tools libXScrnSaver gtk3 nss at-spi2-atk

# Clone and setup
git clone https://github.com/ankurCES/ZeusClip.git
cd ZeusClip
pnpm install
```

### One Command Build

```bash
pnpm dist:linux
```

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
pnpm exec electron-builder --linux --x64
```

### Output

```
release/
├── ZeusClip-0.3.1.AppImage           # AppImage (~185MB)
├── zeusclip_0.3.1_amd64.deb          # DEB package (~185MB)
├── zeusclip-0.3.1-1.x86_64.rpm       # RPM package (~185MB)
└── linux-unpacked/
    └── zeusclip                      # Unpacked application
```

### Distribution Formats

#### AppImage (Universal Linux)

- **Best for:** Testing, portable usage, distributions without native packages
- **Usage:** Make executable and run
  ```bash
  chmod +x ZeusClip-0.3.1.AppImage
  ./ZeusClip-0.3.1.AppImage
  ```
- **Installation (optional):** Move to `/opt` and create desktop entry

#### DEB Package (Debian/Ubuntu)

- **Best for:** Ubuntu, Debian, Linux Mint, Pop!_OS
- **Installation:**
  ```bash
  sudo apt install ./zeusclip_0.3.1_amd64.deb
  ```
- **Uninstallation:**
  ```bash
  sudo apt remove zeusclip
  ```

#### RPM Package (Fedora/RHEL/openSUSE)

- **Best for:** Fedora, RHEL, CentOS, openSUSE
- **Installation:**
  ```bash
  sudo dnf install ./zeusclip-0.3.1-1.x86_64.rpm
  ```
- **Uninstallation:**
  ```bash
  sudo dnf remove zeusclip
  ```

### Desktop Integration

Linux packages include:
- Desktop entry (`/usr/share/applications/zeusclip.desktop`)
- Application icon (`/usr/share/icons/hicolor/...`)
- MIME type registration for `titanclip://` protocol

### Troubleshooting (Linux)

**"Cannot find module" errors:**
```bash
pnpm -r build
```

**AppImage won't run:**
```bash
# Make executable
chmod +x ZeusClip-0.3.1.AppImage

# Install FUSE if needed (Ubuntu 22.04+)
sudo apt install libfuse2
```

**Missing dependencies:**
```bash
# Ubuntu/Debian
sudo apt install libgtk-3-0 libnss3 libatspi2.0-0 libxss1

# Fedora
sudo dnf install gtk3 nss at-spi2-atk libXScrnSaver
```

**Blank screen / server crash:**
```bash
# Check if port 3100 is in use
lsof -i :3100

# Kill process if needed
kill $(lsof -ti :3100)

# Check logs in terminal
./zeusclip  # or run AppImage from terminal
```

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
