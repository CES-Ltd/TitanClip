/**
 * Preload Script — Secure bridge between main process and renderer.
 *
 * Exposes a typed `window.electronAPI` object via contextBridge.
 * All communication uses ipcRenderer.invoke() (request/response)
 * or ipcRenderer.on() (push events from main).
 *
 * Security: contextIsolation=true, nodeIntegration=false.
 * The renderer has zero access to Node.js APIs — only what's exposed here.
 */

import { contextBridge, ipcRenderer } from "electron";

// ── Types for the exposed API ───────────────────────────────────────────

export interface ElectronAPI {
  // App info
  getVersion: () => Promise<string>;
  getPlatform: () => string;
  getLocale: () => Promise<string>;
  getPath: (name: string) => Promise<string>;
  quit: () => Promise<void>;

  // Shell
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (fullPath: string) => Promise<void>;

  // Navigation (WebContents history)
  navBack: () => Promise<void>;
  navForward: () => Promise<void>;
  navCanGoBack: () => Promise<boolean>;
  navCanGoForward: () => Promise<boolean>;

  // Theme
  setTheme: (theme: "dark" | "light") => Promise<void>;

  // Native dialogs
  openFileDialog: (options: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
  saveFileDialog: (options: any) => Promise<{ canceled: boolean; filePath: string }>;
  messageBox: (options: any) => Promise<{ response: number; checkboxChecked: boolean }>;

  // Notifications
  showNotification: (opts: {
    title: string;
    body: string;
    navigateTo?: string;
    urgency?: "low" | "normal" | "critical";
  }) => Promise<void>;

  // Tray & Badge
  setTrayTooltip: (tooltip: string) => Promise<void>;
  setBadgeCount: (count: number) => Promise<void>;

  // Window controls
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
  closeWindow: () => Promise<void>;

  // Clipboard
  clipboardReadText: () => Promise<string>;
  clipboardWriteText: (text: string) => Promise<void>;
  clipboardReadHtml: () => Promise<string>;
  clipboardWriteHtml: (html: string, plainText?: string) => Promise<void>;
  clipboardHasImage: () => Promise<boolean>;
  clipboardReadImage: () => Promise<{ dataUrl: string; size: { width: number; height: number }; buffer: Buffer } | null>;
  clipboardWriteRich: (content: { text?: string; html?: string; markdown?: string }) => Promise<void>;
  clipboardCopyIssueMarkdown: (issue: { identifier?: string; title: string; status: string; priority: string; description?: string; assignee?: string }) => Promise<void>;
  clipboardCopyAgentConfig: (config: Record<string, unknown>) => Promise<void>;

  // Drag & drop
  startDrag: (data: { type: string; content: string; filename: string }) => Promise<void>;
  dragAgentConfig: (agent: { name: string; config: Record<string, unknown> }) => Promise<void>;
  dragIssueDetails: (issue: { identifier?: string; title: string; description?: string; status: string; priority: string }) => Promise<void>;

  // Context menu
  showContextMenu: (items: Array<{ id: string; label: string; enabled?: boolean }>) => Promise<string | null>;

  // Dock/taskbar progress
  setDockProgress: (progress: number, mode?: string) => Promise<void>;
  setActiveRuns: (count: number) => Promise<void>;
  clearDockProgress: () => Promise<void>;

  // Event listeners (main → renderer push)
  onNavigate: (callback: (path: string) => void) => () => void;
  onMenuAction: (callback: (action: string) => void) => () => void;
  onLiveEvent: (callback: (event: any) => void) => () => void;
  onUpdaterDownloading: (callback: (version: string) => void) => () => void;
}

// ── Expose API ──────────────────────────────────────────────────────────

const electronAPI: ElectronAPI = {
  // App info
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  getPlatform: () => process.platform,
  getLocale: () => ipcRenderer.invoke("app:get-locale"),
  getPath: (name: string) => ipcRenderer.invoke("app:get-path", name),
  quit: () => ipcRenderer.invoke("app:quit"),

  // Shell
  openExternal: (url: string) => ipcRenderer.invoke("shell:open-external", url),
  showItemInFolder: (fullPath: string) => ipcRenderer.invoke("shell:show-item-in-folder", fullPath),

  // Navigation
  navBack: () => ipcRenderer.invoke("nav:back"),
  navForward: () => ipcRenderer.invoke("nav:forward"),
  navCanGoBack: () => ipcRenderer.invoke("nav:can-go-back"),
  navCanGoForward: () => ipcRenderer.invoke("nav:can-go-forward"),

  // Theme
  setTheme: (theme: "dark" | "light") => ipcRenderer.invoke("theme:set", theme),

  // Native dialogs
  openFileDialog: (options: any) => ipcRenderer.invoke("dialog:open-file", options),
  saveFileDialog: (options: any) => ipcRenderer.invoke("dialog:save-file", options),
  messageBox: (options: any) => ipcRenderer.invoke("dialog:message-box", options),

  // Notifications
  showNotification: (opts) => ipcRenderer.invoke("notification:show", opts),

  // Tray & Badge
  setTrayTooltip: (tooltip: string) => ipcRenderer.invoke("tray:set-tooltip", tooltip),
  setBadgeCount: (count: number) => ipcRenderer.invoke("tray:set-badge", count),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window:maximize"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  isFullscreen: () => ipcRenderer.invoke("window:is-fullscreen"),
  closeWindow: () => ipcRenderer.invoke("window:close"),

  // Clipboard
  clipboardReadText: () => ipcRenderer.invoke("clipboard:read-text"),
  clipboardWriteText: (text: string) => ipcRenderer.invoke("clipboard:write-text", text),
  clipboardReadHtml: () => ipcRenderer.invoke("clipboard:read-html"),
  clipboardWriteHtml: (html: string, plainText?: string) =>
    ipcRenderer.invoke("clipboard:write-html", html, plainText),
  clipboardHasImage: () => ipcRenderer.invoke("clipboard:has-image"),
  clipboardReadImage: () => ipcRenderer.invoke("clipboard:read-image"),
  clipboardWriteRich: (content) => ipcRenderer.invoke("clipboard:write-rich", content),
  clipboardCopyIssueMarkdown: (issue) =>
    ipcRenderer.invoke("clipboard:copy-issue-markdown", issue),
  clipboardCopyAgentConfig: (config) =>
    ipcRenderer.invoke("clipboard:copy-agent-config", config),

  // Drag & drop
  startDrag: (data) => ipcRenderer.invoke("drag:start-drag", data),
  dragAgentConfig: (agent) => ipcRenderer.invoke("drag:agent-config", agent),
  dragIssueDetails: (issue) => ipcRenderer.invoke("drag:issue-details", issue),

  // Context menu
  showContextMenu: (items) => ipcRenderer.invoke("context-menu:show", items),

  // Dock/taskbar progress
  setDockProgress: (progress: number, mode?: string) =>
    ipcRenderer.invoke("dock:set-progress", progress, mode),
  setActiveRuns: (count: number) => ipcRenderer.invoke("dock:set-active-runs", count),
  clearDockProgress: () => ipcRenderer.invoke("dock:clear-progress"),

  // Event listeners (main → renderer push)
  onNavigate: (callback) => {
    const handler = (_event: any, path: string) => callback(path);
    ipcRenderer.on("menu:navigate", handler);
    return () => ipcRenderer.removeListener("menu:navigate", handler);
  },
  onMenuAction: (callback) => {
    const handler = (_event: any, action: string) => callback(action);
    ipcRenderer.on("menu:action", handler);
    return () => ipcRenderer.removeListener("menu:action", handler);
  },
  onLiveEvent: (callback) => {
    const handler = (_event: any, event: any) => callback(event);
    ipcRenderer.on("live:event", handler);
    return () => ipcRenderer.removeListener("live:event", handler);
  },
  onUpdaterDownloading: (callback) => {
    const handler = (_event: any, version: string) => callback(version);
    ipcRenderer.on("updater:downloading", handler);
    return () => ipcRenderer.removeListener("updater:downloading", handler);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// ── Legacy compatibility layer ──────────────────────────────────────────
// Maps old channel names to new ones so the existing UI doesn't break
// during the transition. Remove after Phase 2 migration.
contextBridge.exposeInMainWorld("electronAPILegacy", {
  getVersion: () => ipcRenderer.invoke("get-app-version"),
  getPlatform: () => process.platform,
  navBack: () => ipcRenderer.invoke("nav-back"),
  navForward: () => ipcRenderer.invoke("nav-forward"),
  navCanGoBack: () => ipcRenderer.invoke("nav-can-go-back"),
  navCanGoForward: () => ipcRenderer.invoke("nav-can-go-forward"),
  setTheme: (theme: string) => ipcRenderer.invoke("set-theme", theme),
});
