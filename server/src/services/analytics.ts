import type { Db } from "@titanclip/db";
import { issues as issuesTable, heartbeatRuns, costEvents, agents as agentsTable } from "@titanclip/db";
import { eq, and, sql, gte, lte, count, desc, inArray } from "drizzle-orm";

export interface VelocityPoint {
  date: string; // YYYY-MM-DD
  completed: number;
  created: number;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

export interface WorkDistribution {
  agentId: string;
  agentName: string;
  agentRole: string;
  tasksAssigned: number;
  tasksCompleted: number;
  runCount: number;
  costCents: number;
}

export interface CostTrendPoint {
  date: string;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

export interface BudgetForecast {
  currentMonthSpendCents: number;
  projectedMonthEndCents: number;
  dailyBurnRateCents: number;
  daysRemaining: number;
  trend: "under" | "on_track" | "over";
}

export interface WorkloadForecast {
  currentOpenTasks: number;
  avgCompletionPerDay: number;
  estimatedClearDays: number;
  capacityUtilization: number; // 0-100
}

export interface AnalyticsSummary {
  velocity: VelocityPoint[];
  burndown: BurndownPoint[];
  workDistribution: WorkDistribution[];
  costTrend: CostTrendPoint[];
  budgetForecast: BudgetForecast;
  workloadForecast: WorkloadForecast;
  // Top-level metrics
  totalTasksCreated: number;
  totalTasksCompleted: number;
  avgCycleTimeMinutes: number;
  totalCostCents: number;
  totalRuns: number;
  successRate: number;
}

export function analyticsService(db: Db) {
  return {
    async getSummary(companyId: string, sinceDays = 30): Promise<AnalyticsSummary> {
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
      const now = new Date();

      // ── Velocity: tasks created vs completed per day ──
      const velocityCreated = await db.select({
        date: sql<string>`to_char(${issuesTable.createdAt}, 'YYYY-MM-DD')`,
        cnt: count(),
      }).from(issuesTable)
        .where(and(eq(issuesTable.companyId, companyId), gte(issuesTable.createdAt, since)))
        .groupBy(sql`to_char(${issuesTable.createdAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${issuesTable.createdAt}, 'YYYY-MM-DD')`);

      const velocityCompleted = await db.select({
        date: sql<string>`to_char(${issuesTable.completedAt}, 'YYYY-MM-DD')`,
        cnt: count(),
      }).from(issuesTable)
        .where(and(
          eq(issuesTable.companyId, companyId),
          gte(issuesTable.completedAt, since),
          sql`${issuesTable.completedAt} IS NOT NULL`,
        ))
        .groupBy(sql`to_char(${issuesTable.completedAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${issuesTable.completedAt}, 'YYYY-MM-DD')`);

      const createdMap = new Map(velocityCreated.map(r => [r.date, Number(r.cnt)]));
      const completedMap = new Map(velocityCompleted.map(r => [r.date, Number(r.cnt)]));
      const allDates = new Set([...createdMap.keys(), ...completedMap.keys()]);
      const velocity: VelocityPoint[] = [...allDates].sort().map(date => ({
        date,
        created: createdMap.get(date) ?? 0,
        completed: completedMap.get(date) ?? 0,
      }));

      // ── Burndown: remaining open tasks over time ──
      const [openCount] = await db.select({ cnt: count() }).from(issuesTable)
        .where(and(
          eq(issuesTable.companyId, companyId),
          sql`${issuesTable.status} NOT IN ('done', 'cancelled')`,
        ));
      const currentOpen = Number(openCount?.cnt ?? 0);

      // Simple burndown: start from total created, subtract completions day by day
      const totalCreatedInWindow = velocity.reduce((s, v) => s + v.created, 0);
      const totalCompletedInWindow = velocity.reduce((s, v) => s + v.completed, 0);
      const startingOpen = currentOpen + totalCompletedInWindow;

      const burndown: BurndownPoint[] = [];
      let remaining = startingOpen;
      const idealDecrement = velocity.length > 0 ? startingOpen / velocity.length : 0;
      for (let i = 0; i < velocity.length; i++) {
        remaining -= velocity[i].completed;
        burndown.push({
          date: velocity[i].date,
          remaining: Math.max(0, remaining),
          ideal: Math.max(0, Math.round(startingOpen - idealDecrement * (i + 1))),
        });
      }

      // ── Work Distribution by agent ──
      const agents = await db.select({
        id: agentsTable.id, name: agentsTable.name, role: agentsTable.role,
      }).from(agentsTable)
        .where(and(eq(agentsTable.companyId, companyId), sql`${agentsTable.status} != 'terminated'`));

      const agentIds = agents.map(a => a.id);

      const tasksByAgent = agentIds.length > 0 ? await db.select({
        agentId: issuesTable.assigneeAgentId,
        total: count(),
        completed: sql<number>`count(*) filter (where ${issuesTable.status} = 'done')`,
      }).from(issuesTable)
        .where(and(eq(issuesTable.companyId, companyId), inArray(issuesTable.assigneeAgentId, agentIds)))
        .groupBy(issuesTable.assigneeAgentId) : [];

      const runsByAgent = agentIds.length > 0 ? await db.select({
        agentId: heartbeatRuns.agentId,
        cnt: count(),
      }).from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.companyId, companyId), gte(heartbeatRuns.createdAt, since), inArray(heartbeatRuns.agentId, agentIds)))
        .groupBy(heartbeatRuns.agentId) : [];

      const costsByAgent = agentIds.length > 0 ? await db.select({
        agentId: costEvents.agentId,
        total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)`,
      }).from(costEvents)
        .where(and(eq(costEvents.companyId, companyId), gte(costEvents.occurredAt, since), inArray(costEvents.agentId, agentIds)))
        .groupBy(costEvents.agentId) : [];

      const taskMap = new Map(tasksByAgent.map(t => [t.agentId!, { total: Number(t.total), completed: Number(t.completed) }]));
      const runMap = new Map(runsByAgent.map(r => [r.agentId, Number(r.cnt)]));
      const costMap = new Map(costsByAgent.map(c => [c.agentId, Number(c.total)]));

      const workDistribution: WorkDistribution[] = agents.map(a => ({
        agentId: a.id,
        agentName: a.name,
        agentRole: a.role,
        tasksAssigned: taskMap.get(a.id)?.total ?? 0,
        tasksCompleted: taskMap.get(a.id)?.completed ?? 0,
        runCount: runMap.get(a.id) ?? 0,
        costCents: costMap.get(a.id) ?? 0,
      })).sort((a, b) => b.tasksAssigned - a.tasksAssigned);

      // ── Cost Trend: daily costs ──
      const dailyCosts = await db.select({
        date: sql<string>`to_char(${costEvents.occurredAt}, 'YYYY-MM-DD')`,
        costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)`,
        inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)`,
        outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)`,
      }).from(costEvents)
        .where(and(eq(costEvents.companyId, companyId), gte(costEvents.occurredAt, since)))
        .groupBy(sql`to_char(${costEvents.occurredAt}, 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${costEvents.occurredAt}, 'YYYY-MM-DD')`);

      const costTrend: CostTrendPoint[] = dailyCosts.map(r => ({
        date: r.date,
        costCents: Number(r.costCents),
        inputTokens: Number(r.inputTokens),
        outputTokens: Number(r.outputTokens),
      }));

      // ── Budget Forecast ──
      const totalCostInWindow = costTrend.reduce((s, c) => s + c.costCents, 0);
      const daysElapsed = Math.max(1, Math.ceil((now.getTime() - since.getTime()) / (24 * 60 * 60 * 1000)));
      const dailyBurnRate = Math.round(totalCostInWindow / daysElapsed);

      // Current month spend
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [monthSpend] = await db.select({
        total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)`,
      }).from(costEvents)
        .where(and(eq(costEvents.companyId, companyId), gte(costEvents.occurredAt, monthStart)));
      const currentMonthSpend = Number(monthSpend?.total ?? 0);

      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dayOfMonth = now.getDate();
      const daysRemaining = daysInMonth - dayOfMonth;
      const projectedMonthEnd = Math.round(currentMonthSpend + dailyBurnRate * daysRemaining);

      const budgetForecast: BudgetForecast = {
        currentMonthSpendCents: currentMonthSpend,
        projectedMonthEndCents: projectedMonthEnd,
        dailyBurnRateCents: dailyBurnRate,
        daysRemaining,
        trend: projectedMonthEnd === 0 ? "on_track" : "on_track", // simplified without budget target
      };

      // ── Workload Forecast ──
      const avgCompletionPerDay = totalCompletedInWindow > 0 ? Math.round((totalCompletedInWindow / daysElapsed) * 10) / 10 : 0;
      const estimatedClearDays = avgCompletionPerDay > 0 ? Math.ceil(currentOpen / avgCompletionPerDay) : 0;
      const capacityUtilization = agents.length > 0
        ? Math.min(100, Math.round((currentOpen / (agents.length * 5)) * 100)) // assume 5 tasks per agent = 100%
        : 0;

      const workloadForecast: WorkloadForecast = {
        currentOpenTasks: currentOpen,
        avgCompletionPerDay,
        estimatedClearDays,
        capacityUtilization,
      };

      // ── Top-level metrics ──
      const [totalStats] = await db.select({
        created: count(),
        completed: sql<number>`count(*) filter (where ${issuesTable.status} = 'done')`,
        avgCycle: sql<number>`avg(extract(epoch from (${issuesTable.completedAt} - ${issuesTable.startedAt})) / 60) filter (where ${issuesTable.completedAt} is not null and ${issuesTable.startedAt} is not null)`,
      }).from(issuesTable)
        .where(and(eq(issuesTable.companyId, companyId), gte(issuesTable.createdAt, since)));

      const [runStats] = await db.select({
        total: count(),
        succeeded: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'succeeded')`,
      }).from(heartbeatRuns)
        .where(and(eq(heartbeatRuns.companyId, companyId), gte(heartbeatRuns.createdAt, since)));

      const totalRuns = Number(runStats?.total ?? 0);
      const totalSucceeded = Number(runStats?.succeeded ?? 0);

      return {
        velocity,
        burndown,
        workDistribution,
        costTrend,
        budgetForecast,
        workloadForecast,
        totalTasksCreated: Number(totalStats?.created ?? 0),
        totalTasksCompleted: Number(totalStats?.completed ?? 0),
        avgCycleTimeMinutes: Math.round(Number(totalStats?.avgCycle ?? 0)),
        totalCostCents: totalCostInWindow,
        totalRuns,
        successRate: totalRuns > 0 ? Math.round((totalSucceeded / totalRuns) * 100) : 0,
      };
    },
  };
}
