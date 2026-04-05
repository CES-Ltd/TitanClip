import { app, Tray, Menu, nativeImage, BrowserWindow } from "electron";
import { getTrayIconPath } from "./paths.js";
import { setForceQuit } from "./window-manager.js";

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow): void {
  const iconPath = getTrayIconPath();

  // Create a 16x16 or 22x22 template image for macOS tray
  let trayIcon = nativeImage.createFromPath(iconPath);
  trayIcon = trayIcon.resize({ width: 16, height: 16 });

  if (process.platform === "darwin") {
    trayIcon.setTemplateImage(true);
  }

  tray = new Tray(trayIcon);
  tray.setToolTip("TitanClip");

  const contextMenu = buildContextMenu(mainWindow);
  tray.setContextMenu(contextMenu);

  // Click to show/hide window
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Double-click to show window (Windows)
  tray.on("double-click", () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

export function updateTrayMenu(mainWindow: BrowserWindow): void {
  if (tray) {
    const contextMenu = buildContextMenu(mainWindow);
    tray.setContextMenu(contextMenu);
  }
}

export function setTrayTooltip(tooltip: string): void {
  if (tray) {
    tray.setToolTip(tooltip);
  }
}

/**
 * Set a badge count on the dock icon (macOS) or tray overlay (Windows).
 * Useful for pending approvals, unread notifications, etc.
 */
export function setBadgeCount(count: number): void {
  if (process.platform === "darwin") {
    app.dock?.setBadge(count > 0 ? String(count) : "");
  }
  // Windows: could set overlay icon on taskbar in the future
}

function buildContextMenu(mainWindow: BrowserWindow): Menu {
  return Menu.buildFromTemplate([
    {
      label: "Show TitanClip",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: "separator" },
    {
      label: "Dashboard",
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send("menu:navigate", "/dashboard");
      },
    },
    {
      label: "Agents",
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send("menu:navigate", "/agents");
      },
    },
    {
      label: "Issues",
      click: () => {
        mainWindow.show();
        mainWindow.webContents.send("menu:navigate", "/issues");
      },
    },
    { type: "separator" },
    {
      label: "Quit TitanClip",
      click: () => {
        setForceQuit(true);
        app.quit();
      },
    },
  ]);
}
