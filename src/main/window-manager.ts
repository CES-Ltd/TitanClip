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
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    height: 100vh; overflow: hidden;
    background: #1a1614; color: #e8ddd4;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    -webkit-app-region: drag;
  }

  /* ── Logo + Title ── */
  .brand { text-align: center; margin-bottom: 32px; animation: fadeIn 1.2s ease-out; }
  .brand h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin-top: 12px; color: #f0e6dc; }
  .brand p { font-size: 13px; color: #8a7e76; margin-top: 6px; }

  /* ── Loading bar ── */
  .loading-bar { width: 200px; height: 3px; background: #2a2320; border-radius: 2px; overflow: hidden; margin-top: 24px; }
  .loading-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #d4622a, #e8853a); border-radius: 2px; animation: fillBar 8s ease-out forwards; }

  /* ── Office floor ── */
  .office { position: absolute; bottom: 60px; width: 100%; height: 120px; overflow: hidden; }
  .floor { position: absolute; bottom: 0; width: 100%; height: 2px; background: linear-gradient(90deg, transparent 10%, #3a332e 30%, #3a332e 70%, transparent 90%); }
  .floor-grid { position: absolute; bottom: 2px; width: 100%; height: 40px; opacity: 0.06;
    background: repeating-linear-gradient(90deg, #e8853a 0px, #e8853a 1px, transparent 1px, transparent 80px); }

  /* ── Agent (person) sprites ── */
  .agent { position: absolute; bottom: 4px; display: flex; flex-direction: column; align-items: center; }
  .head { width: 10px; height: 10px; border-radius: 50%; }
  .body { width: 8px; height: 14px; border-radius: 3px 3px 1px 1px; margin-top: 1px; }
  .legs { display: flex; gap: 2px; margin-top: 1px; }
  .leg { width: 3px; height: 8px; border-radius: 1px; }
  .item { font-size: 8px; position: absolute; top: -6px; }

  /* Agent colors */
  .a1 .head { background: #e8853a; } .a1 .body { background: #d4622a; } .a1 .leg { background: #b5501f; }
  .a2 .head { background: #6ba3d6; } .a2 .body { background: #4a8bc4; } .a2 .leg { background: #3a7ab0; }
  .a3 .head { background: #7cc47a; } .a3 .body { background: #5aaa58; } .a3 .leg { background: #489046; }
  .a4 .head { background: #c89be8; } .a4 .body { background: #a87ad0; } .a4 .leg { background: #9060b8; }
  .a5 .head { background: #e8c44a; } .a5 .body { background: #d4a830; } .a5 .leg { background: #b89020; }
  .a6 .head { background: #e87070; } .a6 .body { background: #d45050; } .a6 .leg { background: #b83a3a; }

  /* Walking animations — each agent has unique speed/direction */
  .agent { animation-timing-function: linear; animation-iteration-count: infinite; }
  .w1 { animation: walkRight 6s linear infinite; }
  .w2 { animation: walkLeft 8s linear infinite; animation-delay: -2s; }
  .w3 { animation: walkRight 10s linear infinite; animation-delay: -4s; }
  .w4 { animation: walkLeft 7s linear infinite; animation-delay: -1s; }
  .w5 { animation: walkRight 9s linear infinite; animation-delay: -5s; }
  .w6 { animation: walkLeft 5.5s linear infinite; animation-delay: -3s; }

  /* Leg animation for walking effect */
  .agent .legs { animation: step 0.4s ease-in-out infinite alternate; }

  /* ── Desk sprites ── */
  .desk { position: absolute; bottom: 2px; width: 30px; height: 18px; background: #2a2320; border-radius: 3px 3px 0 0; border: 1px solid #3a332e; border-bottom: none; }
  .monitor { position: absolute; top: -10px; left: 8px; width: 14px; height: 10px; background: #1e1a18; border: 1px solid #3a332e; border-radius: 2px; }
  .monitor::after { content: ''; position: absolute; top: 2px; left: 2px; width: 8px; height: 4px; background: #2a4a3a; border-radius: 1px; }

  @keyframes walkRight { 0% { left: -20px; } 100% { left: calc(100% + 20px); } }
  @keyframes walkLeft { 0% { left: calc(100% + 20px); } 100% { left: -20px; } }
  @keyframes step { 0% { transform: skewX(-8deg); } 100% { transform: skewX(8deg); } }
  @keyframes fadeIn { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }
  @keyframes fillBar { 0% { width: 0%; } 100% { width: 100%; } }
  @keyframes fadeOut { 0% { opacity: 1; } 100% { opacity: 0; } }

  /* Auto fade-out after 8s */
  body { animation: fadeOut 0.8s ease-in 7.2s forwards; }
</style></head>
<body>
  <div class="brand">
    <div style="font-size: 48px;">&#x1F9DE;</div>
    <h1>TitanClip</h1>
    <p>Preparing your AI team...</p>
    <div class="loading-bar"><div class="loading-fill"></div></div>
  </div>

  <div class="office">
    <!-- Desks -->
    <div class="desk" style="left: 15%;"><div class="monitor"></div></div>
    <div class="desk" style="left: 40%;"><div class="monitor"></div></div>
    <div class="desk" style="left: 65%;"><div class="monitor"></div></div>
    <div class="desk" style="left: 85%;"><div class="monitor"></div></div>

    <!-- Walking agents -->
    <div class="agent a1 w1"><span class="item">&#128196;</span><div class="head"></div><div class="body"></div><div class="legs"><div class="leg"></div><div class="leg"></div></div></div>
    <div class="agent a2 w2"><span class="item">&#128187;</span><div class="head"></div><div class="body"></div><div class="legs"><div class="leg"></div><div class="leg"></div></div></div>
    <div class="agent a3 w3"><div class="head"></div><div class="body"></div><div class="legs"><div class="leg"></div><div class="leg"></div></div></div>
    <div class="agent a4 w4"><span class="item">&#128203;</span><div class="head"></div><div class="body"></div><div class="legs"><div class="leg"></div><div class="leg"></div></div></div>
    <div class="agent a5 w5"><div class="head"></div><div class="body"></div><div class="legs"><div class="leg"></div><div class="leg"></div></div></div>
    <div class="agent a6 w6"><span class="item">&#9997;</span><div class="head"></div><div class="body"></div><div class="legs"><div class="leg"></div><div class="leg"></div></div></div>

    <div class="floor-grid"></div>
    <div class="floor"></div>
  </div>
</body></html>`;
}
