/**
 * API Client — Dual-transport HTTP/IPC client.
 *
 * When running in Electron with the IPC bridge available, API calls are
 * routed through Electron IPC to the main process (zero HTTP overhead).
 * Otherwise, falls back to standard fetch()-based HTTP calls.
 *
 * The transport switch is transparent — all existing API modules
 * (agents.ts, issues.ts, etc.) continue calling api.get(), api.post(), etc.
 * with the same path strings, and the client handles routing.
 */

const BASE = "/api";

/**
 * Whether we're running in Electron with the IPC bridge available.
 * Checked once at module load time.
 */
const hasIpc = typeof window !== "undefined" && !!(window as any).electronAPI?.invoke;

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// ── IPC Route Map ───────────────────────────────────────────────────────
// Maps HTTP method + URL pattern → IPC channel name + argument extractor.
// The patterns are checked in order; first match wins.

interface IpcRoute {
  method: string;
  pattern: RegExp;
  channel: string;
  /** Extract IPC args from the regex match groups and request body */
  args: (match: RegExpExecArray, body?: unknown) => unknown;
}

const ipcRoutes: IpcRoute[] = [
  // ── Health ──────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/health$/, channel: "health:check", args: () => undefined },

  // ── Companies ───────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies$/, channel: "companies:list", args: () => undefined },
  { method: "GET", pattern: /^\/companies\/([^/]+)$/, channel: "companies:get",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies$/, channel: "companies:create", args: (_, b) => b },
  { method: "PATCH", pattern: /^\/companies\/([^/]+)$/, channel: "companies:update",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/companies\/([^/]+)\/branding$/, channel: "companies:update-branding",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/archive$/, channel: "companies:archive",
    args: (m) => ({ companyId: m[1] }) },
  { method: "DELETE", pattern: /^\/companies\/([^/]+)$/, channel: "companies:delete",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/export$/, channel: "companies:export",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/exports\/preview$/, channel: "companies:export-preview",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/exports$/, channel: "companies:export",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/import\/preview$/, channel: "companies:import-preview",
    args: (_, b) => b },
  { method: "POST", pattern: /^\/companies\/import$/, channel: "companies:import", args: (_, b) => b },

  // ── Agents ──────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/agents$/, channel: "agents:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/org$/, channel: "agents:org-chart",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/agent-configurations$/, channel: "agents:list-configurations",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/agents$/, channel: "agents:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/agent-hires$/, channel: "agents:hire",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/agents\/([^/]+)\/configuration$/, channel: "agents:get-configuration",
    args: (m) => ({ id: m[1] }) },
  { method: "GET", pattern: /^\/agents\/([^/]+)\/config-revisions\/([^/]+)$/, channel: "agents:get-config-revision",
    args: (m) => ({ id: m[1], revisionId: m[2] }) },
  { method: "GET", pattern: /^\/agents\/([^/]+)\/config-revisions$/, channel: "agents:get-config-revisions",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/agents\/([^/]+)\/config-revisions\/([^/]+)\/rollback$/, channel: "agents:rollback-config",
    args: (m) => ({ id: m[1], revisionId: m[2] }) },
  { method: "GET", pattern: /^\/agents\/([^/]+)\/instructions-bundle$/, channel: "agents:get-instructions-bundle",
    args: (m) => ({ id: m[1] }) },
  { method: "PATCH", pattern: /^\/agents\/([^/]+)\/instructions-bundle$/, channel: "agents:update-instructions-bundle",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/agents\/([^/]+)\/instructions-bundle\/file/, channel: "agents:get-instructions-file",
    args: (m) => ({ id: m[1] }) },
  { method: "PUT", pattern: /^\/agents\/([^/]+)\/instructions-bundle\/file$/, channel: "agents:upsert-instructions-file",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/agents\/([^/]+)\/instructions-bundle\/file/, channel: "agents:delete-instructions-file",
    args: (m) => ({ id: m[1] }) },
  { method: "GET", pattern: /^\/agents\/([^/]+)\/runtime-state$/, channel: "agents:get-runtime-state",
    args: (m) => ({ id: m[1] }) },
  { method: "GET", pattern: /^\/agents\/([^/]+)\/task-sessions$/, channel: "agents:get-task-sessions",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/agents\/([^/]+)\/runtime-state\/reset-session$/, channel: "agents:reset-session",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/agents\/([^/]+)\/keys$/, channel: "agents:list-keys",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/agents\/([^/]+)\/keys$/, channel: "agents:create-key",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/agents\/([^/]+)\/keys\/([^/]+)$/, channel: "agents:delete-key",
    args: (m) => ({ id: m[1], keyId: m[2] }) },
  { method: "GET", pattern: /^\/agents\/([^/]+)\/skills$/, channel: "agents:get-skills",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/agents\/([^/]+)\/skills\/sync$/, channel: "agents:sync-skills",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/agents\/([^/]+)\/permissions$/, channel: "agents:update-permissions",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/agents\/([^/]+)\/policy$/, channel: "agents:update-policy",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/agents\/([^/]+)\/pause$/, channel: "agents:pause",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/agents\/([^/]+)\/resume$/, channel: "agents:resume",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/agents\/([^/]+)\/terminate$/, channel: "agents:terminate",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/agents\/([^/]+)\/wakeup$/, channel: "agents:wakeup",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/agents\/([^/]+)\/heartbeat\/invoke$/, channel: "agents:invoke-heartbeat",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/agents\/([^/]+)\/claude-login$/, channel: "agents:claude-login",
    args: (m) => ({ id: m[1] }) },
  { method: "GET", pattern: /^\/agents\/([^/]+)$/, channel: "agents:get",
    args: (m) => ({ id: m[1] }) },
  { method: "PATCH", pattern: /^\/agents\/([^/]+)$/, channel: "agents:update",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/agents\/([^/]+)$/, channel: "agents:delete",
    args: (m) => ({ id: m[1] }) },

  // ── Adapter models ──────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/adapters\/([^/]+)\/models$/, channel: "adapters:list-models",
    args: (m) => ({ companyId: m[1], type: m[2] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/adapters\/([^/]+)\/detect-model$/, channel: "adapters:detect-model",
    args: (m) => ({ companyId: m[1], type: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/adapters\/([^/]+)\/test-environment$/, channel: "adapters:test-environment",
    args: (m, b) => ({ companyId: m[1], type: m[2], ...(b as object) }) },

  // ── Issues ──────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/issues/, channel: "issues:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/issues$/, channel: "issues:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/issues\/([^/]+)\/comments$/, channel: "issues:list-comments",
    args: (m) => ({ issueId: m[1] }) },
  { method: "POST", pattern: /^\/issues\/([^/]+)\/comments$/, channel: "issues:add-comment",
    args: (m, b) => ({ issueId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/issues\/([^/]+)\/documents\/([^/]+)$/, channel: "issues:get-document",
    args: (m) => ({ issueId: m[1], key: decodeURIComponent(m[2]!) }) },
  { method: "GET", pattern: /^\/issues\/([^/]+)\/documents$/, channel: "issues:list-documents",
    args: (m) => ({ issueId: m[1] }) },
  { method: "PUT", pattern: /^\/issues\/([^/]+)\/documents\/([^/]+)$/, channel: "issues:upsert-document",
    args: (m, b) => ({ issueId: m[1], key: decodeURIComponent(m[2]!), ...(b as object) }) },
  { method: "GET", pattern: /^\/issues\/([^/]+)\/work-products$/, channel: "issues:list-work-products",
    args: (m) => ({ issueId: m[1] }) },
  { method: "POST", pattern: /^\/issues\/([^/]+)\/work-products$/, channel: "issues:create-work-product",
    args: (m, b) => ({ issueId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/issues\/([^/]+)\/checkout$/, channel: "issues:checkout",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/issues\/([^/]+)\/approvals$/, channel: "issues:link-approval",
    args: (m, b) => ({ issueId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/issues\/([^/]+)\/feedback-votes$/, channel: "issues:upsert-feedback-vote",
    args: (m, b) => ({ issueId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/issues\/([^/]+)\/live-runs$/, channel: "issues:list-live-runs",
    args: (m) => ({ issueId: m[1] }) },
  { method: "GET", pattern: /^\/issues\/([^/]+)\/active-run$/, channel: "issues:get-active-run",
    args: (m) => ({ issueId: m[1] }) },
  { method: "GET", pattern: /^\/issues\/([^/]+)$/, channel: "issues:get",
    args: (m) => ({ id: m[1] }) },
  { method: "PATCH", pattern: /^\/issues\/([^/]+)$/, channel: "issues:update",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/issues\/([^/]+)$/, channel: "issues:delete",
    args: (m) => ({ id: m[1] }) },

  // ── Labels ──────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/labels$/, channel: "issues:list-labels",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/labels$/, channel: "issues:create-label",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },

  // ── Projects ────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/projects$/, channel: "projects:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/projects$/, channel: "projects:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/projects\/([^/]+)\/workspaces$/, channel: "projects:list-workspaces",
    args: (m) => ({ projectId: m[1] }) },
  { method: "POST", pattern: /^\/projects\/([^/]+)\/workspaces$/, channel: "projects:create-workspace",
    args: (m, b) => ({ projectId: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/projects\/([^/]+)\/workspaces\/([^/]+)$/, channel: "projects:update-workspace",
    args: (m, b) => ({ projectId: m[1], workspaceId: m[2], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/projects\/([^/]+)\/workspaces\/([^/]+)$/, channel: "projects:delete-workspace",
    args: (m) => ({ projectId: m[1], workspaceId: m[2] }) },
  { method: "GET", pattern: /^\/projects\/([^/]+)$/, channel: "projects:get",
    args: (m) => ({ id: m[1] }) },
  { method: "PATCH", pattern: /^\/projects\/([^/]+)$/, channel: "projects:update",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/projects\/([^/]+)$/, channel: "projects:delete",
    args: (m) => ({ id: m[1] }) },

  // ── Goals ───────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/goals$/, channel: "goals:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/goals$/, channel: "goals:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/goals\/([^/]+)$/, channel: "goals:get",
    args: (m) => ({ id: m[1] }) },
  { method: "PATCH", pattern: /^\/goals\/([^/]+)$/, channel: "goals:update",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/goals\/([^/]+)$/, channel: "goals:delete",
    args: (m) => ({ id: m[1] }) },

  // ── Approvals ───────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/approvals/, channel: "approvals:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/approvals$/, channel: "approvals:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/approvals\/([^/]+)\/approve$/, channel: "approvals:resolve",
    args: (m, b) => ({ id: m[1], decision: "approved", ...(b as object) }) },
  { method: "POST", pattern: /^\/approvals\/([^/]+)\/reject$/, channel: "approvals:resolve",
    args: (m, b) => ({ id: m[1], decision: "rejected", ...(b as object) }) },
  { method: "POST", pattern: /^\/approvals\/([^/]+)\/request-revision$/, channel: "approvals:request-revision",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/approvals\/([^/]+)\/resubmit$/, channel: "approvals:resubmit",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/approvals\/([^/]+)\/comments$/, channel: "approvals:add-comment",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/approvals\/([^/]+)$/, channel: "approvals:get",
    args: (m) => ({ id: m[1] }) },

  // ── Routines ────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/routines$/, channel: "routines:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/routines$/, channel: "routines:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/routines\/([^/]+)\/runs/, channel: "routines:list-runs",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/routines\/([^/]+)\/triggers$/, channel: "routines:create-trigger",
    args: (m, b) => ({ routineId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/routines\/([^/]+)\/run$/, channel: "routines:run",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/routines\/([^/]+)$/, channel: "routines:get",
    args: (m) => ({ id: m[1] }) },
  { method: "PATCH", pattern: /^\/routines\/([^/]+)$/, channel: "routines:update",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/routine-triggers\/([^/]+)$/, channel: "routines:update-trigger",
    args: (m, b) => ({ triggerId: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/routine-triggers\/([^/]+)$/, channel: "routines:delete-trigger",
    args: (m) => ({ triggerId: m[1] }) },

  // ── Costs & Finance ─────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/summary/, channel: "costs:summary",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/by-agent-model/, channel: "costs:by-agent-model",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/by-agent/, channel: "costs:by-agent",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/by-provider/, channel: "costs:by-provider",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/by-biller/, channel: "costs:by-biller",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/by-project/, channel: "costs:by-project",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/finance-summary/, channel: "costs:finance-summary",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/finance-by-biller/, channel: "costs:finance-by-biller",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/finance-by-kind/, channel: "costs:finance-by-kind",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/finance-events/, channel: "costs:finance-events",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/window-spend/, channel: "costs:window-spend",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/costs\/quota-windows/, channel: "costs:quota-windows",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/budgets\/overview$/, channel: "budgets:overview",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/budgets\/policies$/, channel: "budgets:upsert-policy",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },

  // ── Secrets ─────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/secret-providers$/, channel: "secrets:list-providers",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/secrets$/, channel: "secrets:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/secrets$/, channel: "secrets:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/secrets\/([^/]+)\/rotate$/, channel: "secrets:rotate",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/secrets\/([^/]+)$/, channel: "secrets:update",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/secrets\/([^/]+)$/, channel: "secrets:delete",
    args: (m) => ({ id: m[1] }) },

  // ── Vault ───────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/vault$/, channel: "vault:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/vault\/([^/]+)\/audit$/, channel: "vault:audit",
    args: (m) => ({ credId: m[1] }) },
  { method: "GET", pattern: /^\/vault\/([^/]+)$/, channel: "vault:get",
    args: (m) => ({ credId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/vault$/, channel: "vault:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/vault\/([^/]+)$/, channel: "vault:update",
    args: (m, b) => ({ credId: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/vault\/([^/]+)$/, channel: "vault:delete",
    args: (m) => ({ credId: m[1] }) },
  { method: "POST", pattern: /^\/vault\/([^/]+)\/checkout$/, channel: "vault:checkout",
    args: (m) => ({ credId: m[1] }) },
  { method: "POST", pattern: /^\/vault\/([^/]+)\/rotate$/, channel: "vault:rotate",  // vault:rotate maps to same
    args: (m, b) => ({ credId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/vault\/active-checkouts$/, channel: "vault:active-checkouts",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/vault\/recent-checkouts$/, channel: "vault:recent-checkouts",
    args: (m) => ({ companyId: m[1] }) },

  // ── Dashboard & Activity ────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/dashboard$/, channel: "dashboard:summary",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/activity/, channel: "activity:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/sidebar-badges$/, channel: "sidebar-badges:get",
    args: (m) => ({ companyId: m[1] }) },

  // ── Heartbeat Runs ──────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/heartbeat-runs/, channel: "heartbeat-runs:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/live-runs/, channel: "heartbeat-runs:list-live",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/heartbeat-runs\/([^/]+)\/events$/, channel: "heartbeat-runs:get-events",
    args: (m) => ({ runId: m[1] }) },
  { method: "GET", pattern: /^\/heartbeat-runs\/([^/]+)\/log/, channel: "heartbeat-runs:get-log",
    args: (m) => ({ runId: m[1] }) },
  { method: "GET", pattern: /^\/heartbeat-runs\/([^/]+)\/workspace-operations$/, channel: "heartbeat-runs:list-operations",
    args: (m) => ({ runId: m[1] }) },
  { method: "POST", pattern: /^\/heartbeat-runs\/([^/]+)\/cancel$/, channel: "heartbeat-runs:cancel",
    args: (m) => ({ runId: m[1] }) },
  { method: "GET", pattern: /^\/heartbeat-runs\/([^/]+)$/, channel: "heartbeat-runs:get",
    args: (m) => ({ runId: m[1] }) },
  { method: "GET", pattern: /^\/workspace-operations\/([^/]+)\/log/, channel: "workspace-operations:get-log",
    args: (m) => ({ operationId: m[1] }) },

  // ── Instance Settings ───────────────────────────────────────────────
  { method: "GET", pattern: /^\/instance\/settings\/general$/, channel: "instance:get-general-settings",
    args: () => undefined },
  { method: "PATCH", pattern: /^\/instance\/settings\/general$/, channel: "instance:patch-general-settings",
    args: (_, b) => b },
  { method: "GET", pattern: /^\/instance\/settings\/experimental$/, channel: "instance:get-experimental-settings",
    args: () => undefined },
  { method: "PATCH", pattern: /^\/instance\/settings\/experimental$/, channel: "instance:patch-experimental-settings",
    args: (_, b) => b },
  { method: "GET", pattern: /^\/instance\/settings\/admin$/, channel: "instance:get-admin-settings",
    args: () => undefined },
  { method: "PATCH", pattern: /^\/instance\/settings\/admin$/, channel: "instance:patch-admin-settings",
    args: (_, b) => b },
  { method: "GET", pattern: /^\/instance\/scheduler-heartbeats$/, channel: "instance:get-scheduler-heartbeats",
    args: () => undefined },
  { method: "GET", pattern: /^\/instance\/settings\/admin\/templates$/, channel: "instance:list-templates",
    args: () => undefined },
  { method: "GET", pattern: /^\/instance\/settings\/templates\/available$/, channel: "instance:list-available-templates",
    args: () => undefined },

  // ── Execution Workspaces ────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/execution-workspaces/, channel: "execution-workspaces:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/execution-workspaces\/([^/]+)\/close-readiness$/, channel: "execution-workspaces:get-close-readiness",
    args: (m) => ({ id: m[1] }) },
  { method: "GET", pattern: /^\/execution-workspaces\/([^/]+)\/workspace-operations$/, channel: "execution-workspaces:list-operations",
    args: (m) => ({ id: m[1] }) },
  { method: "GET", pattern: /^\/execution-workspaces\/([^/]+)$/, channel: "execution-workspaces:get",
    args: (m) => ({ id: m[1] }) },
  { method: "PATCH", pattern: /^\/execution-workspaces\/([^/]+)$/, channel: "execution-workspaces:update",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },

  // ── SLA & Escalation ────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/sla\/policies$/, channel: "sla:list-policies",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/sla\/policies$/, channel: "sla:create-policy",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/sla\/dashboard$/, channel: "sla:dashboard",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/sla\/tracking$/, channel: "sla:list-tracking",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/escalation\/rules$/, channel: "escalation:list-rules",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/escalation\/rules$/, channel: "escalation:create-rule",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },

  // ── Dependencies & Workflows ────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/dependencies\/issue\/([^/]+)$/, channel: "dependencies:list-for-issue",
    args: (m) => ({ companyId: m[1], issueId: m[2] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/dependencies\/critical-path$/, channel: "dependencies:critical-path",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/dependencies$/, channel: "dependencies:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/dependencies$/, channel: "dependencies:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/workflows\/([^/]+)$/, channel: "workflows:get",
    args: (m) => ({ companyId: m[1], workflowId: m[2] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/workflows$/, channel: "workflows:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/workflows$/, channel: "workflows:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },

  // ── Skill Routing ───────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/skill-proficiency$/, channel: "skill-routing:list-proficiency",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/skill-matrix$/, channel: "skill-routing:skill-matrix",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/skill-proficiency$/, channel: "skill-routing:set-proficiency",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/route-task$/, channel: "skill-routing:route-task",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },

  // ── Analytics & Performance ─────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/analytics/, channel: "analytics:get",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/performance/, channel: "performance:get",
    args: (m) => ({ companyId: m[1] }) },

  // ── Lifecycle ───────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/onboarding\/workflows$/, channel: "lifecycle:list-onboarding-workflows",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/onboarding\/workflows$/, channel: "lifecycle:create-onboarding-workflow",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/onboarding\/execute$/, channel: "lifecycle:execute-onboarding",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/onboarding\/instances$/, channel: "lifecycle:list-onboarding-instances",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/offboard\/([^/]+)$/, channel: "lifecycle:offboard-agent",
    args: (m, b) => ({ companyId: m[1], agentId: m[2], ...(b as object) }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/change-requests$/, channel: "lifecycle:list-change-requests",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/change-requests$/, channel: "lifecycle:create-change-request",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },

  // ── Chatter ─────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/chatter/, channel: "chatter:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/chatter$/, channel: "chatter:send",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },

  // ── Team Roles ──────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/team-roles$/, channel: "team-roles:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/team-roles$/, channel: "team-roles:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },

  // ── Permission Policies ─────────────────────────────────────────────
  { method: "GET", pattern: /^\/permission-policies$/, channel: "permission-policies:list",
    args: () => ({}) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/permission-policies$/, channel: "permission-policies:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/permission-policies$/, channel: "permission-policies:create",
    args: (_, b) => b },

  // ── Company Skills ──────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/skills\/([^/]+)$/, channel: "company-skills:get",
    args: (m) => ({ companyId: m[1], skillId: m[2] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/skills$/, channel: "company-skills:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/skills$/, channel: "company-skills:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/skills\/import$/, channel: "company-skills:import",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },

  // ── Plugins ─────────────────────────────────────────────────────────
  { method: "GET", pattern: /^\/plugins\/ui-contributions$/, channel: "plugins:ui-contributions",
    args: () => undefined },
  { method: "GET", pattern: /^\/plugins\/([^/]+)\/health$/, channel: "plugins:health",
    args: (m) => ({ pluginId: m[1] }) },
  { method: "GET", pattern: /^\/plugins\/([^/]+)\/dashboard$/, channel: "plugins:dashboard",
    args: (m) => ({ pluginId: m[1] }) },
  { method: "GET", pattern: /^\/plugins\/([^/]+)$/, channel: "plugins:get",
    args: (m) => ({ pluginId: m[1] }) },
  { method: "GET", pattern: /^\/plugins$/, channel: "plugins:list",
    args: () => undefined },
  { method: "POST", pattern: /^\/plugins\/install$/, channel: "plugins:install",
    args: (_, b) => b },
  { method: "POST", pattern: /^\/plugins\/([^/]+)\/data\/([^/]+)$/, channel: "plugins:get-data",
    args: (m, b) => ({ pluginId: m[1], key: m[2], ...(b as object) }) },
  { method: "POST", pattern: /^\/plugins\/([^/]+)\/actions\/([^/]+)$/, channel: "plugins:perform-action",
    args: (m, b) => ({ pluginId: m[1], key: m[2], ...(b as object) }) },

  // ═══════════════════════════════════════════════════════════════════════
  // MISSING ROUTES — Added to fix silent API failures
  // ═══════════════════════════════════════════════════════════════════════

  // ── Dependencies & Workflows (missing) ────────────────────────────────
  { method: "DELETE", pattern: /^\/companies\/([^/]+)\/dependencies\/([^/]+)$/, channel: "dependencies:delete",
    args: (m) => ({ companyId: m[1], depId: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/dependencies\/issue\/([^/]+)\/completed$/, channel: "dependencies:mark-completed",
    args: (m) => ({ companyId: m[1], issueId: m[2] }) },
  { method: "PATCH", pattern: /^\/companies\/([^/]+)\/workflows\/([^/]+)$/, channel: "workflows:update",
    args: (m, b) => ({ companyId: m[1], workflowId: m[2], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/companies\/([^/]+)\/workflows\/([^/]+)$/, channel: "workflows:delete",
    args: (m) => ({ companyId: m[1], workflowId: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/workflows\/([^/]+)\/execute$/, channel: "workflows:execute",
    args: (m, b) => ({ companyId: m[1], workflowId: m[2], ...(b as object) }) },

  // ── Lifecycle (missing) ───────────────────────────────────────────────
  { method: "PATCH", pattern: /^\/companies\/([^/]+)\/onboarding\/workflows\/([^/]+)$/, channel: "lifecycle:update-onboarding-workflow",
    args: (m, b) => ({ companyId: m[1], id: m[2], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/companies\/([^/]+)\/onboarding\/workflows\/([^/]+)$/, channel: "lifecycle:delete-onboarding-workflow",
    args: (m) => ({ companyId: m[1], id: m[2] }) },
  { method: "PATCH", pattern: /^\/companies\/([^/]+)\/change-requests\/([^/]+)$/, channel: "lifecycle:update-change-request",
    args: (m, b) => ({ companyId: m[1], id: m[2], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/companies\/([^/]+)\/change-requests\/([^/]+)$/, channel: "lifecycle:delete-change-request",
    args: (m) => ({ companyId: m[1], id: m[2] }) },

  // ── SLA & Escalation (missing) ────────────────────────────────────────
  { method: "PATCH", pattern: /^\/companies\/([^/]+)\/sla\/policies\/([^/]+)$/, channel: "sla:update-policy",
    args: (m, b) => ({ companyId: m[1], policyId: m[2], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/companies\/([^/]+)\/sla\/policies\/([^/]+)$/, channel: "sla:delete-policy",
    args: (m) => ({ companyId: m[1], policyId: m[2] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/sla\/tracking\/issue\/([^/]+)$/, channel: "sla:get-issue-tracking",
    args: (m) => ({ companyId: m[1], issueId: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/sla\/tracking$/, channel: "sla:start-tracking",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/sla\/tracking\/([^/]+)\/pause$/, channel: "sla:pause-tracking",
    args: (m) => ({ companyId: m[1], issueId: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/sla\/tracking\/([^/]+)\/resume$/, channel: "sla:resume-tracking",
    args: (m) => ({ companyId: m[1], issueId: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/sla\/tracking\/([^/]+)\/respond$/, channel: "sla:respond-tracking",
    args: (m) => ({ companyId: m[1], issueId: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/sla\/tracking\/([^/]+)\/resolve$/, channel: "sla:resolve-tracking",
    args: (m) => ({ companyId: m[1], issueId: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/sla\/check-breaches$/, channel: "sla:check-breaches",
    args: (m) => ({ companyId: m[1] }) },
  { method: "PATCH", pattern: /^\/companies\/([^/]+)\/escalation\/rules\/([^/]+)$/, channel: "escalation:update-rule",
    args: (m, b) => ({ companyId: m[1], ruleId: m[2], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/companies\/([^/]+)\/escalation\/rules\/([^/]+)$/, channel: "escalation:delete-rule",
    args: (m) => ({ companyId: m[1], ruleId: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/escalation\/evaluate$/, channel: "escalation:evaluate",
    args: (m) => ({ companyId: m[1] }) },

  // ── Company Skills (missing) ──────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/skills\/([^/]+)\/update-status$/, channel: "company-skills:update-status",
    args: (m) => ({ companyId: m[1], skillId: m[2] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/skills\/([^/]+)\/files/, channel: "company-skills:get-file",
    args: (m) => ({ companyId: m[1], skillId: m[2] }) },
  { method: "PATCH", pattern: /^\/companies\/([^/]+)\/skills\/([^/]+)\/files$/, channel: "company-skills:update-file",
    args: (m, b) => ({ companyId: m[1], skillId: m[2], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/skills\/scan-projects$/, channel: "company-skills:scan-project",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/skills\/([^/]+)\/install-update$/, channel: "company-skills:install-update",
    args: (m) => ({ companyId: m[1], skillId: m[2] }) },
  { method: "DELETE", pattern: /^\/companies\/([^/]+)\/skills\/([^/]+)$/, channel: "company-skills:delete",
    args: (m) => ({ companyId: m[1], skillId: m[2] }) },

  // ── Skill Routing (missing) ───────────────────────────────────────────
  { method: "DELETE", pattern: /^\/companies\/([^/]+)\/skill-proficiency\/([^/]+)$/, channel: "skill-routing:delete-proficiency",
    args: (m) => ({ companyId: m[1], skillId: m[2] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/agents\/([^/]+)\/skills$/, channel: "skill-routing:agent-skills",
    args: (m) => ({ companyId: m[1], agentId: m[2] }) },

  // ── Plugins (missing) ─────────────────────────────────────────────────
  { method: "GET", pattern: /^\/plugins\/examples$/, channel: "plugins:list-examples",
    args: () => undefined },
  { method: "DELETE", pattern: /^\/plugins\/([^/]+)$/, channel: "plugins:uninstall",
    args: (m) => ({ pluginId: m[1] }) },
  { method: "POST", pattern: /^\/plugins\/([^/]+)\/enable$/, channel: "plugins:enable",
    args: (m) => ({ pluginId: m[1] }) },
  { method: "POST", pattern: /^\/plugins\/([^/]+)\/disable$/, channel: "plugins:disable",
    args: (m, b) => ({ pluginId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/plugins\/([^/]+)\/logs/, channel: "plugins:logs",
    args: (m) => ({ pluginId: m[1] }) },
  { method: "POST", pattern: /^\/plugins\/([^/]+)\/upgrade$/, channel: "plugins:upgrade",
    args: (m, b) => ({ pluginId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/plugins\/([^/]+)\/config$/, channel: "plugins:get-config",
    args: (m) => ({ pluginId: m[1] }) },
  { method: "POST", pattern: /^\/plugins\/([^/]+)\/config\/test$/, channel: "plugins:test-config",
    args: (m, b) => ({ pluginId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/plugins\/([^/]+)\/config$/, channel: "plugins:save-config",
    args: (m, b) => ({ pluginId: m[1], ...(b as object) }) },

  // ── Access & Invites (missing) ────────────────────────────────────────
  { method: "POST", pattern: /^\/companies\/([^/]+)\/invites$/, channel: "invites:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/openclaw\/invite-prompt$/, channel: "invites:create-openclaw",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/invites\/([^/]+)$/, channel: "invites:get",
    args: (m) => ({ token: m[1] }) },
  { method: "GET", pattern: /^\/invites\/([^/]+)\/onboarding$/, channel: "invites:get-onboarding",
    args: (m) => ({ token: m[1] }) },
  { method: "POST", pattern: /^\/invites\/([^/]+)\/accept$/, channel: "invites:accept",
    args: (m, b) => ({ token: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/join-requests/, channel: "access:list-join-requests",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/join-requests\/([^/]+)\/approve$/, channel: "access:approve-join-request",
    args: (m) => ({ companyId: m[1], requestId: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/join-requests\/([^/]+)\/reject$/, channel: "access:reject-join-request",
    args: (m) => ({ companyId: m[1], requestId: m[2] }) },
  { method: "POST", pattern: /^\/join-requests\/([^/]+)\/claim-api-key$/, channel: "access:claim-api-key",
    args: (m, b) => ({ requestId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/board-claim\/([^/]+)/, channel: "access:get-board-claim",
    args: (m) => ({ token: m[1] }) },
  { method: "POST", pattern: /^\/board-claim\/([^/]+)\/claim$/, channel: "access:claim-board",
    args: (m, b) => ({ token: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/cli-auth\/challenges\/([^/]+)/, channel: "access:get-cli-auth",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/cli-auth\/challenges\/([^/]+)\/approve$/, channel: "access:approve-cli-auth",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/cli-auth\/challenges\/([^/]+)\/cancel$/, channel: "access:cancel-cli-auth",
    args: (m) => ({ id: m[1] }) },

  // ── Admin Settings (missing) ──────────────────────────────────────────
  { method: "GET", pattern: /^\/instance\/settings\/admin\/auth-mode$/, channel: "instance:get-admin-auth-mode",
    args: () => undefined },
  { method: "POST", pattern: /^\/instance\/settings\/admin\/verify-pin$/, channel: "instance:verify-pin",
    args: (_, b) => b },
  { method: "POST", pattern: /^\/instance\/settings\/admin\/change-pin$/, channel: "instance:change-pin",
    args: (_, b) => b },
  { method: "POST", pattern: /^\/instance\/settings\/admin\/templates$/, channel: "instance:create-template",
    args: (_, b) => b },
  { method: "PATCH", pattern: /^\/instance\/settings\/admin\/templates\/([^/]+)$/, channel: "instance:update-template",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/instance\/settings\/admin\/templates\/([^/]+)$/, channel: "instance:delete-template",
    args: (m) => ({ id: m[1] }) },

  // ── Team Roles (missing) ──────────────────────────────────────────────
  { method: "DELETE", pattern: /^\/companies\/([^/]+)\/team-roles\/([^/]+)$/, channel: "team-roles:delete",
    args: (m) => ({ companyId: m[1], userId: m[2] }) },

  // ── Issues - Read/Archive/Release (missing) ───────────────────────────
  { method: "POST", pattern: /^\/issues\/([^/]+)\/read$/, channel: "issues:mark-read",
    args: (m) => ({ id: m[1] }) },
  { method: "DELETE", pattern: /^\/issues\/([^/]+)\/read$/, channel: "issues:mark-unread",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/issues\/([^/]+)\/inbox-archive$/, channel: "issues:archive-from-inbox",
    args: (m) => ({ id: m[1] }) },
  { method: "DELETE", pattern: /^\/issues\/([^/]+)\/inbox-archive$/, channel: "issues:unarchive-from-inbox",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/issues\/([^/]+)\/release$/, channel: "issues:release",
    args: (m) => ({ id: m[1] }) },

  // ── Issues - Documents (missing) ──────────────────────────────────────
  { method: "DELETE", pattern: /^\/issues\/([^/]+)\/documents\/([^/]+)$/, channel: "issues:delete-document",
    args: (m) => ({ issueId: m[1], key: decodeURIComponent(m[2]!) }) },
  { method: "GET", pattern: /^\/issues\/([^/]+)\/documents\/([^/]+)\/revisions$/, channel: "issues:list-document-revisions",
    args: (m) => ({ issueId: m[1], key: decodeURIComponent(m[2]!) }) },
  { method: "POST", pattern: /^\/issues\/([^/]+)\/documents\/([^/]+)\/revisions\/([^/]+)\/restore$/, channel: "issues:restore-document-revision",
    args: (m) => ({ issueId: m[1], key: decodeURIComponent(m[2]!), revisionId: m[3] }) },

  // ── Issues - Attachments (missing) ────────────────────────────────────
  { method: "GET", pattern: /^\/issues\/([^/]+)\/attachments$/, channel: "issues:list-attachments",
    args: (m) => ({ issueId: m[1] }) },
  { method: "DELETE", pattern: /^\/attachments\/([^/]+)$/, channel: "issues:delete-attachment",
    args: (m) => ({ id: m[1] }) },

  // ── Issues - Approvals (missing) ──────────────────────────────────────
  { method: "GET", pattern: /^\/issues\/([^/]+)\/approvals$/, channel: "issues:list-approvals",
    args: (m) => ({ issueId: m[1] }) },
  { method: "DELETE", pattern: /^\/issues\/([^/]+)\/approvals\/([^/]+)$/, channel: "issues:unlink-approval",
    args: (m) => ({ issueId: m[1], approvalId: m[2] }) },

  // ── Issues - Work Products (missing) ──────────────────────────────────
  { method: "PATCH", pattern: /^\/work-products\/([^/]+)$/, channel: "issues:update-work-product-by-id",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/work-products\/([^/]+)$/, channel: "issues:delete-work-product",
    args: (m) => ({ id: m[1] }) },

  // ── Issues - Feedback (missing) ───────────────────────────────────────
  { method: "GET", pattern: /^\/issues\/([^/]+)\/feedback-votes$/, channel: "issues:list-feedback-votes",
    args: (m) => ({ issueId: m[1] }) },
  { method: "GET", pattern: /^\/issues\/([^/]+)\/feedback-traces/, channel: "issues:list-feedback-traces",
    args: (m) => ({ issueId: m[1] }) },

  // ── Labels (missing) ──────────────────────────────────────────────────
  { method: "DELETE", pattern: /^\/labels\/([^/]+)$/, channel: "issues:delete-label",
    args: (m) => ({ id: m[1] }) },

  // ── Approvals (missing actions) ───────────────────────────────────────
  { method: "GET", pattern: /^\/approvals\/([^/]+)\/comments$/, channel: "approvals:list-comments",
    args: (m) => ({ id: m[1] }) },
  { method: "GET", pattern: /^\/approvals\/([^/]+)\/issues$/, channel: "approvals:list-issues",
    args: (m) => ({ id: m[1] }) },

  // ── Costs - Budget incidents (missing) ────────────────────────────────
  { method: "POST", pattern: /^\/companies\/([^/]+)\/budget-incidents\/([^/]+)\/resolve$/, channel: "budgets:resolve-incident",
    args: (m, b) => ({ companyId: m[1], incidentId: m[2], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/companies\/([^/]+)\/budgets$/, channel: "budgets:update",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/agents\/([^/]+)\/budgets$/, channel: "budgets:update-agent",
    args: (m, b) => ({ agentId: m[1], ...(b as object) }) },

  // ── Routines (missing) ────────────────────────────────────────────────
  { method: "POST", pattern: /^\/routine-triggers\/([^/]+)\/rotate-secret$/, channel: "routines:rotate-trigger-secret",
    args: (m) => ({ triggerId: m[1] }) },

  // ── Agents (missing) ──────────────────────────────────────────────────
  { method: "GET", pattern: /^\/skills\/available$/, channel: "agents:available-skills",
    args: () => undefined },
  { method: "PATCH", pattern: /^\/agents\/([^/]+)\/instructions-path$/, channel: "agents:update-instructions-path",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/org\.svg$/, channel: "agents:org-chart-svg",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/org\.png$/, channel: "agents:org-chart-png",
    args: (m) => ({ companyId: m[1] }) },

  // ── Activity (missing) ────────────────────────────────────────────────
  { method: "GET", pattern: /^\/issues\/([^/]+)\/activity$/, channel: "activity:for-issue",
    args: (m) => ({ issueId: m[1] }) },
  { method: "GET", pattern: /^\/issues\/([^/]+)\/runs$/, channel: "activity:runs-for-issue",
    args: (m) => ({ issueId: m[1] }) },
  { method: "GET", pattern: /^\/heartbeat-runs\/([^/]+)\/issues$/, channel: "activity:issues-for-run",
    args: (m) => ({ runId: m[1] }) },

  // ── Companies (missing) ───────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/stats$/, channel: "companies:stats",
    args: () => undefined },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/feedback-traces/, channel: "companies:get-feedback-traces",
    args: (m) => ({ companyId: m[1] }) },

  // ── Vault (missing) ───────────────────────────────────────────────────
  { method: "POST", pattern: /^\/vault\/([^/]+)\/rotate$/, channel: "vault:rotate",
    args: (m, b) => ({ credId: m[1], ...(b as object) }) },

  // ── Execution Workspaces (missing) ────────────────────────────────────
  { method: "POST", pattern: /^\/execution-workspaces\/([^/]+)\/runtime-services\/([^/]+)$/, channel: "execution-workspaces:runtime-action",
    args: (m) => ({ id: m[1], action: m[2] }) },
  { method: "GET", pattern: /^\/execution-workspaces\/([^/]+)\/metadata$/, channel: "execution-workspaces:get-metadata",
    args: (m) => ({ id: m[1] }) },

  // ── Workspace operations (missing) ────────────────────────────────────
  { method: "POST", pattern: /^\/projects\/([^/]+)\/workspaces\/([^/]+)\/runtime-services\/([^/]+)$/, channel: "projects:workspace-runtime-action",
    args: (m) => ({ projectId: m[1], workspaceId: m[2], action: m[3] }) },

  // ── Members (missing) ─────────────────────────────────────────────────
  { method: "GET", pattern: /^\/companies\/([^/]+)\/members$/, channel: "members:list",
    args: (m) => ({ companyId: m[1] }) },

  // ═══════════════════════════════════════════════════════════════════════
  // AGENT OS ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  // LLM Providers
  { method: "GET", pattern: /^\/llm-providers\/available$/, channel: "llm-providers:list-available",
    args: () => undefined },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/llm-providers$/, channel: "llm-providers:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/llm-providers\/([^/]+)\/models$/, channel: "llm-providers:list-models",
    args: (m) => ({ id: m[1] }) },
  { method: "GET", pattern: /^\/llm-providers\/([^/]+)$/, channel: "llm-providers:get",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/llm-providers$/, channel: "llm-providers:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/llm-providers\/([^/]+)$/, channel: "llm-providers:update",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/llm-providers\/([^/]+)$/, channel: "llm-providers:delete",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/llm-providers\/([^/]+)\/test$/, channel: "llm-providers:test",
    args: (m) => ({ id: m[1] }) },

  // Agent Memories
  { method: "GET", pattern: /^\/companies\/([^/]+)\/agents\/([^/]+)\/memories/, channel: "agent-memories:list",
    args: (m) => ({ companyId: m[1], agentId: m[2] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/agents\/([^/]+)\/memories\/search$/, channel: "agent-memories:search",
    args: (m, b) => ({ companyId: m[1], agentId: m[2], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/agents\/([^/]+)\/memories$/, channel: "agent-memories:create",
    args: (m, b) => ({ companyId: m[1], agentId: m[2], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/agents\/([^/]+)\/memories\/([^/]+)$/, channel: "agent-memories:delete",
    args: (m) => ({ agentId: m[1], memoryId: m[2] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/agents\/([^/]+)\/memory-context$/, channel: "agent-memories:get-context",
    args: (m) => ({ companyId: m[1], agentId: m[2] }) },

  // Conversations
  { method: "GET", pattern: /^\/companies\/([^/]+)\/conversations/, channel: "conversations:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/conversations\/search$/, channel: "conversations:search",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/conversations$/, channel: "conversations:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "GET", pattern: /^\/conversations\/([^/]+)$/, channel: "conversations:get",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/conversations\/([^/]+)\/messages$/, channel: "conversations:append-message",
    args: (m, b) => ({ conversationId: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/conversations\/([^/]+)$/, channel: "conversations:update",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },

  // Skill Proposals
  { method: "GET", pattern: /^\/companies\/([^/]+)\/skill-proposals/, channel: "skill-proposals:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "GET", pattern: /^\/skill-proposals\/([^/]+)$/, channel: "skill-proposals:get",
    args: (m) => ({ id: m[1] }) },
  { method: "POST", pattern: /^\/skill-proposals\/([^/]+)\/approve$/, channel: "skill-proposals:approve",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "POST", pattern: /^\/skill-proposals\/([^/]+)\/reject$/, channel: "skill-proposals:reject",
    args: (m) => ({ id: m[1] }) },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/skill-usage\/([^/]+)$/, channel: "skill-proposals:effectiveness",
    args: (m) => ({ companyId: m[1], skillId: m[2] }) },

  // Routine Templates
  { method: "GET", pattern: /^\/routine-templates$/, channel: "routine-templates:list",
    args: () => undefined },
  { method: "GET", pattern: /^\/routine-templates\/([^/]+)$/, channel: "routine-templates:get",
    args: (m) => ({ slug: m[1] }) },
  { method: "POST", pattern: /^\/routine-templates\/([^/]+)\/instantiate$/, channel: "routine-templates:instantiate",
    args: (m, b) => ({ slug: m[1], ...(b as object) }) },

  // User Credentials
  { method: "GET", pattern: /^\/user-credentials\/options$/, channel: "user-credentials:options",
    args: () => undefined },
  { method: "GET", pattern: /^\/companies\/([^/]+)\/user-credentials$/, channel: "user-credentials:list",
    args: (m) => ({ companyId: m[1] }) },
  { method: "POST", pattern: /^\/companies\/([^/]+)\/user-credentials$/, channel: "user-credentials:create",
    args: (m, b) => ({ companyId: m[1], ...(b as object) }) },
  { method: "PATCH", pattern: /^\/user-credentials\/([^/]+)$/, channel: "user-credentials:update",
    args: (m, b) => ({ id: m[1], ...(b as object) }) },
  { method: "DELETE", pattern: /^\/user-credentials\/([^/]+)$/, channel: "user-credentials:revoke",
    args: (m) => ({ id: m[1] }) },
];

// ── IPC Transport ───────────────────────────────────────────────────────

/**
 * Try to match a request to an IPC route and invoke it.
 * Returns undefined if no match found (falls through to HTTP).
 */
function tryIpcRoute<T>(method: string, path: string, body?: unknown): Promise<T> | undefined {
  // Strip query string for matching (query params are part of REST but not IPC)
  const pathOnly = path.split("?")[0]!;

  for (const route of ipcRoutes) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(pathOnly);
    if (!match) continue;

    const args = route.args(match, body);
    return (window as any).electronAPI.invoke(route.channel, args) as Promise<T>;
  }

  // Log unmatched routes in development to catch missing IPC patterns
  if (typeof __ELECTRON__ !== "undefined" || hasIpc) {
    console.warn(`[IPC] No route for ${method} ${pathOnly} — falling back to HTTP`);
  }

  return undefined;
}

declare const __ELECTRON__: boolean;

// ── HTTP Transport (fallback) ───────────────────────────────────────────

interface RequestOptions {
  headers?: Record<string, string>;
}

function buildInit(method: string, body?: string | FormData, opts?: RequestOptions): RequestInit {
  const init: RequestInit = { method };
  if (body !== undefined) init.body = body;
  if (opts?.headers) init.headers = opts.headers;
  return init;
}

async function httpRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);
  const body = init?.body;
  if (!(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const { headers: _h, ...rest } = init ?? {};
  const res = await fetch(`${BASE}${path}`, {
    headers,
    credentials: "include",
    ...rest,
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new ApiError(
      (errorBody as { error?: string } | null)?.error ?? `Request failed: ${res.status}`,
      res.status,
      errorBody,
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Public API ──────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, opts?: RequestOptions): Promise<T> => {
    if (hasIpc) {
      const ipcResult = tryIpcRoute<T>("GET", path);
      if (ipcResult) return ipcResult;
    }
    return httpRequest<T>(path, buildInit("GET", undefined, opts));
  },

  post: <T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> => {
    if (hasIpc) {
      const ipcResult = tryIpcRoute<T>("POST", path, body);
      if (ipcResult) return ipcResult;
    }
    return httpRequest<T>(path, buildInit("POST", JSON.stringify(body), opts));
  },

  postForm: <T>(path: string, body: FormData): Promise<T> => {
    // FormData uploads always go through HTTP (binary data)
    return httpRequest<T>(path, { method: "POST", body });
  },

  put: <T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> => {
    if (hasIpc) {
      const ipcResult = tryIpcRoute<T>("PUT", path, body);
      if (ipcResult) return ipcResult;
    }
    return httpRequest<T>(path, buildInit("PUT", JSON.stringify(body), opts));
  },

  patch: <T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> => {
    if (hasIpc) {
      const ipcResult = tryIpcRoute<T>("PATCH", path, body);
      if (ipcResult) return ipcResult;
    }
    return httpRequest<T>(path, buildInit("PATCH", JSON.stringify(body), opts));
  },

  delete: <T>(path: string, opts?: RequestOptions): Promise<T> => {
    if (hasIpc) {
      const ipcResult = tryIpcRoute<T>("DELETE", path);
      if (ipcResult) return ipcResult;
    }
    return httpRequest<T>(path, buildInit("DELETE", undefined, opts));
  },
};

/** SHA-256 hash a string, returns hex. Used for PIN transport protection. */
export async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
