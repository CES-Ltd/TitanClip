/**
 * Path Resolution — centralized path handling for both dev and production.
 *
 * In development:  __dirname = /project/dist/main/
 * In production:   __dirname = /app.asar/dist/main/ (inside ASAR archive)
 *                  resources = /TitanClip.app/Contents/Resources/
 *
 * This module provides correct paths regardless of packaging mode.
 */

import { app } from "electron";
import path from "path";

const IS_PACKAGED = app.isPackaged;

/**
 * Root of the application source (the ASAR or project directory).
 * Dev:  /Users/.../TitanClip-Electron-Rewrite/
 * Prod: /TitanClip.app/Contents/Resources/app.asar/
 */
export function getAppRoot(): string {
  return app.getAppPath();
}

/**
 * Electron resources directory (outside ASAR, for native files).
 * Dev:  not applicable (falls back to project root)
 * Prod: /TitanClip.app/Contents/Resources/
 */
export function getResourcesPath(): string {
  if (IS_PACKAGED) {
    return (process as NodeJS.Process & { resourcesPath: string }).resourcesPath;
  }
  // In dev, simulate resources path as project root
  return path.join(__dirname, "..", "..");
}

/**
 * Path to the preload script.
 * Must be an absolute path; works inside ASAR.
 */
export function getPreloadPath(): string {
  return path.join(getAppRoot(), "dist", "preload", "index.js");
}

/**
 * Path to the application icon.
 * Icons cannot be loaded from inside ASAR on some platforms,
 * so they should be in extraResources.
 */
export function getIconPath(): string {
  if (IS_PACKAGED) {
    // electron-builder copies buildResources/assets into Resources
    return path.join(getResourcesPath(), "logo.png");
  }
  return path.join(__dirname, "..", "..", "assets", "logo.png");
}

/**
 * Path to the tray icon (16x16 or 22x22).
 * Same location as the main icon.
 */
export function getTrayIconPath(): string {
  return getIconPath();
}

/**
 * Path to the UI dist directory.
 */
export function getUiDistPath(): string {
  if (IS_PACKAGED) {
    return path.join(getResourcesPath(), "ui-dist");
  }
  return path.join(__dirname, "..", "..", "ui", "dist");
}

/**
 * Path to the server dist directory.
 */
export function getServerDistPath(): string {
  if (IS_PACKAGED) {
    return path.join(getResourcesPath(), "server-dist");
  }
  return path.join(__dirname, "..", "..", "server", "dist");
}

/**
 * Path to the server source (dev only, for tsx).
 */
export function getServerSourcePath(): string {
  return path.join(__dirname, "..", "..", "server", "src", "index.ts");
}

/**
 * Path to the tsx binary (dev only).
 */
export function getTsxBinPath(): string {
  return path.join(__dirname, "..", "..", "server", "node_modules", ".bin", "tsx");
}

/**
 * Path to SQLite migrations directory.
 */
export function getSqliteMigrationsPath(): string {
  if (IS_PACKAGED) {
    return path.join(getResourcesPath(), "migrations-sqlite");
  }
  return path.join(__dirname, "..", "..", "packages", "db", "src", "migrations-sqlite");
}

/**
 * Path to the SQLite database file.
 */
export function getSqliteDbPath(): string {
  return path.join(app.getPath("userData"), "titanclip.db");
}

/**
 * Path to the plugins directory.
 */
export function getPluginsPath(): string {
  if (IS_PACKAGED) {
    return path.join(getResourcesPath(), "plugins");
  }
  return path.join(__dirname, "..", "..", "packages", "plugins", "examples");
}

/**
 * Path to the skills directory.
 */
export function getSkillsPath(): string {
  if (IS_PACKAGED) {
    return path.join(getResourcesPath(), "skills");
  }
  return path.join(__dirname, "..", "..", "skills");
}

/**
 * Path for server services (native mode dynamic import).
 * In dev: relative path to server source.
 * In prod: path to bundled server dist.
 */
export function getServerServicesPath(): string {
  if (IS_PACKAGED) {
    return path.join(getResourcesPath(), "server-dist", "services", "index.js");
  }
  return path.join(__dirname, "..", "..", "server", "src", "services", "index.js");
}
