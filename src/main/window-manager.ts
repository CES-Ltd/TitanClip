import { app, BrowserWindow, screen } from "electron";
import path from "path";
import fs from "fs";
import { getPreloadPath, getIconPath } from "./paths.js";

let mainWindow: BrowserWindow | null = null;
let forceQuit = false;
const windowBounds = new WeakMap<BrowserWindow, Electron.Rectangle>();

const STATE_FILE = path.join(app.getPath("userData"), "window-state.json");

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

function loadWindowState(): WindowState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      return {
        width: data.width ?? 1400,
        height: data.height ?? 900,
        x: data.x,
        y: data.y,
        isMaximized: data.isMaximized ?? false,
      };
    }
  } catch {
    // Fall through to defaults
  }
  return { width: 1400, height: 900, isMaximized: false };
}

function saveWindowState(win: BrowserWindow): void {
  if (win.isDestroyed()) return;

  const isMaximized = win.isMaximized();
  const bounds = isMaximized ? windowBounds.get(win) ?? win.getBounds() : win.getBounds();

  const state: WindowState = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized,
  };

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // Ignore write errors
  }
}

function isStateOnScreen(state: WindowState): boolean {
  if (state.x === undefined || state.y === undefined) return false;

  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const { x, y, width, height } = display.workArea;
    return (
      state.x! >= x - 50 &&
      state.y! >= y - 50 &&
      state.x! < x + width + 50 &&
      state.y! < y + height + 50
    );
  });
}

export function createMainWindow(): BrowserWindow {
  const state = loadWindowState();
  const isMac = process.platform === "darwin";

  // Validate position is on a visible display
  const position = isStateOnScreen(state) ? { x: state.x, y: state.y } : {};

  mainWindow = new BrowserWindow({
    ...position,
    width: state.width,
    height: state.height,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hidden",
    ...(isMac
      ? {
          trafficLightPosition: { x: 12, y: 10 },
        }
      : {
          titleBarOverlay: {
            color: "#09090b",
            symbolColor: "#a1a1aa",
            height: 36,
          },
        }),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
    show: false,
    backgroundColor: "#09090b",
    icon: getIconPath(),
  });

  // Show loading splash
  mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildSplashPage())}`
  );

  mainWindow.once("ready-to-show", () => {
    if (state.isMaximized) {
      mainWindow?.maximize();
    }
    mainWindow?.show();
  });

  // Track bounds for save-on-close (capture pre-maximize bounds)
  mainWindow.on("resize", () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      windowBounds.set(mainWindow, mainWindow.getBounds());
    }
  });
  mainWindow.on("move", () => {
    if (mainWindow && !mainWindow.isMaximized()) {
      windowBounds.set(mainWindow, mainWindow.getBounds());
    }
  });

  // Save state on close
  mainWindow.on("close", (e) => {
    if (mainWindow) {
      saveWindowState(mainWindow);
    }

    // macOS: hide to tray instead of quitting (unless app.quit() was called)
    if (process.platform === "darwin" && !forceQuit) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  // Handle external links — open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const { shell } = require("electron") as typeof import("electron");
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setForceQuit(value: boolean): void {
  forceQuit = value;
}

function buildSplashPage(): string {
  return `<!DOCTYPE html>
<html><head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         display: flex; align-items: center; justify-content: center; height: 100vh;
         margin: 0; background: #09090b; color: #a1a1aa; flex-direction: column;
         -webkit-app-region: drag; }
  .spinner { width: 32px; height: 32px; border: 3px solid #27272a; border-top-color: #6366f1;
             border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  p { font-size: 14px; opacity: 0.7; }
</style></head>
<body><div class="spinner"></div><p>Starting TitanClip...</p></body></html>`;
}
