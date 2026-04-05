import crypto from "node:crypto";
import type { Db } from "@titanclip/db";
import {
  onboardingWorkflows, onboardingInstances, changeRequests,
  issues as issuesTable, issueDependencies, agents as agentsTable,
  vaultTokenCheckouts,
} from "@titanclip/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type {
  OnboardingWorkflow, OnboardingStep, OnboardingInstance,
  OffboardingReport,
  ChangeRequest,
} from "@titanclip/shared";

// ── Helpers ──

function toWorkflow(row: typeof onboardingWorkflows.$inferSelect): OnboardingWorkflow {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description,
    targetRole: row.targetRole,
    steps: (row.steps as OnboardingStep[]) ?? [],
    enabled: row.enabled,
    usageCount: row.usageCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toInstance(row: typeof onboardingInstances.$inferSelect, extra?: { workflowName?: string; agentName?: string }): OnboardingInstance {
  return {
    id: row.id,
    companyId: row.companyId,
    workflowId: row.workflowId,
    workflowName: extra?.workflowName ?? "",
    agentId: row.agentId,
    agentName: extra?.agentName ?? "",
    status: row.status as OnboardingInstance["status"],
    issueIds: (row.issueIds as string[]) ?? [],
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function toChangeRequest(row: typeof changeRequests.$inferSelect, agentNames?: string[]): ChangeRequest {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    description: row.description,
    category: row.category as ChangeRequest["category"],
    risk: row.risk as ChangeRequest["risk"],
    status: row.status as ChangeRequest["status"],
    requestedByUserId: row.requestedByUserId,
    reviewerNotes: row.reviewerNotes,
    affectedAgentIds: (row.affectedAgentIds as string[]) ?? [],
    affectedAgentNames: agentNames,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    implementedAt: row.implementedAt?.toISOString() ?? null,
    rolledBackAt: row.rolledBackAt?.toISOString() ?? null,
    validationSteps: row.validationSteps,
    validationResult: row.validationResult,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function lifecycleService(db: Db) {
  return {
    // ══════════════════════════════════════
    // F6A: Onboarding Workflows
    // ══════════════════════════════════════

    async listOnboardingWorkflows(companyId: string): Promise<OnboardingWorkflow[]> {
      const rows = await db.select().from(onboardingWorkflows)
        .where(eq(onboardingWorkflows.companyId, companyId))
        .orderBy(desc(onboardingWorkflows.createdAt));
      return rows.map(toWorkflow);
    },

    async createOnboardingWorkflow(companyId: string, input: {
      name: string; description?: string; targetRole: string; steps: OnboardingStep[];
    }): Promise<OnboardingWorkflow> {
      const steps = input.steps.map(s => ({ ...s, id: s.id || crypto.randomUUID() }));
      const [row] = await db.insert(onboardingWorkflows).values({
        companyId, name: input.name, description: input.description ?? "",
        targetRole: input.targetRole, steps: steps as any,
      }).returning();
      return toWorkflow(row);
    },

    async updateOnboardingWorkflow(id: string, patch: Partial<{
      name: string; description: string; targetRole: string; steps: OnboardingStep[]; enabled: boolean;
    }>): Promise<OnboardingWorkflow | null> {
      const [row] = await db.update(onboardingWorkflows)
        .set({ ...patch, updatedAt: new Date() } as any)
        .where(eq(onboardingWorkflows.id, id)).returning();
      return row ? toWorkflow(row) : null;
    },

    async deleteOnboardingWorkflow(id: string): Promise<void> {
      await db.delete(onboardingWorkflows).where(eq(onboardingWorkflows.id, id));
    },

    // Execute onboarding for a new agent
    async executeOnboarding(companyId: string, agentId: string, workflowId: string): Promise<OnboardingInstance> {
      const [wf] = await db.select().from(onboardingWorkflows).where(eq(onboardingWorkflows.id, workflowId));
      if (!wf) throw new Error("Onboarding workflow not found");
      const steps = (wf.steps as OnboardingStep[]) ?? [];
      if (steps.length === 0) throw new Error("Workflow has no steps");

      const [agent] = await db.select({ name: agentsTable.name }).from(agentsTable).where(eq(agentsTable.id, agentId));

      const stepIdToIssueId = new Map<string, string>();
      const issueIds: string[] = [];

      for (const step of steps) {
        const assigneeAgentId = step.autoAssign ? agentId : null;
        const [issue] = await db.insert(issuesTable).values({
          companyId,
          title: `[Onboarding] ${step.title}`,
          description: step.description || null,
          priority: step.priority || "medium",
          status: step.dependsOnStepIds.length > 0 ? "blocked" : "todo",
          assigneeAgentId,
        } as any).returning();
        stepIdToIssueId.set(step.id, issue.id);
        issueIds.push(issue.id);
      }

      // Create dependencies
      for (const step of steps) {
        const targetIssueId = stepIdToIssueId.get(step.id)!;
        for (const depStepId of step.dependsOnStepIds) {
          const sourceIssueId = stepIdToIssueId.get(depStepId);
          if (sourceIssueId) {
            await db.insert(issueDependencies).values({
              companyId, sourceIssueId, targetIssueId, dependencyType: "blocks",
            });
          }
        }
      }

      // Create instance record
      const [inst] = await db.insert(onboardingInstances).values({
        companyId, workflowId, agentId, issueIds: issueIds as any,
      }).returning();

      // Increment usage count
      await db.update(onboardingWorkflows)
        .set({ usageCount: wf.usageCount + 1, updatedAt: new Date() })
        .where(eq(onboardingWorkflows.id, workflowId));

      return toInstance(inst, { workflowName: wf.name, agentName: agent?.name });
    },

    // Auto-trigger: find matching onboarding for new agent role
    async autoOnboard(companyId: string, agentId: string, agentRole: string): Promise<OnboardingInstance | null> {
      const [wf] = await db.select().from(onboardingWorkflows)
        .where(and(
          eq(onboardingWorkflows.companyId, companyId),
          eq(onboardingWorkflows.targetRole, agentRole),
          eq(onboardingWorkflows.enabled, true),
        ));
      if (!wf) return null;
      return this.executeOnboarding(companyId, agentId, wf.id);
    },

    async listOnboardingInstances(companyId: string): Promise<OnboardingInstance[]> {
      const rows = await db.select().from(onboardingInstances)
        .where(eq(onboardingInstances.companyId, companyId))
        .orderBy(desc(onboardingInstances.startedAt));

      // Enrich
      const wfIds = [...new Set(rows.map(r => r.workflowId))];
      const agentIds = [...new Set(rows.map(r => r.agentId))];
      const wfMap = new Map<string, string>();
      const agentMap = new Map<string, string>();

      if (wfIds.length > 0) {
        const wfs = await db.select({ id: onboardingWorkflows.id, name: onboardingWorkflows.name })
          .from(onboardingWorkflows).where(inArray(onboardingWorkflows.id, wfIds));
        for (const w of wfs) wfMap.set(w.id, w.name);
      }
      if (agentIds.length > 0) {
        const agents = await db.select({ id: agentsTable.id, name: agentsTable.name })
          .from(agentsTable).where(inArray(agentsTable.id, agentIds));
        for (const a of agents) agentMap.set(a.id, a.name);
      }

      return rows.map(r => toInstance(r, { workflowName: wfMap.get(r.workflowId), agentName: agentMap.get(r.agentId) }));
    },

    // ══════════════════════════════════════
    // F6B: Offboarding
    // ══════════════════════════════════════

    async offboardAgent(companyId: string, agentId: string, reassignToAgentId?: string): Promise<OffboardingReport> {
      const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
      if (!agent) throw new Error("Agent not found");

      const actions: string[] = [];

      // 1. Reassign open tasks
      const openTasks = await db.select({ id: issuesTable.id }).from(issuesTable)
        .where(and(
          eq(issuesTable.companyId, companyId),
          eq(issuesTable.assigneeAgentId, agentId),
          sql`${issuesTable.status} NOT IN ('done', 'cancelled')`,
        ));

      let reassignedName: string | null = null;
      if (openTasks.length > 0 && reassignToAgentId) {
        await db.update(issuesTable)
          .set({ assigneeAgentId: reassignToAgentId, updatedAt: new Date() })
          .where(and(
            eq(issuesTable.assigneeAgentId, agentId),
            sql`${issuesTable.status} NOT IN ('done', 'cancelled')`,
          ));
        const [target] = await db.select({ name: agentsTable.name }).from(agentsTable).where(eq(agentsTable.id, reassignToAgentId));
        reassignedName = target?.name ?? null;
        actions.push(`Reassigned ${openTasks.length} tasks to ${reassignedName}`);
      } else if (openTasks.length > 0) {
        // Unassign tasks
        await db.update(issuesTable)
          .set({ assigneeAgentId: null, updatedAt: new Date() })
          .where(and(
            eq(issuesTable.assigneeAgentId, agentId),
            sql`${issuesTable.status} NOT IN ('done', 'cancelled')`,
          ));
        actions.push(`Unassigned ${openTasks.length} open tasks`);
      }

      // 2. Revoke active vault checkouts
      const [checkoutCount] = await db.select({ cnt: sql<number>`count(*)` })
        .from(vaultTokenCheckouts)
        .where(and(eq(vaultTokenCheckouts.agentId, agentId), eq(vaultTokenCheckouts.status, "active")));
      const revokedCheckouts = Number(checkoutCount?.cnt ?? 0);
      if (revokedCheckouts > 0) {
        await db.update(vaultTokenCheckouts)
          .set({ status: "revoked" })
          .where(and(eq(vaultTokenCheckouts.agentId, agentId), eq(vaultTokenCheckouts.status, "active")));
        actions.push(`Revoked ${revokedCheckouts} active vault checkouts`);
      }

      // 3. Terminate agent
      await db.update(agentsTable)
        .set({ status: "terminated" })
        .where(eq(agentsTable.id, agentId));
      actions.push("Agent status set to terminated");

      return {
        agentId,
        agentName: agent.name,
        agentRole: agent.role,
        openTasksReassigned: openTasks.length,
        reassignedToAgentId: reassignToAgentId ?? null,
        reassignedToAgentName: reassignedName,
        vaultCheckoutsRevoked: revokedCheckouts,
        status: "terminated",
        offboardedAt: new Date().toISOString(),
        actions,
      };
    },

    // ══════════════════════════════════════
    // F6C: Change Management
    // ══════════════════════════════════════

    async listChangeRequests(companyId: string, status?: string): Promise<ChangeRequest[]> {
      const conditions = [eq(changeRequests.companyId, companyId)];
      if (status) conditions.push(eq(changeRequests.status, status));

      const rows = await db.select().from(changeRequests)
        .where(and(...conditions))
        .orderBy(desc(changeRequests.createdAt))
        .limit(200);

      // Enrich agent names
      const allAgentIds = [...new Set(rows.flatMap(r => (r.affectedAgentIds as string[]) ?? []))];
      const agentMap = new Map<string, string>();
      if (allAgentIds.length > 0) {
        const agents = await db.select({ id: agentsTable.id, name: agentsTable.name })
          .from(agentsTable).where(inArray(agentsTable.id, allAgentIds));
        for (const a of agents) agentMap.set(a.id, a.name);
      }

      return rows.map(r => {
        const agentIds = (r.affectedAgentIds as string[]) ?? [];
        return toChangeRequest(r, agentIds.map(id => agentMap.get(id) ?? "Unknown"));
      });
    },

    async createChangeRequest(companyId: string, input: {
      title: string; description?: string; category: string; risk: string;
      affectedAgentIds?: string[]; scheduledAt?: string; validationSteps?: string;
      requestedByUserId?: string;
    }): Promise<ChangeRequest> {
      const [row] = await db.insert(changeRequests).values({
        companyId,
        title: input.title,
        description: input.description ?? "",
        category: input.category,
        risk: input.risk,
        affectedAgentIds: input.affectedAgentIds ?? [],
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        validationSteps: input.validationSteps ?? "",
        requestedByUserId: input.requestedByUserId ?? "board",
      }).returning();
      return toChangeRequest(row);
    },

    async updateChangeRequest(id: string, patch: Partial<{
      title: string; description: string; category: string; risk: string;
      status: string; reviewerNotes: string; affectedAgentIds: string[];
      scheduledAt: string | null; validationSteps: string; validationResult: string | null;
    }>): Promise<ChangeRequest | null> {
      const updates: any = { ...patch, updatedAt: new Date() };
      if (patch.status === "implemented") updates.implementedAt = new Date();
      if (patch.status === "rolled_back") updates.rolledBackAt = new Date();
      if (patch.scheduledAt !== undefined) updates.scheduledAt = patch.scheduledAt ? new Date(patch.scheduledAt) : null;

      const [row] = await db.update(changeRequests)
        .set(updates)
        .where(eq(changeRequests.id, id)).returning();
      return row ? toChangeRequest(row) : null;
    },

    async deleteChangeRequest(id: string): Promise<void> {
      await db.delete(changeRequests).where(eq(changeRequests.id, id));
    },
  };
}
