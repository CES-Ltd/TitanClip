import type { Db } from "@titanclip/db";
import { escalationRules, heartbeatRuns, agents as agentsTable, slaTracking } from "@titanclip/db";
import { eq, and, desc, gte, sql, count } from "drizzle-orm";
import type { EscalationRule } from "@titanclip/shared";

function toRule(row: typeof escalationRules.$inferSelect): EscalationRule {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description,
    trigger: row.trigger as EscalationRule["trigger"],
    triggerThreshold: row.triggerThreshold,
    action: row.action as EscalationRule["action"],
    targetAgentId: row.targetAgentId,
    notifyUserIds: (row.notifyUserIds as string[]) ?? [],
    cooldownMinutes: row.cooldownMinutes,
    enabled: row.enabled,
    lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
    fireCount: row.fireCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function escalationService(db: Db) {
  return {
    // ── CRUD ──

    async listRules(companyId: string): Promise<EscalationRule[]> {
      const rows = await db.select().from(escalationRules)
        .where(eq(escalationRules.companyId, companyId))
        .orderBy(desc(escalationRules.createdAt));
      return rows.map(toRule);
    },

    async getRule(id: string): Promise<EscalationRule | null> {
      const [row] = await db.select().from(escalationRules).where(eq(escalationRules.id, id));
      return row ? toRule(row) : null;
    },

    async createRule(companyId: string, input: {
      name: string;
      description?: string;
      trigger: string;
      triggerThreshold: number;
      action: string;
      targetAgentId?: string;
      notifyUserIds?: string[];
      cooldownMinutes?: number;
    }): Promise<EscalationRule> {
      const [row] = await db.insert(escalationRules).values({
        companyId,
        name: input.name,
        description: input.description ?? "",
        trigger: input.trigger,
        triggerThreshold: input.triggerThreshold,
        action: input.action,
        targetAgentId: input.targetAgentId ?? null,
        notifyUserIds: input.notifyUserIds ?? [],
        cooldownMinutes: input.cooldownMinutes ?? 60,
      }).returning();
      return toRule(row);
    },

    async updateRule(id: string, patch: Partial<{
      name: string;
      description: string;
      trigger: string;
      triggerThreshold: number;
      action: string;
      targetAgentId: string | null;
      notifyUserIds: string[];
      cooldownMinutes: number;
      enabled: boolean;
    }>): Promise<EscalationRule | null> {
      const [row] = await db.update(escalationRules)
        .set({ ...patch, updatedAt: new Date() } as any)
        .where(eq(escalationRules.id, id))
        .returning();
      return row ? toRule(row) : null;
    },

    async deleteRule(id: string): Promise<void> {
      await db.delete(escalationRules).where(eq(escalationRules.id, id));
    },

    // ── Evaluation (called by cron) ──

    async evaluateRules(companyId: string): Promise<{ fired: number; actions: string[] }> {
      const rules = await db.select().from(escalationRules)
        .where(and(eq(escalationRules.companyId, companyId), eq(escalationRules.enabled, true)));

      const now = new Date();
      let fired = 0;
      const actions: string[] = [];

      for (const rule of rules) {
        // Cooldown check
        if (rule.lastFiredAt) {
          const cooldownEnd = new Date(rule.lastFiredAt.getTime() + rule.cooldownMinutes * 60_000);
          if (now < cooldownEnd) continue;
        }

        let shouldFire = false;

        switch (rule.trigger) {
          case "sla_breach": {
            // Count active SLA breaches
            const [{ cnt }] = await db.select({ cnt: count() }).from(slaTracking)
              .where(and(
                eq(slaTracking.companyId, companyId),
                eq(slaTracking.status, "breached"),
              ));
            shouldFire = Number(cnt) >= rule.triggerThreshold;
            break;
          }
          case "error_count": {
            // Count recent failed runs (last hour)
            const oneHourAgo = new Date(now.getTime() - 60 * 60_000);
            const [{ cnt }] = await db.select({ cnt: count() }).from(heartbeatRuns)
              .where(and(
                eq(heartbeatRuns.companyId, companyId),
                sql`${heartbeatRuns.status} in ('failed', 'timed_out')`,
                gte(heartbeatRuns.createdAt, oneHourAgo),
              ));
            shouldFire = Number(cnt) >= rule.triggerThreshold;
            break;
          }
          case "idle_time": {
            // Check for agents idle longer than threshold (minutes)
            const threshold = new Date(now.getTime() - rule.triggerThreshold * 60_000);
            const idleAgents = await db.select().from(agentsTable)
              .where(and(
                eq(agentsTable.companyId, companyId),
                eq(agentsTable.status, "active"),
                sql`${agentsTable.lastHeartbeatAt} < ${threshold}`,
              ));
            shouldFire = idleAgents.length > 0;
            break;
          }
          case "consecutive_failures": {
            // Check if any agent has N consecutive failures
            const agents = await db.select().from(agentsTable)
              .where(and(eq(agentsTable.companyId, companyId), eq(agentsTable.status, "active")));
            for (const agent of agents) {
              const recentRuns = await db.select().from(heartbeatRuns)
                .where(and(eq(heartbeatRuns.agentId, agent.id)))
                .orderBy(desc(heartbeatRuns.createdAt))
                .limit(rule.triggerThreshold);
              if (recentRuns.length >= rule.triggerThreshold && recentRuns.every(r => r.status === "failed" || r.status === "timed_out")) {
                shouldFire = true;
                break;
              }
            }
            break;
          }
        }

        if (shouldFire) {
          fired++;
          actions.push(`${rule.name}: ${rule.action}`);
          await db.update(escalationRules)
            .set({
              lastFiredAt: now,
              fireCount: rule.fireCount + 1,
              updatedAt: now,
            })
            .where(eq(escalationRules.id, rule.id));

          // Execute action
          switch (rule.action) {
            case "pause_agent":
              if (rule.targetAgentId) {
                await db.update(agentsTable)
                  .set({ status: "paused" })
                  .where(eq(agentsTable.id, rule.targetAgentId));
              }
              break;
            case "notify":
              // In a real system, this would send notifications
              // For now we just record that the rule fired
              break;
            case "reassign":
            case "escalate_to_manager":
            case "restart_agent":
              // These would integrate with task assignment / agent lifecycle
              break;
          }
        }
      }

      return { fired, actions };
    },
  };
}
