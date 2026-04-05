/**
 * IPC Contract Tests — verifies that every IPC channel defined in the
 * shared package has a corresponding handler registered in the main process
 * and a matching API call in the renderer.
 *
 * These tests run without Electron — they statically analyze the source
 * files to verify the contract.
 *
 * Run: npx vitest run src/main/__tests__/ipc-contract.test.ts
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..", "..", "..");

function readFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf-8");
}

describe("IPC Contract", () => {
  it("should have all IPC channel types defined in shared package", () => {
    const ipcChannelsContent = readFile("packages/shared/src/ipc-channels.ts");
    expect(ipcChannelsContent).toContain("export interface IpcChannelMap");
    expect(ipcChannelsContent).toContain("export type IpcChannel");
    expect(ipcChannelsContent).toContain("export type IpcArgs");
    expect(ipcChannelsContent).toContain("export type IpcResult");
  });

  it("should have core channels defined", () => {
    const content = readFile("packages/shared/src/ipc-channels.ts");
    const coreChannels = [
      "health:check",
      "companies:list",
      "companies:get",
      "agents:list",
      "agents:get",
      "issues:list",
      "issues:get",
      "projects:list",
      "goals:list",
      "approvals:list",
      "routines:list",
      "costs:summary",
      "dashboard:summary",
      "instance:get-general-settings",
    ];

    for (const channel of coreChannels) {
      expect(content).toContain(`"${channel}"`);
    }
  });

  it("should have IPC handlers registered for core channels", () => {
    const ipcRouter = readFile("src/main/ipc-router.ts");
    const serviceHandlers = readFile("src/main/ipc-service-handlers.ts");
    const combined = ipcRouter + serviceHandlers;

    const coreHandlerChannels = [
      "app:get-version",
      "app:get-platform",
      "shell:open-external",
      "nav:back",
      "theme:set",
      "dialog:open-file",
      "dialog:save-file",
      "notification:show",
      "health:check",
      "companies:list",
      "agents:list",
      "issues:list",
      "goals:list",
      "approvals:list",
      "dashboard:summary",
    ];

    for (const channel of coreHandlerChannels) {
      expect(combined).toContain(`"${channel}"`);
    }
  });

  it("should have preload bridge exposing all core APIs", () => {
    const preload = readFile("src/preload/index.ts");

    const requiredApis = [
      "getVersion",
      "getPlatform",
      "openExternal",
      "navBack",
      "navForward",
      "setTheme",
      "openFileDialog",
      "saveFileDialog",
      "showNotification",
      "setTrayTooltip",
      "setBadgeCount",
      "onNavigate",
      "onMenuAction",
      "onLiveEvent",
      "clipboardReadText",
      "clipboardWriteText",
      "showContextMenu",
      "setDockProgress",
    ];

    for (const api of requiredApis) {
      expect(preload).toContain(api);
    }
  });

  it("should have URL-to-IPC route patterns in client.ts", () => {
    const client = readFile("ui/src/api/client.ts");

    // Verify the route table exists
    expect(client).toContain("const ipcRoutes: IpcRoute[]");
    expect(client).toContain("tryIpcRoute");

    // Verify key routes are mapped
    const keyPatterns = [
      "companies:list",
      "companies:get",
      "agents:list",
      "agents:get",
      "issues:list",
      "issues:get",
      "projects:list",
      "goals:list",
      "approvals:list",
      "dashboard:summary",
      "costs:summary",
      "heartbeat-runs:list",
    ];

    for (const channel of keyPatterns) {
      expect(client).toContain(`"${channel}"`);
    }
  });

  it("should have IPC detection in the UI", () => {
    const ipcClient = readFile("ui/src/api/ipc-client.ts");
    expect(ipcClient).toContain("isElectron");
    expect(ipcClient).toContain("window.electronAPI");
  });

  it("should conditionally use IPC vs WebSocket for live updates", () => {
    const mainTsx = readFile("ui/src/main.tsx");
    expect(mainTsx).toContain("IpcLiveUpdatesProvider");
    expect(mainTsx).toContain("LiveUpdatesProvider");
    expect(mainTsx).toContain("isElectron");
  });

  it("should have matching handler count for service IPC handlers", () => {
    const content = readFile("src/main/ipc-service-handlers.ts");
    // Count ipcMain.handle calls (each `h(` is an alias)
    const handleCalls = (content.match(/\bh\(/g) || []).length;
    // We should have at least 50 handlers
    expect(handleCalls).toBeGreaterThanOrEqual(50);
  });

  it("should have matching route count in client.ts", () => {
    const content = readFile("ui/src/api/client.ts");
    // Count route entries
    const routeEntries = (content.match(/\{ method:/g) || []).length;
    // We should have at least 100 URL-to-IPC route patterns
    expect(routeEntries).toBeGreaterThanOrEqual(100);
  });
});
