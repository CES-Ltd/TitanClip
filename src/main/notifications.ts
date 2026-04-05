import { Notification, BrowserWindow } from "electron";
import { getMainWindow } from "./window-manager.js";

export interface TitanClipNotification {
  title: string;
  body: string;
  /** Navigation path to open when notification is clicked */
  navigateTo?: string;
  /** Urgency level for Linux; maps to macOS sound */
  urgency?: "low" | "normal" | "critical";
}

/**
 * Show a native OS notification.
 * On click, navigates the main window to the specified path.
 */
export function showNotification(
  mainWindow: BrowserWindow,
  opts: TitanClipNotification
): void {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: opts.title,
    body: opts.body,
    silent: opts.urgency === "low",
    urgency: opts.urgency ?? "normal",
  });

  notification.on("click", () => {
    // Re-resolve window in case it was destroyed and recreated
    const win = getMainWindow() ?? mainWindow;
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
      if (opts.navigateTo) {
        win.webContents.send("menu:navigate", opts.navigateTo);
      }
    }
  });

  notification.show();
}

/**
 * Notify that an agent has completed a task.
 */
export function notifyAgentCompleted(
  mainWindow: BrowserWindow,
  agentName: string,
  issueTitle: string,
  issueId: string
): void {
  showNotification(mainWindow, {
    title: `${agentName} completed a task`,
    body: issueTitle,
    navigateTo: `/issues/${issueId}`,
  });
}

/**
 * Notify that an approval is pending.
 */
export function notifyApprovalRequired(
  mainWindow: BrowserWindow,
  agentName: string,
  approvalId: string
): void {
  showNotification(mainWindow, {
    title: "Approval Required",
    body: `${agentName} is waiting for your approval`,
    navigateTo: `/approvals/${approvalId}`,
    urgency: "normal",
  });
}

/**
 * Notify about a budget threshold breach.
 */
export function notifyBudgetAlert(
  mainWindow: BrowserWindow,
  policyName: string,
  currentSpend: string
): void {
  showNotification(mainWindow, {
    title: "Budget Alert",
    body: `${policyName}: Spend has reached ${currentSpend}`,
    navigateTo: "/costs",
    urgency: "critical",
  });
}

/**
 * Notify about an agent error.
 */
export function notifyAgentError(
  mainWindow: BrowserWindow,
  agentName: string,
  errorMessage: string,
  issueId?: string
): void {
  showNotification(mainWindow, {
    title: `${agentName} encountered an error`,
    body: errorMessage,
    navigateTo: issueId ? `/issues/${issueId}` : "/agents",
    urgency: "critical",
  });
}
