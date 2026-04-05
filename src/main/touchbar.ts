/**
 * Touch Bar — macOS Touch Bar integration.
 *
 * Displays contextual controls on the MacBook Pro Touch Bar:
 *   - Agent status indicators
 *   - Quick navigation buttons
 *   - Approval action buttons (when viewing approvals)
 *
 * Only active on macOS. No-op on other platforms.
 */

import { TouchBar, BrowserWindow } from "electron";

const {
  TouchBarButton,
  TouchBarSpacer,
  TouchBarLabel,
  TouchBarSegmentedControl,
} = TouchBar;

/**
 * Set up the default Touch Bar for the main window.
 */
export function setupTouchBar(mainWindow: BrowserWindow): void {
  if (process.platform !== "darwin") return;

  const touchBar = buildDefaultTouchBar(mainWindow);
  mainWindow.setTouchBar(touchBar);
}

/**
 * Update the Touch Bar to show contextual controls based on the current view.
 */
export function updateTouchBar(
  mainWindow: BrowserWindow,
  context: TouchBarContext
): void {
  if (process.platform !== "darwin") return;

  let touchBar: TouchBar;

  switch (context.view) {
    case "approvals":
      touchBar = buildApprovalTouchBar(mainWindow, context);
      break;
    case "agents":
      touchBar = buildAgentsTouchBar(mainWindow, context);
      break;
    default:
      touchBar = buildDefaultTouchBar(mainWindow);
      break;
  }

  mainWindow.setTouchBar(touchBar);
}

export interface TouchBarContext {
  view: "dashboard" | "agents" | "issues" | "approvals" | "other";
  agentCount?: number;
  activeRunCount?: number;
  pendingApprovals?: number;
}

// ── Touch Bar Builders ──────────────────────────────────────────────────

function buildDefaultTouchBar(win: BrowserWindow): TouchBar {
  const dashboardBtn = new TouchBarButton({
    label: "Dashboard",
    click: () => win.webContents.send("menu:navigate", "/dashboard"),
  });

  const agentsBtn = new TouchBarButton({
    label: "Agents",
    click: () => win.webContents.send("menu:navigate", "/agents"),
  });

  const issuesBtn = new TouchBarButton({
    label: "Issues",
    click: () => win.webContents.send("menu:navigate", "/issues"),
  });

  const costsBtn = new TouchBarButton({
    label: "Costs",
    click: () => win.webContents.send("menu:navigate", "/costs"),
  });

  const cmdPaletteBtn = new TouchBarButton({
    label: "\u2318K",
    click: () => win.webContents.send("menu:action", "open-command-palette"),
  });

  return new TouchBar({
    items: [
      dashboardBtn,
      agentsBtn,
      issuesBtn,
      costsBtn,
      new TouchBarSpacer({ size: "flexible" }),
      cmdPaletteBtn,
    ],
  });
}

function buildApprovalTouchBar(
  win: BrowserWindow,
  context: TouchBarContext
): TouchBar {
  const backBtn = new TouchBarButton({
    label: "\u2190 Back",
    click: () => win.webContents.send("menu:navigate", "/approvals"),
  });

  const approveBtn = new TouchBarButton({
    label: "\u2705 Approve",
    backgroundColor: "#16a34a",
    click: () => win.webContents.send("menu:action", "approval-approve"),
  });

  const rejectBtn = new TouchBarButton({
    label: "\u274c Reject",
    backgroundColor: "#dc2626",
    click: () => win.webContents.send("menu:action", "approval-reject"),
  });

  const pendingLabel = new TouchBarLabel({
    label: context.pendingApprovals
      ? `${context.pendingApprovals} pending`
      : "",
    textColor: "#a1a1aa",
  });

  return new TouchBar({
    items: [
      backBtn,
      new TouchBarSpacer({ size: "small" }),
      approveBtn,
      rejectBtn,
      new TouchBarSpacer({ size: "flexible" }),
      pendingLabel,
    ],
  });
}

function buildAgentsTouchBar(
  win: BrowserWindow,
  context: TouchBarContext
): TouchBar {
  const newAgentBtn = new TouchBarButton({
    label: "+ New Agent",
    click: () => win.webContents.send("menu:navigate", "/agents/new"),
  });

  const statusLabel = new TouchBarLabel({
    label: [
      context.agentCount !== undefined ? `${context.agentCount} agents` : "",
      context.activeRunCount !== undefined
        ? `${context.activeRunCount} active`
        : "",
    ]
      .filter(Boolean)
      .join(" \u00B7 "),
    textColor: "#a1a1aa",
  });

  return new TouchBar({
    items: [
      newAgentBtn,
      new TouchBarSpacer({ size: "flexible" }),
      statusLabel,
    ],
  });
}
