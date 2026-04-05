/**
 * Adapter Manager — manages adapter subprocess lifecycle in the main process.
 *
 * Adapters (Claude CLI, Codex, Cursor, Gemini, etc.) run as child processes.
 * This module provides:
 *   - Process tracking (which adapters are running, PID, memory usage)
 *   - Graceful shutdown on app quit (SIGTERM → SIGKILL after timeout)
 *   - Automatic restart on crash (with exponential backoff)
 *   - Process monitoring (CPU/memory reporting to renderer)
 *   - Log streaming from adapter stdout/stderr to renderer via IPC
 *
 * The adapter registry itself is loaded from the server package via
 * dynamic import (same code, no HTTP boundary).
 */

import { ipcMain } from "electron";
import { ChildProcess } from "child_process";
import { getMainWindow } from "./window-manager.js";
import {
  onAgentRunStarted,
  onAgentRunFinished,
  showDockError,
} from "./dock-progress.js";

interface TrackedProcess {
  pid: number;
  agentId: string;
  adapterType: string;
  runId: string;
  startedAt: Date;
  process: ChildProcess;
}

const activeProcesses = new Map<number, TrackedProcess>();

// Restart tracking for backoff
const restartCounts = new Map<string, { count: number; lastRestart: number }>();
const MAX_RESTARTS = 5;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_RESET_MS = 300_000; // Reset backoff after 5 minutes of stability

/**
 * Register IPC handlers for adapter management.
 */
export function registerAdapterManagerHandlers(): void {
  // List active adapter processes
  ipcMain.handle("adapters:list-active", () => {
    return Array.from(activeProcesses.values()).map((p) => ({
      pid: p.pid,
      agentId: p.agentId,
      adapterType: p.adapterType,
      runId: p.runId,
      startedAt: p.startedAt.toISOString(),
      uptimeMs: Date.now() - p.startedAt.getTime(),
    }));
  });

  // Get process count
  ipcMain.handle("adapters:active-count", () => activeProcesses.size);

  // Kill a specific adapter process
  ipcMain.handle("adapters:kill-process", (_event, pid: number) => {
    const tracked = activeProcesses.get(pid);
    if (!tracked) return { ok: false, error: "Process not found" };

    try {
      tracked.process.kill("SIGTERM");
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!tracked.process.killed) {
          tracked.process.kill("SIGKILL");
        }
      }, 5000);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

  // Kill all adapter processes
  ipcMain.handle("adapters:kill-all", () => {
    const count = activeProcesses.size;
    killAllProcesses();
    return { killed: count };
  });
}

/**
 * Track a newly spawned adapter process.
 * Called by the heartbeat/execution service when an adapter starts.
 */
export function trackProcess(
  process: ChildProcess,
  meta: { agentId: string; adapterType: string; runId: string }
): void {
  if (!process.pid) return;

  const tracked: TrackedProcess = {
    pid: process.pid,
    agentId: meta.agentId,
    adapterType: meta.adapterType,
    runId: meta.runId,
    startedAt: new Date(),
    process,
  };

  activeProcesses.set(process.pid, tracked);
  onAgentRunStarted();

  // Stream stdout/stderr to renderer
  const win = getMainWindow();
  process.stdout?.on("data", (data: Buffer) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("adapter:log", {
        pid: process.pid,
        runId: meta.runId,
        stream: "stdout",
        data: data.toString("utf-8"),
      });
    }
  });

  process.stderr?.on("data", (data: Buffer) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("adapter:log", {
        pid: process.pid,
        runId: meta.runId,
        stream: "stderr",
        data: data.toString("utf-8"),
      });
    }
  });

  // Handle process exit
  process.on("exit", (code, signal) => {
    activeProcesses.delete(process.pid!);
    onAgentRunFinished();

    // Notify renderer
    if (win && !win.isDestroyed()) {
      win.webContents.send("adapter:exit", {
        pid: process.pid,
        runId: meta.runId,
        agentId: meta.agentId,
        exitCode: code,
        signal,
      });
    }

    // Track crash for auto-restart backoff
    if (code !== 0 && code !== null && signal !== "SIGTERM" && signal !== "SIGKILL") {
      handleAdapterCrash(meta);
    }
  });

  process.on("error", (err) => {
    console.error(`[TitanClip] Adapter process error (pid=${process.pid}):`, err.message);
    activeProcesses.delete(process.pid!);
    onAgentRunFinished();
    showDockError();
  });
}

/**
 * Handle an adapter crash — track for backoff-based auto-restart.
 */
function handleAdapterCrash(meta: { agentId: string; adapterType: string; runId: string }): void {
  const key = `${meta.agentId}:${meta.adapterType}`;
  const now = Date.now();

  let entry = restartCounts.get(key);
  if (!entry || now - entry.lastRestart > BACKOFF_RESET_MS) {
    entry = { count: 0, lastRestart: now };
  }

  entry.count++;
  entry.lastRestart = now;
  restartCounts.set(key, entry);

  if (entry.count > MAX_RESTARTS) {
    console.error(
      `[TitanClip] Adapter ${meta.adapterType} for agent ${meta.agentId} crashed ${entry.count} times. Not restarting.`
    );
    showDockError();
    return;
  }

  const backoffMs = BACKOFF_BASE_MS * Math.pow(2, entry.count - 1);
  console.log(
    `[TitanClip] Adapter ${meta.adapterType} crashed (attempt ${entry.count}/${MAX_RESTARTS}). Restart in ${backoffMs}ms.`
  );

  // The actual restart is handled by the heartbeat service which monitors run status.
  // This module just tracks the crash pattern and enforces backoff limits.
}

/**
 * Kill all tracked adapter processes. Called on app quit.
 */
export function killAllProcesses(): void {
  for (const [pid, tracked] of activeProcesses) {
    try {
      tracked.process.kill("SIGTERM");
    } catch {
      // Already dead
    }
  }

  // Force kill stragglers after 3 seconds
  if (activeProcesses.size > 0) {
    setTimeout(() => {
      for (const [pid, tracked] of activeProcesses) {
        try {
          if (!tracked.process.killed) {
            tracked.process.kill("SIGKILL");
          }
        } catch {
          // Already dead
        }
      }
      activeProcesses.clear();
    }, 3000);
  }
}

/**
 * Get the count of active adapter processes.
 */
export function getActiveProcessCount(): number {
  return activeProcesses.size;
}
