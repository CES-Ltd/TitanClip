/**
 * Server Bridge — manages the embedded Express server as a child process.
 *
 * Dev:  Spawns tsx to run TypeScript server directly
 * Prod: Spawns the Electron binary as a Node.js runtime (ELECTRON_RUN_AS_NODE=1)
 *       to run the pre-compiled server from extraResources
 */

import { app } from "electron";
import { spawn, ChildProcess } from "child_process";
import http from "http";
import path from "path";
import { getServerSourcePath, getTsxBinPath, getResourcesPath } from "./paths.js";

let serverProcess: ChildProcess | null = null;

const SERVER_PORT = 3100;
const IS_DEV = !app.isPackaged;

export function startServer(): void {
  let command: string;
  let args: string[];
  let env: Record<string, string | undefined>;

  // Ensure CLI tools (opencode, claude, codex, cursor, etc.) are discoverable
  // by including common binary directories in PATH.
  const extraPaths = process.platform === "darwin"
    ? "/opt/homebrew/bin:/usr/local/bin:/usr/bin"
    : process.platform === "win32"
    ? "C:\\Program Files\\nodejs"
    : "/usr/local/bin:/usr/bin";
  const fullPath = `${extraPaths}:${process.env.PATH ?? ""}`;

  const baseEnv: Record<string, string> = {
    PORT: String(SERVER_PORT),
    HOST: "127.0.0.1",
    SERVE_UI: "true",
    TITANCLIP_ELECTRON: "1",
    TITANCLIP_MIGRATION_AUTO_APPLY: "true",
    TITANCLIP_MIGRATION_PROMPT: "never",
    TITANCLIP_DEPLOYMENT_MODE: "local_trusted",
    TITANCLIP_OPEN_ON_LISTEN: "false",
    PATH: fullPath,
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
    // Production: use system Node.js to run the server.
    // Electron's built-in Node has an ASAR fs wrapper that conflicts with
    // --experimental-require-module (infinite recursion). System Node avoids this.
    const serverEntry = path.join(getResourcesPath(), "server-dist", "index.js");
    const nodeBin = findSystemNode();
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
    // Set cwd to server-dist so relative requires work
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
  if (!serverProcess) return;

  console.log("[TitanClip] Stopping server...");
  const proc = serverProcess;
  serverProcess = null;

  try {
    // Send SIGTERM for graceful shutdown
    proc.kill("SIGTERM");
  } catch {
    // Already dead
    return;
  }

  // Force kill after 5 seconds if still running
  const forceKillTimer = setTimeout(() => {
    try {
      if (!proc.killed) {
        console.log("[TitanClip] Server didn't stop gracefully, force killing...");
        proc.kill("SIGKILL");
      }
    } catch {
      // Already dead
    }
  }, 5000);

  // Clean up timer if process exits on its own
  proc.on("exit", () => {
    clearTimeout(forceKillTimer);
  });
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
 * Find system Node.js binary.
 * Checks common locations on macOS, Windows, and Linux.
 * Falls back to Electron's binary with ELECTRON_RUN_AS_NODE if system Node not found.
 */
function findSystemNode(): string {
  const { execSync } = require("child_process") as typeof import("child_process");
  const { existsSync } = require("fs") as typeof import("fs");

  // Try `which node` / `where node`
  try {
    const nodePath = execSync(
      process.platform === "win32" ? "where node" : "which node",
      { encoding: "utf-8", timeout: 3000, env: { ...process.env, PATH: getNodeSearchPath() } }
    ).trim().split("\n")[0]!.trim();
    if (nodePath && existsSync(nodePath)) {
      return nodePath;
    }
  } catch {
    // which/where failed
  }

  // Check common locations
  const candidates = process.platform === "darwin"
    ? ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"]
    : process.platform === "win32"
    ? ["C:\\Program Files\\nodejs\\node.exe"]
    : ["/usr/bin/node", "/usr/local/bin/node"];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // Fallback: use Electron as Node (may have issues but better than nothing)
  console.warn("[TitanClip] System Node.js not found; falling back to Electron runtime");
  return process.execPath;
}

/**
 * Build a PATH string that includes common Node.js installation directories.
 */
function getNodeSearchPath(): string {
  const base = process.env.PATH ?? "";
  const extra = process.platform === "darwin"
    ? "/opt/homebrew/bin:/usr/local/bin"
    : process.platform === "win32"
    ? "C:\\Program Files\\nodejs"
    : "/usr/local/bin";
  return `${extra}:${base}`;
}
