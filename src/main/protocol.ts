/**
 * Custom Protocol — serves UI assets via app:// protocol in production.
 *
 * In production, the UI is loaded from bundled files instead of localhost.
 * Using a custom protocol (app://) instead of file:// solves:
 *   - Proper path resolution for SPA routing (all routes → index.html)
 *   - Correct MIME types for all asset types
 *   - Security (custom protocol can be restricted)
 *   - No CORS issues with local files
 *
 * In development, the UI is loaded from the Vite dev server (localhost:5173)
 * so this module is a no-op.
 */

import { app, protocol, net } from "electron";
import path from "path";
import { existsSync } from "fs";
import { getUiDistPath } from "./paths.js";

const PROTOCOL_NAME = "app";

/**
 * Register the custom app:// protocol.
 * Must be called before app.whenReady() for security scheme registration.
 */
export function registerAppProtocol(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PROTOCOL_NAME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: false,
        stream: true,
      },
    },
  ]);
}

/**
 * Set up the protocol handler to serve UI files.
 * Must be called after app.whenReady().
 */
export function setupProtocolHandler(): void {
  if (app.isPackaged) {
    setupProductionProtocol();
  }
  // In dev mode, no custom protocol needed — Vite dev server handles it
}

function setupProductionProtocol(): void {
  const uiDistPath = getUiDistPath();

  protocol.handle(PROTOCOL_NAME, (request) => {
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);

    // Remove leading slash on Windows
    if (process.platform === "win32" && filePath.startsWith("/")) {
      filePath = filePath.slice(1);
    }

    // Resolve the file path relative to ui-dist
    let fullPath = path.join(uiDistPath, filePath);

    // SPA fallback: if the file doesn't exist (client-side route), serve index.html
    if (!existsSync(fullPath) || filePath === "/" || filePath === "") {
      // Check if it's an asset request (has a file extension)
      const ext = path.extname(filePath);
      if (!ext || ext === ".html") {
        fullPath = path.join(uiDistPath, "index.html");
      }
    }

    // Serve the file using net.fetch for proper MIME type handling
    return net.fetch(`file://${fullPath}`);
  });
}

/**
 * Get the URL to load for the main window.
 *
 * Production: app://./index.html (custom protocol)
 * Development: http://localhost:5173 (Vite dev server)
 * Fallback: http://localhost:3100 (Express server, legacy mode)
 */
export function getUIUrl(mode: "native" | "server"): string {
  if (!app.isPackaged) {
    // Development
    if (mode === "native") {
      return "http://localhost:5173";
    }
    // Server mode dev — use Express which serves Vite
    return "http://127.0.0.1:3100";
  }

  // Production
  if (mode === "native") {
    return `${PROTOCOL_NAME}://./index.html`;
  }
  // Server mode production — still use Express
  return "http://127.0.0.1:3100";
}
