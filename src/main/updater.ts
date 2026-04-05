import { BrowserWindow, dialog } from "electron";

/**
 * Initialize auto-updater for production builds.
 *
 * Requires `electron-updater` package to be installed.
 * In Phase 10, electron-builder will be configured with a publish provider
 * (e.g., GitHub Releases) and this module will check for updates on launch
 * and periodically.
 *
 * For now, this is a stub that will be activated when the build pipeline
 * is set up with code signing and a publish target.
 */
export function initAutoUpdater(mainWindow: BrowserWindow): void {
  try {
    // Dynamic import — electron-updater may not be installed yet
    const { autoUpdater } = require("electron-updater");

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("update-available", (info: any) => {
      dialog
        .showMessageBox(mainWindow, {
          type: "info",
          title: "Update Available",
          message: `TitanClip ${info.version} is available. Would you like to download it?`,
          buttons: ["Download", "Later"],
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) {
            autoUpdater.downloadUpdate().catch((err: Error) => {
              console.error("[TitanClip] Update download failed:", err.message);
            });
            mainWindow.webContents.send("updater:downloading", info.version);
          }
        });
    });

    autoUpdater.on("update-downloaded", (info: any) => {
      dialog
        .showMessageBox(mainWindow, {
          type: "info",
          title: "Update Ready",
          message: `TitanClip ${info.version} has been downloaded. Restart to apply the update?`,
          buttons: ["Restart Now", "Later"],
          defaultId: 0,
          cancelId: 1,
        })
        .then(({ response }) => {
          if (response === 0) {
            autoUpdater.quitAndInstall();
          }
        });
    });

    autoUpdater.on("error", (err: Error) => {
      console.error("[TitanClip] Auto-updater error:", err.message);
    });

    // Check for updates after a short delay (don't block startup)
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err: Error) => {
        console.log("[TitanClip] Update check skipped:", err.message);
      });
    }, 10_000);
  } catch {
    // electron-updater not installed — skip auto-update
    console.log("[TitanClip] Auto-updater not available (electron-updater not installed)");
  }
}
