/**
 * Global Shortcuts — system-wide keyboard shortcuts that work even when
 * the TitanClip window is not focused.
 *
 * Registered shortcuts:
 *   CmdOrCtrl+Shift+T  — Quick issue capture (shows a mini-window)
 *   CmdOrCtrl+Shift+P  — Show/hide TitanClip window
 */

import { globalShortcut, BrowserWindow, BrowserWindow as BW, ipcMain } from "electron";
import { getMainWindow } from "./window-manager.js";
import { getPreloadPath } from "./paths.js";

let quickCaptureWindow: BrowserWindow | null = null;

/**
 * Register all global keyboard shortcuts.
 * Should be called after app.whenReady().
 */
export function registerGlobalShortcuts(): void {
  // Quick issue capture — system-wide shortcut
  const captureOk = globalShortcut.register("CmdOrCtrl+Shift+T", () => {
    showQuickCapture();
  });
  if (!captureOk) console.warn("[TitanClip] Failed to register Cmd+Shift+T (may be in use by another app)");

  // Toggle main window visibility
  const toggleOk = globalShortcut.register("CmdOrCtrl+Shift+P", () => {
    const win = getMainWindow();
    if (!win) return;

    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
  if (!toggleOk) console.warn("[TitanClip] Failed to register Cmd+Shift+P (may be in use by another app)");

  // Register IPC handler for quick capture issue creation
  ipcMain.handle("quick-capture:create-issue", async (_event, data: { title: string; description: string | null }) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("menu:action", "quick-capture-issue");
      win.webContents.send("quick-capture:data", data);
      win.show();
      win.focus();
    }
    return { ok: true };
  });

  console.log("[TitanClip] Global shortcuts registered");
}

/**
 * Unregister all global shortcuts. Called on app quit.
 */
export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}

/**
 * Show the quick issue capture mini-window.
 * A small, always-on-top window for rapidly creating issues
 * from anywhere on the desktop.
 */
function showQuickCapture(): void {
  const mainWindow = getMainWindow();

  // If quick capture window already exists, focus it
  if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
    quickCaptureWindow.focus();
    return;
  }

  // If main window doesn't exist yet, just show it
  if (!mainWindow) return;

  quickCaptureWindow = new BW({
    width: 500,
    height: 280,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    frame: false,
    transparent: false,
    backgroundColor: "#09090b",
    show: false,
    parent: mainWindow,
    modal: false,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load inline quick-capture UI
  quickCaptureWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildQuickCaptureHtml())}`
  );

  quickCaptureWindow.once("ready-to-show", () => {
    quickCaptureWindow?.show();
    quickCaptureWindow?.focus();
  });

  // Close on blur (click away)
  quickCaptureWindow.on("blur", () => {
    // Small delay to allow button clicks to register
    setTimeout(() => {
      if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
        quickCaptureWindow.close();
      }
    }, 150);
  });

  quickCaptureWindow.on("closed", () => {
    quickCaptureWindow = null;
  });

  // Close on Escape
  quickCaptureWindow.webContents.on("before-input-event", (_, input) => {
    if (input.key === "Escape") {
      quickCaptureWindow?.close();
    }
  });
}

function buildQuickCaptureHtml(): string {
  return `<!DOCTYPE html>
<html><head><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #09090b; color: #fafafa; padding: 16px;
    -webkit-app-region: drag;
    height: 100vh; display: flex; flex-direction: column;
  }
  h3 { font-size: 13px; color: #a1a1aa; margin-bottom: 12px; font-weight: 500; }
  input, textarea {
    -webkit-app-region: no-drag;
    width: 100%; background: #18181b; border: 1px solid #27272a;
    border-radius: 6px; color: #fafafa; padding: 8px 12px;
    font-size: 14px; font-family: inherit; outline: none;
    transition: border-color 0.15s;
  }
  input:focus, textarea:focus { border-color: #6366f1; }
  input { margin-bottom: 8px; }
  textarea { flex: 1; resize: none; min-height: 80px; margin-bottom: 12px; }
  .actions {
    -webkit-app-region: no-drag;
    display: flex; gap: 8px; justify-content: flex-end;
  }
  button {
    padding: 6px 16px; border-radius: 6px; border: none;
    font-size: 13px; font-weight: 500; cursor: pointer;
    transition: opacity 0.15s;
  }
  button:hover { opacity: 0.85; }
  .btn-cancel { background: #27272a; color: #a1a1aa; }
  .btn-create { background: #6366f1; color: #fff; }
  .hint { font-size: 11px; color: #52525b; margin-top: 4px; text-align: center; }
</style></head>
<body>
  <h3>Quick Issue Capture</h3>
  <input id="title" placeholder="Issue title..." autofocus />
  <textarea id="desc" placeholder="Description (optional)..."></textarea>
  <div class="actions">
    <button class="btn-cancel" onclick="window.close()">Cancel</button>
    <button class="btn-create" id="createBtn">Create Issue</button>
  </div>
  <p class="hint">Press Escape to close</p>
  <script>
    const titleEl = document.getElementById('title');
    const descEl = document.getElementById('desc');
    const createBtn = document.getElementById('createBtn');

    createBtn.addEventListener('click', () => {
      const title = titleEl.value.trim();
      if (!title) { titleEl.focus(); return; }
      // Send to main window via IPC
      if (window.electronAPI) {
        window.electronAPI.invoke('quick-capture:create-issue', {
          title,
          description: descEl.value.trim() || null,
        });
      }
      window.close();
    });

    // Submit on Cmd/Ctrl+Enter
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        createBtn.click();
      }
    });
  </script>
</body></html>`;
}
