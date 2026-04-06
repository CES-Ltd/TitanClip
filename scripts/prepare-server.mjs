#!/usr/bin/env node
/**
 * Prepare server node_modules for production packaging.
 *
 * 1. Install npm production deps from server/package.json (excluding workspace: refs)
 * 2. Copy workspace packages as real directories
 * 3. Apply ESM/CJS patches for Electron compatibility
 * 4. Output to build/server-modules/
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, cpSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";

const ROOT = resolve(import.meta.dirname, "..");
const OUTPUT = join(ROOT, "build", "server-modules");
const STAGING = join(ROOT, "build", ".server-staging");

const workspacePackages = [
  "packages/adapter-utils",
  "packages/shared",
  "packages/db",
  "packages/adapters/claude-local",
  "packages/adapters/codex-local",
  "packages/adapters/cursor-local",
  "packages/adapters/gemini-local",
  "packages/adapters/openclaw-gateway",
  "packages/adapters/opencode-local",
  "packages/adapters/pi-local",
  "packages/adapters/universal-llm",
  "packages/plugins/sdk",
];

console.log("=== Preparing server modules for production ===");

// 1. Clean
rmSync(OUTPUT, { recursive: true, force: true });
rmSync(STAGING, { recursive: true, force: true });
mkdirSync(STAGING, { recursive: true });

// 2. Create a merged package.json: server npm deps + all workspace package npm deps
const serverPkg = JSON.parse(readFileSync(join(ROOT, "server", "package.json"), "utf-8"));
const cleanDeps = {};

// Collect server's non-workspace deps
for (const [name, version] of Object.entries(serverPkg.dependencies || {})) {
  if (!version.startsWith("workspace:")) {
    cleanDeps[name] = version;
  }
}

// Also collect npm deps from all workspace packages (they need their own deps installed)
for (const pkg of workspacePackages) {
  try {
    const pkgJson = JSON.parse(readFileSync(join(ROOT, pkg, "package.json"), "utf-8"));
    for (const [name, version] of Object.entries(pkgJson.dependencies || {})) {
      if (!version.startsWith("workspace:") && !cleanDeps[name]) {
        cleanDeps[name] = version;
      }
    }
  } catch {}
}

writeFileSync(join(STAGING, "package.json"), JSON.stringify({ name: "titanclip-server-prod", private: true, dependencies: cleanDeps }, null, 2));
console.log(`  Merged ${Object.keys(cleanDeps).length} total npm dependencies`);

// 3. Install production deps
console.log(`  Installing ${Object.keys(cleanDeps).length} npm dependencies...`);
execSync("npm install --production --legacy-peer-deps --ignore-scripts 2>&1", {
  cwd: STAGING,
  stdio: "inherit",
  timeout: 120_000,
});

// 4. Move node_modules to output
mkdirSync(OUTPUT, { recursive: true });
cpSync(join(STAGING, "node_modules"), OUTPUT, { recursive: true });

// 5. Copy workspace packages

for (const pkg of workspacePackages) {
  const pkgJson = JSON.parse(readFileSync(join(ROOT, pkg, "package.json"), "utf-8"));
  const name = pkgJson.name; // e.g., "@titanclip/db"
  const [scope, base] = name.split("/");
  const dest = join(OUTPUT, scope, base);
  mkdirSync(dest, { recursive: true });

  // Copy dist/ + package.json only (no src/ TypeScript files)
  const pkgSrc = join(ROOT, pkg);
  cpSync(join(pkgSrc, "package.json"), join(dest, "package.json"));
  if (existsSync(join(pkgSrc, "dist"))) {
    cpSync(join(pkgSrc, "dist"), join(dest, "dist"), { recursive: true });
  }
  // Some packages also need migrations, schemas, or other non-TS assets
  for (const extra of ["migrations", "migrations-sqlite", "drizzle"]) {
    if (existsSync(join(pkgSrc, extra))) {
      cpSync(join(pkgSrc, extra), join(dest, extra), { recursive: true });
    }
  }

  // Patch package.json exports to point to dist/ instead of src/
  const destPkg = JSON.parse(readFileSync(join(dest, "package.json"), "utf-8"));
  if (destPkg.exports) {
    for (const [key, val] of Object.entries(destPkg.exports)) {
      if (typeof val === "string" && val.startsWith("./src/")) {
        destPkg.exports[key] = val.replace("./src/", "./dist/").replace(".ts", ".js");
      } else if (typeof val === "object" && val !== null) {
        for (const [cond, path] of Object.entries(val)) {
          if (typeof path === "string" && path.startsWith("./src/")) {
            val[cond] = path.replace("./src/", "./dist/").replace(".ts", ".js");
          }
        }
      }
    }
  }
  if (destPkg.main && destPkg.main.startsWith("./src/")) {
    destPkg.main = destPkg.main.replace("./src/", "./dist/").replace(".ts", ".js");
  }
  writeFileSync(join(dest, "package.json"), JSON.stringify(destPkg, null, 2));

  console.log(`  + ${name}`);
}

// 6. Remove .bin symlinks (break electron-builder's file copying)
rmSync(join(OUTPUT, ".bin"), { recursive: true, force: true });

// 7. Apply ESM/CJS patches
applyExodusbytesPatch();

// 7. Cleanup staging
rmSync(STAGING, { recursive: true, force: true });

const count = execSync(`ls "${OUTPUT}" | wc -l`, { encoding: "utf-8" }).trim();
console.log(`=== Done: ${count} top-level entries in ${OUTPUT} ===`);

/**
 * Patch @exodus/bytes ESM module for CJS compatibility.
 * html-encoding-sniffer require()s @exodus/bytes which is ESM-only.
 */
function applyExodusbytesPatch() {
  const bytesDir = join(OUTPUT, "@exodus", "bytes");
  if (!existsSync(bytesDir)) {
    console.log("  [skip] @exodus/bytes not found — patch not needed");
    return;
  }
  console.log("  Patching @exodus/bytes (ESM -> CJS fallback)...");

  mkdirSync(join(bytesDir, "fallback"), { recursive: true });
  writeFileSync(join(bytesDir, "fallback", "encoding-lite-cjs.cjs"), `
// CJS fallback for @exodus/bytes ESM module (auto-generated for Electron compatibility)
"use strict";
function getBOMEncoding(data) {
  if (data[0] === 0xFE && data[1] === 0xFF) return "UTF-16BE";
  if (data[0] === 0xFF && data[1] === 0xFE) return "UTF-16LE";
  if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) return "UTF-8";
  return null;
}
function labelToName(label) {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  const map = { "utf-8": "UTF-8", "utf8": "UTF-8", "utf-16le": "UTF-16LE", "utf-16be": "UTF-16BE", "ascii": "windows-1252", "iso-8859-1": "windows-1252", "latin1": "windows-1252" };
  return map[normalized] || normalized.toUpperCase();
}
module.exports = { getBOMEncoding, labelToName };
`);

  // Patch html-encoding-sniffer to use the CJS fallback
  const snifferDir = join(OUTPUT, "html-encoding-sniffer", "lib");
  if (existsSync(snifferDir)) {
    const snifferFile = join(snifferDir, "html-encoding-sniffer.js");
    if (existsSync(snifferFile)) {
      let content = readFileSync(snifferFile, "utf-8");
      if (content.includes("@exodus/bytes")) {
        content = content.replace(
          /require\(["']@exodus\/bytes\/encoding-lite["']\)/g,
          `require("@exodus/bytes/fallback/encoding-lite-cjs.cjs")`
        );
        writeFileSync(snifferFile, content);
        console.log("  Patched html-encoding-sniffer to use CJS fallback");
      }
    }
  }
}
