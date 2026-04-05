/**
 * IPC Router — registers all IPC handlers for the main process.
 *
 * This module is the central registration point for all IPC communication
 * between the main process and renderer. It replaces the Express router.
 *
 * Phase 0: Core Electron IPC (navigation, platform, theme, dialogs)
 * Phase 2: Will add all business logic handlers (agents, issues, etc.)
 */

import { app, ipcMain, shell, dialog, BrowserWindow } from "electron";
import { getMainWindow } from "./window-manager.js";
import {
  showNotification,
  type TitanClipNotification,
} from "./notifications.js";
import { setTrayTooltip, setBadgeCount } from "./tray.js";

export function registerAllIpcHandlers(): void {
  // ── Core: App Info ────────────────────────────────────────────────────
  ipcMain.handle("app:get-version", () => app.getVersion());
  ipcMain.handle("app:get-platform", () => process.platform);
  ipcMain.handle("app:get-locale", () => app.getLocale());
  ipcMain.handle("app:get-path", (_event, name: string) => {
    return app.getPath(name as any);
  });

  // ── Core: Quit ────────────────────────────────────────────────────────
  ipcMain.handle("app:quit", () => {
    app.quit();
  });

  // ── Core: Shell ───────────────────────────────────────────────────────
  ipcMain.handle("shell:open-external", async (_event, url: string) => {
    await shell.openExternal(url);
  });
  ipcMain.handle("shell:show-item-in-folder", (_event, fullPath: string) => {
    shell.showItemInFolder(fullPath);
  });

  // ── Core: Navigation ─────────────────────────────────────────────────
  ipcMain.handle("nav:back", () => {
    getMainWindow()?.webContents.navigationHistory.goBack();
  });
  ipcMain.handle("nav:forward", () => {
    getMainWindow()?.webContents.navigationHistory.goForward();
  });
  ipcMain.handle("nav:can-go-back", () => {
    return getMainWindow()?.webContents.navigationHistory.canGoBack() ?? false;
  });
  ipcMain.handle("nav:can-go-forward", () => {
    return getMainWindow()?.webContents.navigationHistory.canGoForward() ?? false;
  });

  // ── Core: Theme ───────────────────────────────────────────────────────
  ipcMain.handle("theme:set", (_event, theme: "dark" | "light") => {
    const win = getMainWindow();
    if (!win || process.platform === "darwin") return;
    try {
      win.setTitleBarOverlay({
        color: theme === "dark" ? "#09090b" : "#ffffff",
        symbolColor: theme === "dark" ? "#a1a1aa" : "#374151",
      });
    } catch {
      // Older Electron versions may not support this
    }
  });

  // ── Native: File Dialogs ──────────────────────────────────────────────
  ipcMain.handle("dialog:open-file", async (_event, options: Electron.OpenDialogOptions) => {
    const win = getMainWindow();
    if (!win) return { canceled: true, filePaths: [] };
    return dialog.showOpenDialog(win, options);
  });

  ipcMain.handle("dialog:save-file", async (_event, options: Electron.SaveDialogOptions) => {
    const win = getMainWindow();
    if (!win) return { canceled: true, filePath: "" };
    return dialog.showSaveDialog(win, options);
  });

  ipcMain.handle("dialog:message-box", async (_event, options: Electron.MessageBoxOptions) => {
    const win = getMainWindow();
    if (!win) return { response: 0, checkboxChecked: false };
    return dialog.showMessageBox(win, options);
  });

  // ── Native: Notifications ────────────────────────────────────────────
  ipcMain.handle("notification:show", (_event, opts: TitanClipNotification) => {
    const win = getMainWindow();
    if (win) showNotification(win, opts);
  });

  // ── Native: Tray & Badge ─────────────────────────────────────────────
  ipcMain.handle("tray:set-tooltip", (_event, tooltip: string) => {
    setTrayTooltip(tooltip);
  });
  ipcMain.handle("tray:set-badge", (_event, count: number) => {
    setBadgeCount(count);
  });

  // ── Native: Window Controls ───────────────────────────────────────────
  ipcMain.handle("window:minimize", () => {
    getMainWindow()?.minimize();
  });
  ipcMain.handle("window:maximize", () => {
    const win = getMainWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });
  ipcMain.handle("window:is-maximized", () => {
    return getMainWindow()?.isMaximized() ?? false;
  });
  ipcMain.handle("window:is-fullscreen", () => {
    return getMainWindow()?.isFullScreen() ?? false;
  });
  ipcMain.handle("window:close", () => {
    getMainWindow()?.close();
  });

  // ── Legacy compatibility (old channel names) ──────────────────────────
  // These bridge the old preload API to the new one during migration.
  // Remove after Phase 2 when UI is fully migrated.
  ipcMain.handle("get-app-version", () => app.getVersion());
  ipcMain.handle("get-platform", () => process.platform);
  ipcMain.handle("open-external", async (_event, url: string) => {
    await shell.openExternal(url);
  });
  ipcMain.handle("nav-back", () => getMainWindow()?.webContents.navigationHistory.goBack());
  ipcMain.handle("nav-forward", () => getMainWindow()?.webContents.navigationHistory.goForward());
  ipcMain.handle("nav-can-go-back", () => getMainWindow()?.webContents.navigationHistory.canGoBack() ?? false);
  ipcMain.handle("nav-can-go-forward", () => getMainWindow()?.webContents.navigationHistory.canGoForward() ?? false);
  ipcMain.handle("set-theme", (_event, theme: string) => {
    const win = getMainWindow();
    if (!win || process.platform === "darwin") return;
    try {
      win.setTitleBarOverlay({
        color: theme === "dark" ? "#09090b" : "#ffffff",
        symbolColor: theme === "dark" ? "#a1a1aa" : "#374151",
      });
    } catch { /* ignore */ }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Phase 2 TODO: Add business logic IPC handlers here
  // These will replace the Express REST routes:
  //
  // ipcMain.handle("companies:list", async () => { ... })
  // ipcMain.handle("agents:list", async (_e, { companyId }) => { ... })
  // ipcMain.handle("issues:create", async (_e, input) => { ... })
  // ... etc for all 36 route files
  // ────────────────────────────────────────────────────────────────────────

  console.log("[TitanClip] IPC handlers registered");
}
