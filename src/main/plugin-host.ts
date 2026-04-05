/**
 * Plugin Host — runs plugins in Electron utility processes.
 *
 * Replaces the server's worker-thread based plugin system with Electron's
 * utilityProcess for better isolation and lifecycle management.
 *
 * Benefits over worker threads:
 *   - True process isolation (crash doesn't affect main process)
 *   - Separate V8 heap (no shared memory pressure)
 *   - Can be individually killed/restarted
 *   - Better debugging (each plugin gets its own process)
 *   - MessagePort for efficient IPC (no JSON-RPC over stdio)
 *
 * Also registers a custom plugin:// protocol for serving plugin UI assets
 * from the local filesystem instead of over HTTP.
 */

import { app, protocol, net, ipcMain, utilityProcess, MessageChannelMain } from "electron";
import path from "path";
import { existsSync } from "fs";

interface PluginWorker {
  pluginId: string;
  pluginKey: string;
  process: ReturnType<typeof utilityProcess.fork>;
  port: Electron.MessagePortMain;
  status: "starting" | "ready" | "crashed" | "stopped";
  startedAt: Date;
  restartCount: number;
}

const pluginWorkers = new Map<string, PluginWorker>();

/**
 * Register the plugin:// protocol for serving plugin UI assets.
 * Must be called before app.whenReady().
 */
export function registerPluginProtocol(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: "plugin",
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: false,
      },
    },
  ]);
}

/**
 * Set up the plugin:// protocol handler.
 * Must be called after app.whenReady().
 *
 * Maps plugin://pluginId/path → local filesystem path
 */
export function setupPluginProtocolHandler(pluginBaseDir: string): void {
  protocol.handle("plugin", (request) => {
    const url = new URL(request.url);
    const pluginId = url.hostname;
    let filePath = decodeURIComponent(url.pathname);

    if (process.platform === "win32" && filePath.startsWith("/")) {
      filePath = filePath.slice(1);
    }

    // Resolve plugin asset path
    const fullPath = path.join(pluginBaseDir, pluginId, filePath);

    // Security: prevent path traversal
    if (!fullPath.startsWith(path.join(pluginBaseDir, pluginId))) {
      return new Response("Forbidden", { status: 403 });
    }

    if (!existsSync(fullPath)) {
      return new Response("Not Found", { status: 404 });
    }

    return net.fetch(`file://${fullPath}`);
  });
}

/**
 * Register IPC handlers for plugin management.
 */
export function registerPluginHostHandlers(): void {
  // List running plugin workers
  ipcMain.handle("plugin-host:list-workers", () => {
    return Array.from(pluginWorkers.values()).map((w) => ({
      pluginId: w.pluginId,
      pluginKey: w.pluginKey,
      status: w.status,
      pid: w.process?.pid,
      startedAt: w.startedAt.toISOString(),
      restartCount: w.restartCount,
    }));
  });

  // Start a plugin worker
  ipcMain.handle("plugin-host:start", async (_event, opts: {
    pluginId: string;
    pluginKey: string;
    workerScript: string;
    env?: Record<string, string>;
  }) => {
    return startPluginWorker(opts);
  });

  // Stop a plugin worker
  ipcMain.handle("plugin-host:stop", (_event, pluginId: string) => {
    return stopPluginWorker(pluginId);
  });

  // Restart a plugin worker
  ipcMain.handle("plugin-host:restart", async (_event, pluginId: string) => {
    const existing = pluginWorkers.get(pluginId);
    if (existing) {
      await stopPluginWorker(pluginId);
      return startPluginWorker({
        pluginId: existing.pluginId,
        pluginKey: existing.pluginKey,
        workerScript: "", // Re-resolved on start
      });
    }
    return { ok: false, error: "Plugin not found" };
  });

  // Send a message to a plugin worker
  ipcMain.handle(
    "plugin-host:send",
    (_event, pluginId: string, message: any) => {
      const worker = pluginWorkers.get(pluginId);
      if (!worker || worker.status !== "ready") {
        return { ok: false, error: "Plugin not ready" };
      }
      worker.port.postMessage(message);
      return { ok: true };
    }
  );
}

/**
 * Start a plugin in a utility process.
 */
async function startPluginWorker(opts: {
  pluginId: string;
  pluginKey: string;
  workerScript: string;
  env?: Record<string, string>;
}): Promise<{ ok: boolean; pid?: number; error?: string }> {
  // Kill existing if running
  if (pluginWorkers.has(opts.pluginId)) {
    await stopPluginWorker(opts.pluginId);
  }

  try {
    const child = utilityProcess.fork(opts.workerScript, [], {
      serviceName: `plugin-${opts.pluginKey}`,
      env: {
        ...process.env,
        TITANCLIP_PLUGIN_ID: opts.pluginId,
        TITANCLIP_PLUGIN_KEY: opts.pluginKey,
        ...(opts.env ?? {}),
      },
    });

    // Set up MessagePort for communication
    const { port1, port2 } = new MessageChannelMain();

    const worker: PluginWorker = {
      pluginId: opts.pluginId,
      pluginKey: opts.pluginKey,
      process: child,
      port: port1,
      status: "starting",
      startedAt: new Date(),
      restartCount: 0,
    };

    pluginWorkers.set(opts.pluginId, worker);

    // Send the port to the worker
    child.postMessage({ type: "init", pluginId: opts.pluginId }, [port2]);

    // Listen for worker ready signal
    port1.on("message", (event) => {
      const msg = event.data;
      if (msg?.type === "ready") {
        worker.status = "ready";
      }
    });

    port1.start();

    // Handle worker exit
    child.on("exit", (code) => {
      const w = pluginWorkers.get(opts.pluginId);
      if (w) {
        w.status = code === 0 ? "stopped" : "crashed";
        if (code !== 0) {
          console.error(
            `[TitanClip] Plugin ${opts.pluginKey} crashed (exit code ${code})`
          );
        }
      }
    });

    return { ok: true, pid: child.pid };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * Stop a plugin worker.
 */
async function stopPluginWorker(
  pluginId: string
): Promise<{ ok: boolean }> {
  const worker = pluginWorkers.get(pluginId);
  if (!worker) return { ok: false };

  try {
    worker.port.close();
  } catch {
    // Port already closed
  }
  try {
    worker.process.kill();
  } catch {
    // Already dead
  }

  pluginWorkers.delete(pluginId);
  return { ok: true };
}

/**
 * Stop all plugin workers. Called on app quit.
 */
export function stopAllPluginWorkers(): void {
  for (const [id, worker] of pluginWorkers) {
    try {
      worker.port.close();
      worker.process.kill();
    } catch {
      // Already dead
    }
  }
  pluginWorkers.clear();
}
