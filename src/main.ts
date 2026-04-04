import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import http from "http";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const SERVER_PORT = 3100;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: "#09090b",
    icon: path.join(__dirname, "../assets/logo.png"),
  });

  // Show loading splash
  mainWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         display: flex; align-items: center; justify-content: center; height: 100vh;
         margin: 0; background: #09090b; color: #a1a1aa; flex-direction: column; }
  .spinner { width: 32px; height: 32px; border: 3px solid #27272a; border-top-color: #6366f1;
             border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  p { font-size: 14px; opacity: 0.7; }
</style></head>
<body><div class="spinner"></div><p>Starting TitanClip...</p></body></html>`)}`
  );

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function waitForServer(port: number, timeoutMs = 120000): Promise<void> {
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

function startServer(): void {
  // Use tsx to run the server in dev mode (handles TypeScript workspace imports)
  const serverEntry = path.join(__dirname, "../server/src/index.ts");
  const tsxBin = path.join(__dirname, "../server/node_modules/.bin/tsx");
  console.log("[TitanClip] Starting server from:", serverEntry);

  serverProcess = spawn(tsxBin, [serverEntry], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
      HOST: "127.0.0.1",
      SERVE_UI: "true",
      TITANCLIP_ELECTRON: "1",
      TITANCLIP_MIGRATION_AUTO_APPLY: "true",
      TITANCLIP_MIGRATION_PROMPT: "never",
      TITANCLIP_DEPLOYMENT_MODE: "local_trusted",
      TITANCLIP_OPEN_ON_LISTEN: "false",
    },
  });

  serverProcess.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(`[server] ${data}`);
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(`[server] ${data}`);
  });

  serverProcess.on("error", (err) => {
    console.error("[TitanClip] Server failed to start:", err);
  });

  serverProcess.on("exit", (code) => {
    console.log("[TitanClip] Server exited with code:", code);
    serverProcess = null;
  });
}

function stopServer(): void {
  if (serverProcess) {
    console.log("[TitanClip] Stopping server...");
    serverProcess.kill();
    serverProcess = null;
  }
}

// IPC handlers
ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("get-platform", () => process.platform);
ipcMain.handle("open-external", async (_event, url: string) => {
  await shell.openExternal(url);
});

// App lifecycle
app.whenReady().then(async () => {
  createWindow();

  try {
    startServer();
    console.log("[TitanClip] Waiting for server to be ready...");
    await waitForServer(SERVER_PORT);
    console.log("[TitanClip] Server ready, loading UI...");

    if (mainWindow) {
      mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`);
    }
  } catch (err) {
    console.error("[TitanClip] Startup failed:", err);
    if (mainWindow) {
      mainWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         display: flex; align-items: center; justify-content: center; height: 100vh;
         margin: 0; background: #09090b; color: #ef4444; flex-direction: column; padding: 40px; }
  h2 { margin-bottom: 8px; color: #fca5a5; }
  pre { background: #1c1917; padding: 16px; border-radius: 8px; max-width: 600px;
        overflow-x: auto; font-size: 13px; color: #a1a1aa; }
</style></head>
<body><h2>Failed to start TitanClip</h2><pre>${String(err)}</pre></body></html>`)}`
      );
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopServer();
});

process.on("uncaughtException", (error) => {
  console.error("[TitanClip] Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[TitanClip] Unhandled Rejection:", reason);
});
