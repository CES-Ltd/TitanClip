import { api } from "./client";

export interface VelocityPoint { date: string; completed: number; created: number; }
export interface BurndownPoint { date: string; remaining: number; ideal: number; }
export interface WorkDistribution { agentId: string; agentName: string; agentRole: string; tasksAssigned: number; tasksCompleted: number; runCount: number; costCents: number; }
export interface CostTrendPoint { date: string; costCents: number; inputTokens: number; outputTokens: number; }
export interface BudgetForecast { currentMonthSpendCents: number; projectedMonthEndCents: number; dailyBurnRateCents: number; daysRemaining: number; trend: string; }
export interface WorkloadForecast { currentOpenTasks: number; avgCompletionPerDay: number; estimatedClearDays: number; capacityUtilization: number; }

export interface AnalyticsSummary {
  velocity: VelocityPoint[];
  burndown: BurndownPoint[];
  workDistribution: WorkDistribution[];
  costTrend: CostTrendPoint[];
  budgetForecast: BudgetForecast;
  workloadForecast: WorkloadForecast;
  totalTasksCreated: number;
  totalTasksCompleted: number;
  avgCycleTimeMinutes: number;
  totalCostCents: number;
  totalRuns: number;
  successRate: number;
}

export const analyticsApi = {
  getSummary: (companyId: string, sinceDays = 30) =>
    api.get<AnalyticsSummary>(`/companies/${encodeURIComponent(companyId)}/analytics?sinceDays=${sinceDays}`),
};
