import { app } from "electron";
import { getMainWindow } from "./window-manager.js";

const PROTOCOL = "titanclip";

/**
 * Register TitanClip as the handler for titanclip:// URLs.
 * Must be called before app.whenReady().
 */
export function registerDeepLinkProtocol(): void {
  if (process.defaultApp) {
    // In development, register with the path to electron + script
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

/**
 * Handle an incoming deep link URL.
 *
 * Supported formats:
 *   titanclip://agents/{agentId}
 *   titanclip://issues/{issueId}
 *   titanclip://projects/{projectId}
 *   titanclip://approvals/{approvalId}
 *   titanclip://dashboard
 *   titanclip://settings
 */
export function handleDeepLink(url: string): void {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${PROTOCOL}:`) return;

    // Convert titanclip://agents/abc123 → /agents/abc123
    const path = `/${parsed.hostname}${parsed.pathname}`.replace(/\/+$/, "");

    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("menu:navigate", path);

    console.log(`[TitanClip] Deep link navigated to: ${path}`);
  } catch (err) {
    console.error("[TitanClip] Failed to parse deep link:", url, err);
  }
}

import path from "path";
