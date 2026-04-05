import { api } from "./client";

export interface AgentPerformanceMetrics {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentStatus: string;
  totalTasksAssigned: number;
  tasksCompleted: number;
  taskCompletionRate: number;
  avgTaskDurationMinutes: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  errorRate: number;
  firstTimeSuccessRate: number;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  tokenEfficiency: number;
  utilizationPercent: number;
  lastActiveAt: string | null;
  healthScore: number;
}

export const performanceApi = {
  getMetrics: (companyId: string, sinceDays = 30) =>
    api.get<AgentPerformanceMetrics[]>(
      `/companies/${encodeURIComponent(companyId)}/performance?sinceDays=${sinceDays}`
    ),
};
