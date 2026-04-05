/**
 * Dock/Taskbar Progress — shows progress indicators in the OS dock or taskbar.
 *
 * macOS: Dock icon progress bar
 * Windows: Taskbar progress overlay
 * Linux: Unity launcher progress (limited support)
 *
 * Used to show:
 *   - Agent run progress (indeterminate while running)
 *   - Company export/import progress
 *   - Database migration progress
 */

import { BrowserWindow, ipcMain } from "electron";
import { getMainWindow } from "./window-manager.js";

type ProgressMode = "none" | "indeterminate" | "normal" | "error" | "paused";

let currentMode: ProgressMode = "none";
let activeRunCount = 0;

/**
 * Register dock/taskbar progress IPC handlers.
 */
export function registerDockProgressHandlers(): void {
  // Set progress from renderer
  ipcMain.handle(
    "dock:set-progress",
    (_event, progress: number, mode?: ProgressMode) => {
      setProgress(progress, mode);
    }
  );

  // Report active run count (for indeterminate progress)
  ipcMain.handle("dock:set-active-runs", (_event, count: number) => {
    activeRunCount = count;
    if (count > 0) {
      setProgress(-1, "indeterminate");
    } else if (currentMode === "indeterminate") {
      setProgress(0, "none");
    }
  });

  // Clear progress
  ipcMain.handle("dock:clear-progress", () => {
    setProgress(0, "none");
  });
}

/**
 * Set the dock/taskbar progress indicator.
 *
 * @param progress — 0 to 1 for normal progress, -1 for indeterminate, 0 with mode="none" to clear
 * @param mode — "none" | "indeterminate" | "normal" | "error" | "paused"
 */
export function setProgress(
  progress: number,
  mode: ProgressMode = "normal"
): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;

  currentMode = mode;

  switch (mode) {
    case "none":
      win.setProgressBar(-1); // Clear
      break;
    case "indeterminate":
      win.setProgressBar(2, { mode: "indeterminate" });
      break;
    case "error":
      win.setProgressBar(progress, { mode: "error" });
      break;
    case "paused":
      win.setProgressBar(progress, { mode: "paused" });
      break;
    case "normal":
    default:
      win.setProgressBar(Math.max(0, Math.min(1, progress)), {
        mode: "normal",
      });
      break;
  }
}

/**
 * Show indeterminate progress during agent runs.
 * Called from the live event handler when runs start/complete.
 */
export function onAgentRunStarted(): void {
  activeRunCount++;
  setProgress(-1, "indeterminate");
}

/**
 * Update progress when an agent run finishes.
 */
export function onAgentRunFinished(): void {
  activeRunCount = Math.max(0, activeRunCount - 1);
  if (activeRunCount === 0) {
    setProgress(0, "none");
  }
}

/**
 * Show error state in the dock/taskbar.
 */
export function showDockError(): void {
  setProgress(1, "error");
  // Auto-clear after 5 seconds
  setTimeout(() => {
    if (currentMode === "error") {
      setProgress(0, "none");
    }
  }, 5000);
}
