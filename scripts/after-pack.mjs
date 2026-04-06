/**
 * electron-builder afterPack hook — signs all nested binaries with ad-hoc identity.
 * Must sign in dependency order: dylibs → native addons → helpers → frameworks → app.
 */

import { execSync } from "child_process";
import { readdirSync, statSync } from "fs";
import { join } from "path";

export default async function afterPack(context) {
  if (process.platform !== "darwin") return;

  const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const entitlements = join(context.packager.projectDir, "build", "entitlements.mac.inherit.plist");

  console.log("  [afterPack] Signing nested binaries in:", appPath);

  // Remove quarantine
  try { execSync(`xattr -cr "${appPath}"`, { stdio: "ignore" }); } catch {}

  // Sign all .dylib files
  findFiles(join(appPath, "Contents"), ".dylib").forEach((f) => sign(f, entitlements));

  // Sign all .node native addons
  findFiles(join(appPath, "Contents"), ".node").forEach((f) => sign(f, entitlements));

  // Sign helper apps
  const frameworks = join(appPath, "Contents", "Frameworks");
  findFiles(frameworks, ".app").forEach((f) => sign(f, entitlements));

  // Sign frameworks
  findFiles(frameworks, ".framework").forEach((f) => sign(f, entitlements));

  console.log("  [afterPack] Nested signing complete");
}

function sign(target, entitlements) {
  try {
    execSync(`codesign --force --sign - --entitlements "${entitlements}" "${target}"`, { stdio: "ignore" });
  } catch (err) {
    console.warn(`  [afterPack] Warning: failed to sign ${target}`);
  }
}

function findFiles(dir, ext) {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        results.push(...findFiles(full, ext));
      } else if (entry.name.endsWith(ext)) {
        results.push(full);
      }
      // Also match directory-based bundles (.app, .framework)
      if (entry.isDirectory() && entry.name.endsWith(ext)) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}
