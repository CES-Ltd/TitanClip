/**
 * Server Bridge — manages the embedded Express server as a child process.
 *
 * Dev:  Spawns tsx to run TypeScript server directly
 * Prod: Spawns bundled Node.js binary (or system Node fallback) to run compiled server
 */

import { app } from "electron";
import { spawn, ChildProcess } from "child_process";
import http from "http";
import path from "path";
import { getServerSourcePath, getTsxBinPath, getResourcesPath } from "./paths.js";
import { augmentPathEnv } from "./path-env.js";

// tree-kill for clean process tree shutdown (kills postgres + child processes)
let treeKill: (pid: number, signal?: string, callback?: (error?: Error) => void) => void;
try {
  treeKill = require("tree-kill");
} catch {
  // Fallback if tree-kill not available
  treeKill = (pid, signal) => { try { process.kill(pid, (signal as any) || "SIGTERM"); } catch {} };
}

let serverProcess: ChildProcess | null = null;

const SERVER_PORT = 3100;
const IS_DEV = !app.isPackaged;

function getAugmentedPath(): string {
  const normalized = augmentPathEnv({
    PATH: process.env.PATH,
    Path: process.env.Path,
  });
  return normalized.PATH ?? normalized.Path ?? "";
}

export function startServer(): void {
  let command: string;
  let args: string[];
  let env: Record<string, string | undefined>;

  const baseEnv: Record<string, string> = {
    PORT: String(SERVER_PORT),
    HOST: "127.0.0.1",
    SERVE_UI: "true",
    PAPERCLIP_ELECTRON: "1",
    PAPERCLIP_MIGRATION_AUTO_APPLY: "true",
    PAPERCLIP_MIGRATION_PROMPT: "never",
    PAPERCLIP_DEPLOYMENT_MODE: "local_trusted",
    PAPERCLIP_OPEN_ON_LISTEN: "false",
    PATH: getAugmentedPath(),
  };

  if (IS_DEV) {
    // Dev mode: use tsx to run TypeScript directly
    const serverEntry = getServerSourcePath();
    const tsxBin = getTsxBinPath();
    command = tsxBin;
    args = [serverEntry];
    env = { ...process.env, ...baseEnv };
    console.log("[TitanClip] Starting server (dev) from:", serverEntry);
  } else {
    // Production: use bundled Node.js, fallback to system Node
    const serverEntry = path.join(getResourcesPath(), "server-dist", "index.js");
    const nodeBin = findProductionNode();
    command = nodeBin;
    args = ["--experimental-require-module", serverEntry];
    env = {
      ...process.env,
      ...baseEnv,
      NODE_PATH: path.join(getResourcesPath(), "server-dist", "node_modules"),
    };
    console.log("[TitanClip] Starting server (prod) from:", serverEntry);
    console.log("[TitanClip] Using node:", nodeBin);
  }

  serverProcess = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env,
    cwd: IS_DEV ? undefined : path.join(getResourcesPath(), "server-dist"),
  });

  serverProcess.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(`[server] ${data}`);
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`[server:err] ${data}`);
  });

  serverProcess.on("error", (err) => {
    console.error("[TitanClip] Server failed to start:", err);
  });

  serverProcess.on("exit", (code) => {
    console.log("[TitanClip] Server exited with code:", code);
    serverProcess = null;
  });
}

export function stopServer(): void {
  if (!serverProcess || !serverProcess.pid) return;

  console.log("[TitanClip] Stopping server (pid:", serverProcess.pid, ")...");
  const pid = serverProcess.pid;
  serverProcess = null;

  // Use tree-kill to kill the entire process tree (server + embedded postgres + adapters)
  treeKill(pid, "SIGTERM", (err) => {
    if (err) {
      console.warn("[TitanClip] tree-kill SIGTERM failed, force killing:", err.message);
      try { process.kill(pid, "SIGKILL"); } catch {}
    }
  });

  // Force kill after 5 seconds if still running
  setTimeout(() => {
    try {
      process.kill(pid, 0); // Check if alive
      console.log("[TitanClip] Server didn't stop, force killing...");
      treeKill(pid, "SIGKILL");
    } catch {
      // Already dead — good
    }
  }, 5000);
}

export function waitForServer(port: number, timeoutMs = 120000): Promise<void> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Server did not start within ${timeoutMs / 1000}s`));
        return;
      }
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      });
      req.on("error", () => setTimeout(check, 500));
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(check, 500);
      });
    };
    check();
  });
}

export function isServerRunning(): boolean {
  return serverProcess !== null && !serverProcess.killed;
}

/**
 * Find Node.js binary for production mode.
 * Priority: bundled node-bin > system node > Electron fallback
 */
function findProductionNode(): string {
  const { existsSync } = require("fs") as typeof import("fs");
  const { execSync } = require("child_process") as typeof import("child_process");

  // 1. Check bundled Node binary
  const bundled = path.join(getResourcesPath(), "node-bin", "node");
  if (existsSync(bundled)) {
    console.log("[TitanClip] Using bundled Node.js");
    return bundled;
  }

  // 2. Try system Node via which/where
  try {
    const nodePath = execSync(
      process.platform === "win32" ? "where node" : "which node",
      { encoding: "utf-8", timeout: 3000, env: { ...process.env, PATH: getAugmentedPath() } }
    ).trim().split("\n")[0]!.trim();
    if (nodePath && existsSync(nodePath)) {
      console.log("[TitanClip] Using system Node.js");
      return nodePath;
    }
  } catch {}

  // 3. Check common hardcoded locations
  const candidates = process.platform === "darwin"
    ? ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"]
    : process.platform === "win32"
    ? ["C:\\Program Files\\nodejs\\node.exe"]
    : ["/usr/bin/node", "/usr/local/bin/node"];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  // 4. Fallback: Electron runtime (may have ASAR issues)
  console.warn("[TitanClip] No Node.js found; falling back to Electron runtime (may have issues)");
  return process.execPath;
}
