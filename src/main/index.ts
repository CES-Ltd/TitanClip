import { app, BrowserWindow } from "electron";
import path from "path";
import { createMainWindow, getMainWindow } from "./window-manager.js";
import { createAppMenu } from "./menu.js";
import { createTray, destroyTray } from "./tray.js";
import { registerAllIpcHandlers } from "./ipc-router.js";
import { startServer, stopServer, waitForServer } from "./server-bridge.js";
import { registerDeepLinkProtocol, handleDeepLink } from "./deep-links.js";
import { registerContextMenuHandlers } from "./context-menu.js";
import { initAutoUpdater } from "./updater.js";
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from "./global-shortcuts.js";
import { registerClipboardHandlers } from "./clipboard.js";
import { registerDragDropHandlers } from "./drag-drop.js";
import { setupTouchBar } from "./touchbar.js";
import { registerDockProgressHandlers } from "./dock-progress.js";
import { registerAppProtocol, setupProtocolHandler, getUIUrl } from "./protocol.js";
import { registerAdapterManagerHandlers, killAllProcesses } from "./adapter-manager.js";
import { registerPluginProtocol, setupPluginProtocolHandler, registerPluginHostHandlers, stopAllPluginWorkers } from "./plugin-host.js";
import { registerFileStorageHandlers } from "./file-storage.js";
import { getPluginsPath } from "./paths.js";
import { setForceQuit } from "./window-manager.js";

const SERVER_PORT = 3100;
const IS_DEV = !app.isPackaged;

// ── Single instance lock ──────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    const deepLink = argv.find((arg) => arg.startsWith("titanclip://"));
    if (deepLink) handleDeepLink(deepLink);
  });
}

// ── Protocols (must be registered before app.whenReady) ───────────────
registerDeepLinkProtocol();
registerAppProtocol();
registerPluginProtocol();

// ── App lifecycle ─────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Register core IPC handlers (platform, theme, dialogs, etc.)
  registerAllIpcHandlers();

  // Create the main window
  const mainWindow = createMainWindow();

  // Set up native chrome
  createAppMenu(mainWindow);
  createTray(mainWindow);
  registerContextMenuHandlers(mainWindow);
  setupTouchBar(mainWindow);

  // Register native feature handlers
  registerClipboardHandlers();
  registerDragDropHandlers();
  registerDockProgressHandlers();
  registerAdapterManagerHandlers();
  registerPluginHostHandlers();
  registerFileStorageHandlers();
  registerGlobalShortcuts();

  // Set up protocols
  setupPluginProtocolHandler(getPluginsPath());
  setupProtocolHandler();

  // ── Start the embedded server and load UI ─────────────────────────
  // The server runs as a child process using the system tsx (dev) or
  // Electron-as-Node (prod). The UI is served by the server on localhost.
  try {
    startServer();
    console.log("[TitanClip] Waiting for server to be ready...");
    await waitForServer(SERVER_PORT);
    console.log("[TitanClip] Server ready, loading UI...");
    mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`);
  } catch (err) {
    console.error("[TitanClip] Startup failed:", err);
    mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(buildErrorPage(err))}`
    );
  }

  // Auto-updater (production only)
  if (!IS_DEV) {
    initAutoUpdater(mainWindow);
  }

  // macOS: re-create window on dock click if all closed
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      getMainWindow()?.show();
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS, app stays alive when all windows close (dock behavior).
  // On other platforms, quit immediately.
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  // Set forceQuit FIRST — this prevents the window close handler
  // from intercepting the close and hiding the window instead.
  setForceQuit(true);

  // Stop all child processes and cleanup
  stopServer();
  destroyTray();
  unregisterGlobalShortcuts();
  killAllProcesses();
  stopAllPluginWorkers();
});

// ── macOS deep link handler ───────────────────────────────────────────
app.on("open-url", (_event, url) => {
  handleDeepLink(url);
});

// ── Error handlers ────────────────────────────────────────────────────
process.on("uncaughtException", (error) => {
  console.error("[TitanClip] Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[TitanClip] Unhandled Rejection:", reason);
});

// ── Helpers ───────────────────────────────────────────────────────────
function buildErrorPage(err: unknown): string {
  return `<!DOCTYPE html>
<html><head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         display: flex; align-items: center; justify-content: center; height: 100vh;
         margin: 0; background: #09090b; color: #ef4444; flex-direction: column; padding: 40px; }
  h2 { margin-bottom: 8px; color: #fca5a5; }
  pre { background: #1c1917; padding: 16px; border-radius: 8px; max-width: 600px;
        overflow-x: auto; font-size: 13px; color: #a1a1aa; }
</style></head>
<body><h2>Failed to start TitanClip</h2><pre>${String(err)}</pre></body></html>`;
}
