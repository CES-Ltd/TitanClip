import type { Db } from "@titanclip/db";
import { agents as agentsTable, heartbeatRuns, issues as issuesTable, costEvents } from "@titanclip/db";
import { eq, and, sql, gte, count } from "drizzle-orm";

export interface AgentPerformanceMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentStatus: string;
  // Task metrics
  totalTasksAssigned: number;
  tasksCompleted: number;
  taskCompletionRate: number; // 0-100
  avgTaskDurationMinutes: number;
  // Run metrics
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  errorRate: number; // 0-100
  firstTimeSuccessRate: number; // 0-100
  // Cost metrics
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  tokenEfficiency: number; // tasks completed per 1M tokens
  // Utilization
  utilizationPercent: number; // working time / total time
  lastActiveAt: string | null;
  // Health score
  healthScore: number; // 0-100
}

function computeHealthScore(metrics: {
  taskCompletionRate: number;
  errorRate: number;
  utilizationPercent: number;
  firstTimeSuccessRate: number;
}): number {
  // Weighted composite: completion 30%, low errors 30%, utilization 20%, first-time success 20%
  const completionScore = metrics.taskCompletionRate;
  const errorScore = 100 - metrics.errorRate;
  const utilizationScore = Math.min(100, metrics.utilizationPercent);
  const firstTimeScore = metrics.firstTimeSuccessRate;
  return Math.round(
    completionScore * 0.3 + errorScore * 0.3 + utilizationScore * 0.2 + firstTimeScore * 0.2
  );
}

export function performanceService(db: Db) {
  return {
    async getAgentMetrics(companyId: string, sinceDays = 30): Promise<AgentPerformanceMetrics[]> {
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

      // Get all agents
      const agents = await db.select().from(agentsTable)
        .where(eq(agentsTable.companyId, companyId));

      const results: AgentPerformanceMetrics[] = [];

      for (const agent of agents) {
        if (agent.status === "terminated") continue;

        // Task metrics
        const [taskStats] = await db.select({
          total: count(),
          completed: sql<number>`count(*) filter (where ${issuesTable.status} = 'done')`,
          avgDuration: sql<number>`avg(extract(epoch from (${issuesTable.completedAt} - ${issuesTable.startedAt})) / 60) filter (where ${issuesTable.completedAt} is not null and ${issuesTable.startedAt} is not null)`,
        }).from(issuesTable)
          .where(and(
            eq(issuesTable.companyId, companyId),
            eq(issuesTable.assigneeAgentId, agent.id),
          ));

        const totalTasks = Number(taskStats?.total ?? 0);
        const completed = Number(taskStats?.completed ?? 0);
        const avgDuration = Number(taskStats?.avgDuration ?? 0);

        // Run metrics
        const [runStats] = await db.select({
          total: count(),
          succeeded: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'succeeded')`,
          failed: sql<number>`count(*) filter (where ${heartbeatRuns.status} in ('failed', 'timed_out'))`,
        }).from(heartbeatRuns)
          .where(and(
            eq(heartbeatRuns.companyId, companyId),
            eq(heartbeatRuns.agentId, agent.id),
            gte(heartbeatRuns.createdAt, since),
          ));

        const totalRuns = Number(runStats?.total ?? 0);
        const succeeded = Number(runStats?.succeeded ?? 0);
        const failed = Number(runStats?.failed ?? 0);

        // Cost metrics
        const [costStats] = await db.select({
          totalCost: sql<number>`coalesce(sum(${costEvents.costCents}), 0)`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)`,
        }).from(costEvents)
          .where(and(
            eq(costEvents.companyId, companyId),
            eq(costEvents.agentId, agent.id),
            gte(costEvents.occurredAt, since),
          ));

        const totalCost = Number(costStats?.totalCost ?? 0);
        const inputTokens = Number(costStats?.inputTokens ?? 0);
        const outputTokens = Number(costStats?.outputTokens ?? 0);
        const totalTokens = inputTokens + outputTokens;

        const taskCompletionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;
        const errorRate = totalRuns > 0 ? Math.round((failed / totalRuns) * 100) : 0;
        const firstTimeSuccessRate = totalRuns > 0 ? Math.round((succeeded / totalRuns) * 100) : 0;
        const tokenEfficiency = totalTokens > 0 ? Math.round((completed / (totalTokens / 1_000_000)) * 10) / 10 : 0;

        // Simple utilization: runs with duration / total time window
        const utilizationPercent = totalRuns > 0 ? Math.min(100, Math.round((totalRuns * 5) / (sinceDays * 24) * 100)) : 0;

        const metrics = { taskCompletionRate, errorRate, utilizationPercent, firstTimeSuccessRate };

        results.push({
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          agentStatus: agent.status,
          totalTasksAssigned: totalTasks,
          tasksCompleted: completed,
          taskCompletionRate,
          avgTaskDurationMinutes: Math.round(avgDuration),
          totalRuns,
          successfulRuns: succeeded,
          failedRuns: failed,
          errorRate,
          firstTimeSuccessRate,
          totalCostCents: totalCost,
          totalInputTokens: inputTokens,
          totalOutputTokens: outputTokens,
          tokenEfficiency,
          utilizationPercent,
          lastActiveAt: agent.lastHeartbeatAt?.toISOString() ?? null,
          healthScore: computeHealthScore(metrics),
        });
      }

      // Sort by health score descending
      results.sort((a, b) => b.healthScore - a.healthScore);
      return results;
    },
  };
}
