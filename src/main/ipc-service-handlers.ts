/**
 * IPC Service Handlers — maps IPC channels to service method calls.
 *
 * This is the core of Phase 2: every REST route handler is re-expressed
 * as an IPC handler that calls the service layer directly, with no HTTP.
 *
 * Pattern:
 *   REST:  router.get("/companies/:id/goals", (req, res) => res.json(await svc.list(id)))
 *   IPC:   ipcMain.handle("goals:list", (_, { companyId }) => svc.list(companyId))
 *
 * Actor context: In local_trusted mode (the Electron default), all IPC
 * calls are inherently trusted — they come from the same user on the
 * same machine. No auth middleware is needed. The actor is always
 * "local-board" with instance_admin privileges.
 */

import { ipcMain, BrowserWindow } from "electron";
import type { ServiceContainer } from "./service-container.js";
import { getMainWindow } from "./window-manager.js";
import {
  notifyAgentCompleted,
  notifyApprovalRequired,
  notifyAgentError,
} from "./notifications.js";
import { setBadgeCount } from "./tray.js";

// Default actor for local_trusted mode — mimics what the server middleware does
const LOCAL_ACTOR = {
  actorType: "user" as const,
  actorId: "local-board",
  agentId: null,
};

/**
 * Register all business-logic IPC handlers.
 * Called after the database and services are initialized.
 */
export function registerServiceIpcHandlers(svc: ServiceContainer): void {
  const h = ipcMain.handle.bind(ipcMain);

  // ── Health ────────────────────────────────────────────────────────────
  h("health:check", async () => {
    try {
      const dynamicImport = Function("p", "return import(p)");
      const { sql } = await dynamicImport("drizzle-orm");
      await svc.db.execute(sql`SELECT 1`);
      return {
        status: "ok",
        database: "connected",
        bootstrapped: true,
        deploymentMode: "local_trusted",
      };
    } catch {
      return { status: "unhealthy", database: "unreachable", bootstrapped: false };
    }
  });

  // ── Companies ─────────────────────────────────────────────────────────
  h("companies:list", () => svc.company.list());
  h("companies:get", (_, { companyId }: any) => svc.company.getById(companyId));
  h("companies:create", (_, args: any) => svc.company.create(args));
  h("companies:update", (_, { companyId, ...data }: any) => svc.company.update(companyId, data));
  h("companies:update-branding", (_, { companyId, ...data }: any) =>
    svc.company.updateBranding(companyId, data));
  h("companies:archive", (_, { companyId }: any) => svc.company.archive(companyId));
  h("companies:delete", (_, { companyId }: any) => svc.company.remove(companyId));
  h("companies:export", (_, { companyId, ...opts }: any) =>
    svc.companyPortability.exportBundle(companyId, opts));
  h("companies:export-preview", (_, { companyId, ...opts }: any) =>
    svc.companyPortability.previewExport(companyId, opts));
  h("companies:import-preview", (_, args: any) => svc.companyPortability.previewImport(args));
  h("companies:import", (_, args: any) => svc.companyPortability.importBundle(args));

  // ── Agents ────────────────────────────────────────────────────────────
  h("agents:list", (_, { companyId }: any) => svc.agent.list(companyId));
  h("agents:get", (_, { id }: any) => svc.agent.getById(id));
  h("agents:create", async (_, { companyId, ...data }: any) => {
    const agent = await svc.agent.create(companyId, data);
    await svc.logActivity({
      companyId,
      ...LOCAL_ACTOR,
      action: "agent.created",
      entityType: "agent",
      entityId: agent.id,
      details: { name: agent.name },
    });
    return agent;
  });
  h("agents:hire", async (_, { companyId, ...data }: any) => {
    return svc.agent.hire(companyId, data);
  });
  h("agents:update", async (_, { id, ...data }: any) => {
    const agent = await svc.agent.update(id, data);
    if (agent) {
      await svc.logActivity({
        companyId: agent.companyId,
        ...LOCAL_ACTOR,
        action: "agent.updated",
        entityType: "agent",
        entityId: agent.id,
        details: data,
      });
    }
    return agent;
  });
  h("agents:pause", (_, { id }: any) => svc.agent.pause(id));
  h("agents:resume", (_, { id }: any) => svc.agent.resume(id));
  h("agents:terminate", (_, { id }: any) => svc.agent.terminate(id));
  h("agents:delete", (_, { id }: any) => svc.agent.remove(id));
  h("agents:wakeup", (_, { id, ...opts }: any) => svc.agent.wakeup(id, opts));
  h("agents:invoke-heartbeat", (_, { id }: any) => svc.heartbeat.invokeForAgent(id));

  // Agent configuration
  h("agents:get-configuration", (_, { id }: any) => svc.agent.getConfiguration(id));
  h("agents:get-config-revisions", (_, { id }: any) => svc.agent.listConfigRevisions(id));
  h("agents:get-config-revision", (_, { id, revisionId }: any) =>
    svc.agent.getConfigRevision(id, revisionId));
  h("agents:rollback-config", (_, { id, revisionId }: any) =>
    svc.agent.rollbackConfig(id, revisionId));
  h("agents:list-configurations", (_, { companyId }: any) =>
    svc.agent.listConfigurations(companyId));

  // Agent permissions
  h("agents:update-permissions", (_, { id, ...data }: any) =>
    svc.agent.updatePermissions(id, data));
  h("agents:update-policy", (_, { id, policy }: any) => svc.agent.assignPolicy(id, policy));

  // Agent instructions
  h("agents:get-instructions-bundle", (_, { id }: any) =>
    svc.agentInstructions.getBundle(id));
  h("agents:update-instructions-bundle", (_, { id, ...data }: any) =>
    svc.agentInstructions.updateBundle(id, data));
  h("agents:get-instructions-file", (_, { id, path }: any) =>
    svc.agentInstructions.getFile(id, path));
  h("agents:upsert-instructions-file", (_, { id, ...data }: any) =>
    svc.agentInstructions.upsertFile(id, data));
  h("agents:delete-instructions-file", (_, { id, path }: any) =>
    svc.agentInstructions.deleteFile(id, path));

  // Agent runtime
  h("agents:get-runtime-state", (_, { id }: any) => svc.agent.getRuntimeState(id));
  h("agents:get-task-sessions", (_, { id }: any) => svc.agent.getTaskSessions(id));
  h("agents:reset-session", (_, { id, ...opts }: any) => svc.agent.resetSession(id, opts));

  // Agent API keys
  h("agents:list-keys", (_, { id }: any) => svc.agent.listKeys(id));
  h("agents:create-key", (_, { id, ...data }: any) => svc.agent.createKey(id, data));
  h("agents:delete-key", (_, { id, keyId }: any) => svc.agent.deleteKey(id, keyId));

  // Agent skills
  h("agents:get-skills", (_, { id }: any) => svc.agent.getSkills(id));
  h("agents:sync-skills", (_, { id, ...data }: any) => svc.agent.syncSkills(id, data));

  // ── Issues ────────────────────────────────────────────────────────────
  h("issues:list", (_, { companyId, ...filters }: any) => svc.issue.list(companyId, filters));
  h("issues:get", (_, { id }: any) => svc.issue.getById(id));
  h("issues:create", async (_, { companyId, ...data }: any) => {
    const issue = await svc.issue.create(companyId, data);
    await svc.logActivity({
      companyId,
      ...LOCAL_ACTOR,
      action: "issue.created",
      entityType: "issue",
      entityId: issue.id,
      details: { title: issue.title },
    });
    return issue;
  });
  h("issues:update", async (_, { id, ...data }: any) => {
    const issue = await svc.issue.update(id, data);
    if (issue) {
      await svc.logActivity({
        companyId: issue.companyId,
        ...LOCAL_ACTOR,
        action: "issue.updated",
        entityType: "issue",
        entityId: issue.id,
        details: data,
      });
    }
    return issue;
  });
  h("issues:checkout", (_, { id, ...data }: any) => svc.issue.checkout(id, data));
  h("issues:delete", (_, { id }: any) => svc.issue.remove(id));

  // Issue comments
  h("issues:add-comment", (_, { issueId, ...data }: any) =>
    svc.issue.addComment(issueId, data));

  // Issue documents
  h("issues:list-documents", (_, { issueId }: any) => svc.document.listForIssue(issueId));
  h("issues:get-document", (_, { issueId, key }: any) => svc.document.get(issueId, key));
  h("issues:upsert-document", (_, { issueId, ...data }: any) =>
    svc.document.upsert(issueId, data));

  // Issue work products
  h("issues:create-work-product", (_, { issueId, ...data }: any) =>
    svc.workProduct.create(issueId, data));
  h("issues:update-work-product", (_, { issueId, workProductId, ...data }: any) =>
    svc.workProduct.update(workProductId, data));

  // ── Projects ──────────────────────────────────────────────────────────
  h("projects:list", (_, { companyId }: any) => svc.project.list(companyId));
  h("projects:get", (_, { id }: any) => svc.project.getById(id));
  h("projects:create", async (_, { companyId, ...data }: any) => {
    const project = await svc.project.create(companyId, data);
    await svc.logActivity({
      companyId,
      ...LOCAL_ACTOR,
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      details: { name: project.name },
    });
    return project;
  });
  h("projects:update", (_, { id, ...data }: any) => svc.project.update(id, data));
  h("projects:delete", (_, { id }: any) => svc.project.remove(id));
  h("projects:list-workspaces", (_, { projectId }: any) => svc.project.listWorkspaces(projectId));
  h("projects:create-workspace", (_, { projectId, ...data }: any) =>
    svc.project.createWorkspace(projectId, data));
  h("projects:update-workspace", (_, { projectId, workspaceId, ...data }: any) =>
    svc.project.updateWorkspace(projectId, workspaceId, data));
  h("projects:delete-workspace", (_, { projectId, workspaceId }: any) =>
    svc.project.removeWorkspace(projectId, workspaceId));

  // ── Goals ─────────────────────────────────────────────────────────────
  h("goals:list", (_, { companyId }: any) => svc.goal.list(companyId));
  h("goals:get", (_, { id }: any) => svc.goal.getById(id));
  h("goals:create", async (_, { companyId, ...data }: any) => {
    const goal = await svc.goal.create(companyId, data);
    await svc.logActivity({
      companyId,
      ...LOCAL_ACTOR,
      action: "goal.created",
      entityType: "goal",
      entityId: goal.id,
      details: { title: goal.title },
    });
    return goal;
  });
  h("goals:update", async (_, { id, ...data }: any) => {
    const goal = await svc.goal.update(id, data);
    if (goal) {
      await svc.logActivity({
        companyId: goal.companyId,
        ...LOCAL_ACTOR,
        action: "goal.updated",
        entityType: "goal",
        entityId: goal.id,
        details: data,
      });
    }
    return goal;
  });
  h("goals:delete", async (_, { id }: any) => {
    const goal = await svc.goal.remove(id);
    if (goal) {
      await svc.logActivity({
        companyId: goal.companyId,
        ...LOCAL_ACTOR,
        action: "goal.deleted",
        entityType: "goal",
        entityId: goal.id,
      });
    }
    return goal;
  });

  // ── Approvals ─────────────────────────────────────────────────────────
  h("approvals:list", (_, { companyId, ...filters }: any) =>
    svc.approval.list(companyId, filters));
  h("approvals:get", (_, { id }: any) => svc.approval.getById(id));
  h("approvals:create", (_, args: any) => svc.approval.create(args));
  h("approvals:resolve", (_, { id, ...data }: any) => svc.approval.resolve(id, data));
  h("approvals:request-revision", (_, { id, ...data }: any) =>
    svc.approval.requestRevision(id, data));
  h("approvals:resubmit", (_, { id, ...data }: any) => svc.approval.resubmit(id, data));
  h("approvals:add-comment", (_, { id, ...data }: any) => svc.approval.addComment(id, data));

  // ── Routines ──────────────────────────────────────────────────────────
  h("routines:list", (_, { companyId }: any) => svc.routine.list(companyId));
  h("routines:get", (_, { id }: any) => svc.routine.getById(id));
  h("routines:create", (_, { companyId, ...data }: any) => svc.routine.create(companyId, data));
  h("routines:update", (_, { id, ...data }: any) => svc.routine.update(id, data));
  h("routines:run", (_, { id, ...data }: any) => svc.routine.run(id, data));
  h("routines:list-runs", (_, { id, ...params }: any) => svc.routine.listRuns(id, params));
  h("routines:create-trigger", (_, { routineId, ...data }: any) =>
    svc.routine.createTrigger(routineId, data));
  h("routines:update-trigger", (_, { triggerId, ...data }: any) =>
    svc.routine.updateTrigger(triggerId, data));
  h("routines:delete-trigger", (_, { triggerId }: any) => svc.routine.deleteTrigger(triggerId));

  // ── Costs & Finance ───────────────────────────────────────────────────
  h("costs:summary", (_, { companyId, ...params }: any) => svc.cost.summary(companyId, params));
  h("costs:by-agent", (_, { companyId, ...params }: any) => svc.cost.byAgent(companyId, params));
  h("costs:by-agent-model", (_, { companyId, ...params }: any) =>
    svc.cost.byAgentModel(companyId, params));
  h("costs:by-provider", (_, { companyId, ...params }: any) =>
    svc.cost.byProvider(companyId, params));
  h("costs:by-biller", (_, { companyId, ...params }: any) =>
    svc.cost.byBiller(companyId, params));
  h("costs:by-project", (_, { companyId, ...params }: any) =>
    svc.cost.byProject(companyId, params));
  h("costs:finance-summary", (_, { companyId, ...params }: any) =>
    svc.finance.summary(companyId, params));
  h("costs:finance-by-biller", (_, { companyId, ...params }: any) =>
    svc.finance.byBiller(companyId, params));
  h("costs:finance-by-kind", (_, { companyId, ...params }: any) =>
    svc.finance.byKind(companyId, params));
  h("costs:finance-events", (_, { companyId, ...params }: any) =>
    svc.finance.listEvents(companyId, params));
  h("costs:window-spend", (_, { companyId }: any) => svc.cost.windowSpend(companyId));
  h("costs:quota-windows", (_, { companyId }: any) => svc.cost.quotaWindows(companyId));

  // Budgets
  h("budgets:overview", (_, { companyId }: any) => svc.budget.overview(companyId));
  h("budgets:upsert-policy", (_, { companyId, ...data }: any) =>
    svc.budget.upsertPolicy(companyId, data));
  h("budgets:resolve-incident", (_, { companyId, incidentId, ...data }: any) =>
    svc.budget.resolveIncident(companyId, incidentId, data));

  // ── Secrets ───────────────────────────────────────────────────────────
  h("secrets:list", (_, { companyId }: any) => svc.secret.list(companyId));
  h("secrets:list-providers", (_, { companyId }: any) => svc.secret.listProviders(companyId));
  h("secrets:create", (_, { companyId, ...data }: any) => svc.secret.create(companyId, data));
  h("secrets:rotate", (_, { id, ...data }: any) => svc.secret.rotate(id, data));
  h("secrets:update", (_, { id, ...data }: any) => svc.secret.update(id, data));
  h("secrets:delete", (_, { id }: any) => svc.secret.remove(id));

  // ── Vault ─────────────────────────────────────────────────────────────
  h("vault:list", (_, { companyId }: any) => svc.access.listVaultCredentials(companyId));
  h("vault:get", (_, { credId }: any) => svc.access.getVaultCredential(credId));
  h("vault:create", (_, { companyId, ...data }: any) =>
    svc.access.createVaultCredential(companyId, data));
  h("vault:update", (_, { credId, ...data }: any) =>
    svc.access.updateVaultCredential(credId, data));
  h("vault:delete", (_, { credId }: any) => svc.access.revokeVaultCredential(credId));
  h("vault:checkout", (_, { credId }: any) => svc.access.checkoutVaultCredential(credId));
  h("vault:audit", (_, { credId }: any) => svc.access.auditVaultCredential(credId));

  // ── Dashboard & Activity ──────────────────────────────────────────────
  h("dashboard:summary", (_, { companyId }: any) => svc.dashboard.summary(companyId));
  h("activity:list", (_, { companyId, ...filters }: any) =>
    svc.activity.list(companyId, filters));
  h("sidebar-badges:get", (_, { companyId }: any) => svc.sidebarBadge.get(companyId, {}));

  // ── Heartbeat Runs ────────────────────────────────────────────────────
  h("heartbeat-runs:list", (_, { companyId, ...params }: any) =>
    svc.heartbeat.list(companyId, params));
  h("heartbeat-runs:get", (_, { runId }: any) => svc.heartbeat.getById(runId));
  h("heartbeat-runs:cancel", (_, { runId }: any) => svc.heartbeat.cancel(runId));
  h("heartbeat-runs:get-events", (_, { runId }: any) => svc.heartbeat.getEvents(runId));
  h("heartbeat-runs:get-log", (_, { runId }: any) => svc.heartbeat.getLog(runId));

  // ── Instance Settings ─────────────────────────────────────────────────
  h("instance:get-general-settings", () => svc.instanceSettings.getGeneral());
  h("instance:patch-general-settings", (_, data: any) =>
    svc.instanceSettings.updateGeneral(data));
  h("instance:get-experimental-settings", () => svc.instanceSettings.getExperimental());
  h("instance:patch-experimental-settings", (_, data: any) =>
    svc.instanceSettings.updateExperimental(data));
  h("instance:get-admin-settings", () => svc.instanceSettings.getAdmin());
  h("instance:patch-admin-settings", (_, data: any) => svc.instanceSettings.updateAdmin(data));

  // ── Execution Workspaces ──────────────────────────────────────────────
  h("execution-workspaces:list", (_, { companyId }: any) =>
    svc.executionWorkspace.list(companyId));
  h("execution-workspaces:get", (_, { id }: any) => svc.executionWorkspace.getById(id));
  h("execution-workspaces:update", (_, { id, ...data }: any) =>
    svc.executionWorkspace.update(id, data));

  // ── Company Skills ────────────────────────────────────────────────────
  h("company-skills:list", (_, { companyId }: any) => svc.companySkill.list(companyId));
  h("company-skills:get", (_, { companyId, skillId }: any) =>
    svc.companySkill.getDetail(companyId, skillId));
  h("company-skills:create", (_, { companyId, ...data }: any) =>
    svc.companySkill.create(companyId, data));
  h("company-skills:import", (_, { companyId, ...data }: any) =>
    svc.companySkill.importFromSource(companyId, data));

  // ── Live Events (main → renderer push) ────────────────────────────────
  // Subscribe to live events from services and push to renderer via IPC
  setupLiveEventForwarding(svc);

  console.log("[TitanClip] Service IPC handlers registered");
}

/**
 * Forward live events from the service layer to the renderer via IPC.
 * Replaces the WebSocket-based live event system.
 */
function setupLiveEventForwarding(svc: ServiceContainer): void {
  // The publishLiveEvent function in the service layer will be patched
  // to also send events to the renderer via IPC
  const originalPublish = svc.publishLiveEvent;

  // Override to also push to renderer
  const patchedPublish = (event: any) => {
    // Call original (for any in-process subscribers)
    if (typeof originalPublish === "function") {
      originalPublish(event);
    }

    // Push to renderer
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send("live:event", event);
    }

    // Trigger native notifications for important events
    handleNativeNotifications(event);
  };

  // Patch the service container
  (svc as any).publishLiveEvent = patchedPublish;
}

/**
 * Handle native OS notifications for important live events.
 */
function handleNativeNotifications(event: any): void {
  const win = getMainWindow();
  if (!win) return;

  switch (event.type) {
    case "agent.run.completed":
      notifyAgentCompleted(
        win,
        event.data?.agentName ?? "Agent",
        event.data?.issueTitle ?? "Task",
        event.data?.issueId ?? ""
      );
      break;

    case "approval.requested":
      notifyApprovalRequired(
        win,
        event.data?.agentName ?? "Agent",
        event.data?.approvalId ?? ""
      );
      break;

    case "agent.run.failed":
      notifyAgentError(
        win,
        event.data?.agentName ?? "Agent",
        event.data?.error ?? "Unknown error",
        event.data?.issueId
      );
      break;
  }
}
