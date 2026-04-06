#!/usr/bin/env node
/**
 * Download a standalone Node.js binary for the target platform/arch.
 * Used by the production build so end users don't need Node installed.
 *
 * Usage: node scripts/download-node.mjs [--platform darwin|win32|linux] [--arch arm64|x64]
 */

import { existsSync, mkdirSync, createWriteStream, chmodSync, unlinkSync, renameSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const NODE_VERSION = "v22.15.0";
const OUTPUT_DIR = join(import.meta.dirname, "..", "build", "node-bin");

const args = process.argv.slice(2);
const platform = args.includes("--platform") ? args[args.indexOf("--platform") + 1] : process.platform;
const arch = args.includes("--arch") ? args[args.indexOf("--arch") + 1] : process.arch;

function getNodeUrl(platform, arch) {
  const base = `https://nodejs.org/dist/${NODE_VERSION}`;
  if (platform === "win32") {
    return `${base}/node-${NODE_VERSION}-win-${arch === "arm64" ? "arm64" : "x64"}.zip`;
  }
  const os = platform === "darwin" ? "darwin" : "linux";
  return `${base}/node-${NODE_VERSION}-${os}-${arch}.tar.gz`;
}

async function download(url, dest) {
  console.log(`  Downloading ${url}`);
  execSync(`curl -fSL -o "${dest}" "${url}"`, { stdio: "inherit" });
}

async function main() {
  console.log(`=== Downloading Node.js ${NODE_VERSION} for ${platform}-${arch} ===`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const outputBin = join(OUTPUT_DIR, platform === "win32" ? "node.exe" : "node");

  // Skip if already downloaded
  if (existsSync(outputBin)) {
    console.log(`  Already exists: ${outputBin}`);
    const version = execSync(`"${outputBin}" --version`, { encoding: "utf-8" }).trim();
    console.log(`  Version: ${version}`);
    return;
  }

  const url = getNodeUrl(platform, arch);
  const tmpDir = join(OUTPUT_DIR, ".tmp");
  mkdirSync(tmpDir, { recursive: true });

  if (platform === "win32") {
    const zipPath = join(tmpDir, "node.zip");
    await download(url, zipPath);
    execSync(`unzip -o "${zipPath}" -d "${tmpDir}"`, { stdio: "inherit" });
    const extracted = join(tmpDir, `node-${NODE_VERSION}-win-${arch === "arm64" ? "arm64" : "x64"}`, "node.exe");
    renameSync(extracted, outputBin);
  } else {
    const tarPath = join(tmpDir, "node.tar.gz");
    await download(url, tarPath);
    const os = platform === "darwin" ? "darwin" : "linux";
    execSync(`tar -xzf "${tarPath}" -C "${tmpDir}"`, { stdio: "inherit" });
    const extracted = join(tmpDir, `node-${NODE_VERSION}-${os}-${arch}`, "bin", "node");
    renameSync(extracted, outputBin);
    chmodSync(outputBin, 0o755);
  }

  // Cleanup temp
  execSync(`rm -rf "${tmpDir}"`);

  // Verify
  const version = execSync(`"${outputBin}" --version`, { encoding: "utf-8" }).trim();
  console.log(`  Installed: ${outputBin} (${version})`);
  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Failed to download Node.js:", err.message);
  process.exit(1);
});
