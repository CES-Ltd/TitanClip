/**
 * IPC API Client — replaces the fetch-based HTTP client.
 *
 * Instead of:
 *   fetch("/api/companies/123/agents") → HTTP → Express → service → JSON → parse
 *
 * This does:
 *   window.electronAPI.invoke("agents:list", { companyId: "123" }) → IPC → service → result
 *
 * The client provides the same ergonomic API as the old fetch-based client,
 * but routes through Electron IPC instead of HTTP.
 *
 * During the transition period, this module detects whether we're running
 * in Electron (window.electronAPI exists) or in a browser, and falls back
 * to the fetch-based client if needed.
 */

import type { IpcChannelMap, IpcChannel, IpcArgs, IpcResult } from "@titanclip/shared";

// ── Type declarations for the Electron API bridge ────────────────────────

declare global {
  interface Window {
    electronAPI?: {
      invoke: <C extends IpcChannel>(channel: C, args: IpcArgs<C>) => Promise<IpcResult<C>>;
      getVersion: () => Promise<string>;
      getPlatform: () => string;
      openExternal: (url: string) => Promise<void>;
      showItemInFolder: (fullPath: string) => Promise<void>;
      openFileDialog: (options: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
      saveFileDialog: (options: any) => Promise<{ canceled: boolean; filePath: string }>;
      messageBox: (options: any) => Promise<{ response: number; checkboxChecked: boolean }>;
      showNotification: (opts: any) => Promise<void>;
      setTrayTooltip: (tooltip: string) => Promise<void>;
      setBadgeCount: (count: number) => Promise<void>;
      onNavigate: (callback: (path: string) => void) => () => void;
      onMenuAction: (callback: (action: string) => void) => () => void;
      onLiveEvent: (callback: (event: any) => void) => () => void;
      setTheme: (theme: "dark" | "light") => Promise<void>;
      navBack: () => Promise<void>;
      navForward: () => Promise<void>;
      navCanGoBack: () => Promise<boolean>;
      navCanGoForward: () => Promise<boolean>;
    };
  }
}

// ── Detection ────────────────────────────────────────────────────────────

/**
 * Whether we're running inside Electron with the IPC bridge available.
 */
export const isElectron = typeof window !== "undefined" && !!window.electronAPI?.invoke;

// ── IPC invoke wrapper ───────────────────────────────────────────────────

/**
 * Type-safe IPC invoke. Calls window.electronAPI.invoke with full type safety.
 *
 * Usage:
 *   const agents = await invoke("agents:list", { companyId: "abc" })
 *   //    ^? Agent[]
 */
export async function invoke<C extends IpcChannel>(
  channel: C,
  ...args: IpcArgs<C> extends void ? [] : [IpcArgs<C>]
): Promise<IpcResult<C>> {
  if (!window.electronAPI?.invoke) {
    throw new Error(
      `IPC not available. Channel "${channel}" called outside Electron context.`
    );
  }
  const channelArgs = args[0] as IpcArgs<C>;
  return window.electronAPI.invoke(channel, channelArgs);
}

// ── Fallback-aware client ────────────────────────────────────────────────

/**
 * Error class for IPC failures, matching the ApiError interface.
 */
export class IpcError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number = 500, body: unknown = null) {
    super(message);
    this.name = "IpcError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Hybrid client that uses IPC when available, falls back to fetch.
 * This allows gradual migration — routes can be switched one at a time.
 */
export function createHybridClient() {
  const httpBase = "/api";

  async function ipcOrFetch<T>(
    channel: IpcChannel,
    ipcArgs: any,
    httpFallback: () => Promise<T>,
  ): Promise<T> {
    if (isElectron) {
      try {
        return await invoke(channel, ipcArgs) as T;
      } catch (err: any) {
        // If the IPC channel isn't registered yet (Phase 2 migration in progress),
        // fall back to HTTP
        if (err?.message?.includes("No handler registered")) {
          console.warn(`[IPC] No handler for "${channel}", falling back to HTTP`);
          return httpFallback();
        }
        throw new IpcError(err?.message ?? "IPC call failed", 500, err);
      }
    }
    return httpFallback();
  }

  return { ipcOrFetch, invoke };
}

// Export a singleton hybrid client
export const hybridClient = createHybridClient();
