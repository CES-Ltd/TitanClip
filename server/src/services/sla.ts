import type { Db } from "@titanclip/db";
import { slaPolicies, slaTracking, issues as issuesTable, agents as agentsTable } from "@titanclip/db";
import { eq, and, sql, desc, count, inArray } from "drizzle-orm";
import type { SlaPolicy, SlaTracking, SlaDashboardSummary } from "@titanclip/shared";

function toPolicy(row: typeof slaPolicies.$inferSelect): SlaPolicy {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description,
    priority: row.priority as SlaPolicy["priority"],
    targetResponseMinutes: row.targetResponseMinutes,
    targetResolutionMinutes: row.targetResolutionMinutes,
    breachAction: row.breachAction as SlaPolicy["breachAction"],
    escalateToAgentId: row.escalateToAgentId,
    notifyUserIds: (row.notifyUserIds as string[]) ?? [],
    isDefault: row.isDefault,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTracking(row: typeof slaTracking.$inferSelect, extra?: { issueTitle?: string; issuePriority?: string; assigneeAgentId?: string; assigneeAgentName?: string; policyName?: string }): SlaTracking {
  return {
    id: row.id,
    companyId: row.companyId,
    issueId: row.issueId,
    policyId: row.policyId,
    policyName: extra?.policyName ?? "",
    status: row.status as SlaTracking["status"],
    clockStartedAt: row.clockStartedAt.toISOString(),
    clockPausedAt: row.clockPausedAt?.toISOString() ?? null,
    totalPausedMinutes: row.totalPausedMinutes,
    responseDeadline: row.responseDeadline.toISOString(),
    resolutionDeadline: row.resolutionDeadline.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    responseBreached: row.responseBreached,
    resolutionBreached: row.resolutionBreached,
    breachNotifiedAt: row.breachNotifiedAt?.toISOString() ?? null,
    breachActionTaken: row.breachActionTaken,
    issueTitle: extra?.issueTitle ?? null,
    issuePriority: extra?.issuePriority ?? null,
    assigneeAgentId: extra?.assigneeAgentId ?? null,
    assigneeAgentName: extra?.assigneeAgentName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function slaService(db: Db) {
  return {
    // ── SLA Policies CRUD ──

    async listPolicies(companyId: string): Promise<SlaPolicy[]> {
      const rows = await db.select().from(slaPolicies)
        .where(eq(slaPolicies.companyId, companyId))
        .orderBy(desc(slaPolicies.createdAt));
      return rows.map(toPolicy);
    },

    async getPolicy(id: string): Promise<SlaPolicy | null> {
      const [row] = await db.select().from(slaPolicies).where(eq(slaPolicies.id, id));
      return row ? toPolicy(row) : null;
    },

    async createPolicy(companyId: string, input: {
      name: string;
      description?: string;
      priority: string;
      targetResponseMinutes: number;
      targetResolutionMinutes: number;
      breachAction: string;
      escalateToAgentId?: string;
      notifyUserIds?: string[];
      isDefault?: boolean;
    }): Promise<SlaPolicy> {
      // If setting as default, unset other defaults for same priority
      if (input.isDefault) {
        await db.update(slaPolicies)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(and(
            eq(slaPolicies.companyId, companyId),
            eq(slaPolicies.priority, input.priority),
            eq(slaPolicies.isDefault, true),
          ));
      }
      const [row] = await db.insert(slaPolicies).values({
        companyId,
        name: input.name,
        description: input.description ?? "",
        priority: input.priority,
        targetResponseMinutes: input.targetResponseMinutes,
        targetResolutionMinutes: input.targetResolutionMinutes,
        breachAction: input.breachAction,
        escalateToAgentId: input.escalateToAgentId ?? null,
        notifyUserIds: input.notifyUserIds ?? [],
        isDefault: input.isDefault ?? false,
      }).returning();
      return toPolicy(row);
    },

    async updatePolicy(id: string, patch: Partial<{
      name: string;
      description: string;
      priority: string;
      targetResponseMinutes: number;
      targetResolutionMinutes: number;
      breachAction: string;
      escalateToAgentId: string | null;
      notifyUserIds: string[];
      isDefault: boolean;
      enabled: boolean;
    }>): Promise<SlaPolicy | null> {
      const [row] = await db.update(slaPolicies)
        .set({ ...patch, updatedAt: new Date() } as any)
        .where(eq(slaPolicies.id, id))
        .returning();
      return row ? toPolicy(row) : null;
    },

    async deletePolicy(id: string): Promise<void> {
      await db.delete(slaPolicies).where(eq(slaPolicies.id, id));
    },

    // ── SLA Tracking ──

    async startTracking(companyId: string, issueId: string, policyId: string): Promise<SlaTracking> {
      const policy = await db.select().from(slaPolicies).where(eq(slaPolicies.id, policyId)).then(r => r[0]);
      if (!policy) throw new Error("SLA policy not found");

      const now = new Date();
      const responseDeadline = new Date(now.getTime() + policy.targetResponseMinutes * 60_000);
      const resolutionDeadline = new Date(now.getTime() + policy.targetResolutionMinutes * 60_000);

      const [row] = await db.insert(slaTracking).values({
        companyId,
        issueId,
        policyId,
        clockStartedAt: now,
        responseDeadline,
        resolutionDeadline,
      }).returning();
      return toTracking(row, { policyName: policy.name });
    },

    async autoAttachSla(companyId: string, issueId: string, priority: string): Promise<SlaTracking | null> {
      // Find default policy for this priority
      const [policy] = await db.select().from(slaPolicies)
        .where(and(
          eq(slaPolicies.companyId, companyId),
          eq(slaPolicies.priority, priority),
          eq(slaPolicies.isDefault, true),
          eq(slaPolicies.enabled, true),
        ));
      if (!policy) return null;

      // Check if already tracking
      const [existing] = await db.select().from(slaTracking)
        .where(and(eq(slaTracking.issueId, issueId), inArray(slaTracking.status, ["running", "paused"])));
      if (existing) return null;

      const now = new Date();
      const [row] = await db.insert(slaTracking).values({
        companyId,
        issueId,
        policyId: policy.id,
        clockStartedAt: now,
        responseDeadline: new Date(now.getTime() + policy.targetResponseMinutes * 60_000),
        resolutionDeadline: new Date(now.getTime() + policy.targetResolutionMinutes * 60_000),
      }).returning();
      return toTracking(row, { policyName: policy.name });
    },

    async pauseTracking(issueId: string): Promise<void> {
      const now = new Date();
      await db.update(slaTracking)
        .set({ status: "paused", clockPausedAt: now, updatedAt: now })
        .where(and(eq(slaTracking.issueId, issueId), eq(slaTracking.status, "running")));
    },

    async resumeTracking(issueId: string): Promise<void> {
      const [row] = await db.select().from(slaTracking)
        .where(and(eq(slaTracking.issueId, issueId), eq(slaTracking.status, "paused")));
      if (!row || !row.clockPausedAt) return;

      const pausedMs = Date.now() - row.clockPausedAt.getTime();
      const additionalMinutes = Math.floor(pausedMs / 60_000);
      const now = new Date();

      await db.update(slaTracking)
        .set({
          status: "running",
          clockPausedAt: null,
          totalPausedMinutes: row.totalPausedMinutes + additionalMinutes,
          // Extend deadlines by the paused duration
          responseDeadline: new Date(row.responseDeadline.getTime() + pausedMs),
          resolutionDeadline: new Date(row.resolutionDeadline.getTime() + pausedMs),
          updatedAt: now,
        })
        .where(eq(slaTracking.id, row.id));
    },

    async markResponded(issueId: string): Promise<void> {
      const now = new Date();
      await db.update(slaTracking)
        .set({ respondedAt: now, updatedAt: now })
        .where(and(
          eq(slaTracking.issueId, issueId),
          sql`${slaTracking.respondedAt} IS NULL`,
          inArray(slaTracking.status, ["running", "paused"]),
        ));
    },

    async markResolved(issueId: string): Promise<void> {
      const now = new Date();
      await db.update(slaTracking)
        .set({ status: "completed", resolvedAt: now, updatedAt: now })
        .where(and(
          eq(slaTracking.issueId, issueId),
          inArray(slaTracking.status, ["running", "paused"]),
        ));
    },

    async getTrackingForIssue(issueId: string): Promise<SlaTracking | null> {
      const [row] = await db.select().from(slaTracking)
        .where(eq(slaTracking.issueId, issueId))
        .orderBy(desc(slaTracking.createdAt))
        .limit(1);
      if (!row) return null;
      const [policy] = await db.select().from(slaPolicies).where(eq(slaPolicies.id, row.policyId));
      return toTracking(row, { policyName: policy?.name ?? "Unknown" });
    },

    async listTracking(companyId: string, opts?: { status?: string }): Promise<SlaTracking[]> {
      const conditions = [eq(slaTracking.companyId, companyId)];
      if (opts?.status) conditions.push(eq(slaTracking.status, opts.status));

      const rows = await db.select().from(slaTracking)
        .where(and(...conditions))
        .orderBy(desc(slaTracking.createdAt))
        .limit(200);

      // Enrich with issue + policy data
      const issueIds = [...new Set(rows.map(r => r.issueId))];
      const policyIds = [...new Set(rows.map(r => r.policyId))];

      const issueMap = new Map<string, { title: string; priority: string; assigneeAgentId: string | null }>();
      if (issueIds.length > 0) {
        const issues = await db.select({
          id: issuesTable.id,
          title: issuesTable.title,
          priority: issuesTable.priority,
          assigneeAgentId: issuesTable.assigneeAgentId,
        }).from(issuesTable).where(inArray(issuesTable.id, issueIds));
        for (const i of issues) issueMap.set(i.id, i);
      }

      const policyMap = new Map<string, string>();
      if (policyIds.length > 0) {
        const policies = await db.select({ id: slaPolicies.id, name: slaPolicies.name })
          .from(slaPolicies).where(inArray(slaPolicies.id, policyIds));
        for (const p of policies) policyMap.set(p.id, p.name);
      }

      // Get agent names
      const agentIds = [...new Set([...issueMap.values()].filter(i => i.assigneeAgentId).map(i => i.assigneeAgentId!))];
      const agentMap = new Map<string, string>();
      if (agentIds.length > 0) {
        const agents = await db.select({ id: agentsTable.id, name: agentsTable.name })
          .from(agentsTable).where(inArray(agentsTable.id, agentIds));
        for (const a of agents) agentMap.set(a.id, a.name);
      }

      return rows.map(row => {
        const issue = issueMap.get(row.issueId);
        return toTracking(row, {
          policyName: policyMap.get(row.policyId) ?? "Unknown",
          issueTitle: issue?.title,
          issuePriority: issue?.priority,
          assigneeAgentId: issue?.assigneeAgentId ?? undefined,
          assigneeAgentName: issue?.assigneeAgentId ? agentMap.get(issue.assigneeAgentId) : undefined,
        });
      });
    },

    // ── Breach check (called by cron) ──

    async checkBreaches(companyId: string): Promise<{ newBreaches: number }> {
      const now = new Date();
      let newBreaches = 0;

      // Find running SLAs that have passed their deadlines
      const running = await db.select().from(slaTracking)
        .where(and(
          eq(slaTracking.companyId, companyId),
          eq(slaTracking.status, "running"),
        ));

      for (const row of running) {
        let breached = false;

        if (!row.responseBreached && !row.respondedAt && now > row.responseDeadline) {
          breached = true;
          await db.update(slaTracking)
            .set({ responseBreached: true, updatedAt: now })
            .where(eq(slaTracking.id, row.id));
        }

        if (!row.resolutionBreached && now > row.resolutionDeadline) {
          breached = true;
          await db.update(slaTracking)
            .set({
              resolutionBreached: true,
              status: "breached",
              breachNotifiedAt: now,
              updatedAt: now,
            })
            .where(eq(slaTracking.id, row.id));
        }

        if (breached) {
          newBreaches++;
          // Execute breach action from policy
          const [policy] = await db.select().from(slaPolicies).where(eq(slaPolicies.id, row.policyId));
          if (policy) {
            await db.update(slaTracking)
              .set({ breachActionTaken: policy.breachAction, updatedAt: now })
              .where(eq(slaTracking.id, row.id));
          }
        }
      }

      return { newBreaches };
    },

    // ── Dashboard Summary ──

    async getDashboardSummary(companyId: string): Promise<SlaDashboardSummary> {
      const all = await db.select().from(slaTracking)
        .where(eq(slaTracking.companyId, companyId));

      const now = new Date();
      let onTrack = 0;
      let atRisk = 0;
      let breached = 0;
      let totalResponseMs = 0;
      let responseCount = 0;
      let totalResolutionMs = 0;
      let resolutionCount = 0;

      for (const row of all) {
        if (row.status === "breached" || row.responseBreached || row.resolutionBreached) {
          breached++;
        } else if (row.status === "running") {
          // Check if at risk (>80% of deadline elapsed)
          const resElapsed = now.getTime() - row.clockStartedAt.getTime();
          const resTotal = row.resolutionDeadline.getTime() - row.clockStartedAt.getTime();
          if (resTotal > 0 && resElapsed / resTotal > 0.8) {
            atRisk++;
          } else {
            onTrack++;
          }
        } else if (row.status === "completed") {
          onTrack++;
        } else {
          onTrack++; // paused counts as on track
        }

        if (row.respondedAt) {
          totalResponseMs += row.respondedAt.getTime() - row.clockStartedAt.getTime();
          responseCount++;
        }
        if (row.resolvedAt) {
          totalResolutionMs += row.resolvedAt.getTime() - row.clockStartedAt.getTime();
          resolutionCount++;
        }
      }

      const totalTracked = all.length;
      const complianceRate = totalTracked > 0 ? Math.round(((totalTracked - breached) / totalTracked) * 100) : 100;
      const avgResponseMinutes = responseCount > 0 ? Math.round(totalResponseMs / responseCount / 60_000) : 0;
      const avgResolutionMinutes = resolutionCount > 0 ? Math.round(totalResolutionMs / resolutionCount / 60_000) : 0;

      // Get active breaches with enrichment
      const activeBreachRows = all.filter(r => r.status === "breached" || (r.status === "running" && (r.responseBreached || r.resolutionBreached)));
      const issueIds = [...new Set(activeBreachRows.map(r => r.issueId))];
      const issueMap = new Map<string, { title: string; priority: string }>();
      if (issueIds.length > 0) {
        const issues = await db.select({ id: issuesTable.id, title: issuesTable.title, priority: issuesTable.priority })
          .from(issuesTable).where(inArray(issuesTable.id, issueIds));
        for (const i of issues) issueMap.set(i.id, i);
      }
      const policyIds = [...new Set(activeBreachRows.map(r => r.policyId))];
      const policyMap = new Map<string, string>();
      if (policyIds.length > 0) {
        const policies = await db.select({ id: slaPolicies.id, name: slaPolicies.name })
          .from(slaPolicies).where(inArray(slaPolicies.id, policyIds));
        for (const p of policies) policyMap.set(p.id, p.name);
      }

      const activeBreaches = activeBreachRows.map(r => {
        const issue = issueMap.get(r.issueId);
        return toTracking(r, {
          policyName: policyMap.get(r.policyId) ?? "Unknown",
          issueTitle: issue?.title,
          issuePriority: issue?.priority,
        });
      });

      return { totalTracked, onTrack, atRisk, breached, complianceRate, avgResponseMinutes, avgResolutionMinutes, activeBreaches };
    },
  };
}
