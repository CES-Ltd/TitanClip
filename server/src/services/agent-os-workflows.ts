/**
 * Agent OS Enterprise Workflows — mandatory automated workflows.
 *
 * These run on schedule to ensure the Agent OS main agent behaves like
 * a reliable always-on employee:
 *
 * 1. Morning Standup — summarize yesterday, plan today
 * 2. End-of-Day Summary — wrap up, update todo, create shift context
 * 3. Stale Task Alerting — flag tasks not updated in 24h+
 * 4. Team Status Check — monitor all agents' health
 */

import { eq, and, lt, sql, desc } from "drizzle-orm";
import type { Db } from "@titanclip/db";
import { agents, heartbeatRuns, issues } from "@titanclip/db";
import { logActivity } from "./activity-log.js";
import { agentMemoryService } from "./agent-memory.js";

/**
 * Morning Standup — generates a daily standup summary.
 * Called by the routine scheduler at the configured morning time.
 */
export async function runMorningStandup(db: Db, companyId: string, agentId: string): Promise<string> {
  const memorySvc = agentMemoryService(db);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get yesterday's completed runs
  const recentRuns = await db
    .select({
      id: heartbeatRuns.id,
      status: heartbeatRuns.status,
      agentId: heartbeatRuns.agentId,
      startedAt: heartbeatRuns.startedAt,
      finishedAt: heartbeatRuns.finishedAt,
    })
    .from(heartbeatRuns)
    .where(and(
      eq(heartbeatRuns.companyId, companyId),
      sql`${heartbeatRuns.createdAt} >= ${yesterday}`,
    ))
    .orderBy(desc(heartbeatRuns.createdAt))
    .limit(50);

  const completed = recentRuns.filter((r) => r.status === "completed").length;
  const failed = recentRuns.filter((r) => r.status === "failed").length;
  const running = recentRuns.filter((r) => r.status === "running").length;

  // Get open issues
  const openIssues = await db
    .select({ id: issues.id, title: issues.title, status: issues.status, priority: issues.priority })
    .from(issues)
    .where(and(
      eq(issues.companyId, companyId),
      sql`${issues.status} IN ('backlog', 'todo', 'in_progress', 'in_review', 'blocked')`,
    ))
    .limit(20);

  const blocked = openIssues.filter((i) => i.status === "blocked").length;
  const inProgress = openIssues.filter((i) => i.status === "in_progress").length;

  const standup = [
    `## Daily Standup — ${new Date().toLocaleDateString()}`,
    "",
    `### Yesterday's Activity`,
    `- ${completed} runs completed, ${failed} failed, ${running} still running`,
    `- ${recentRuns.length} total agent runs in the last 24 hours`,
    "",
    `### Current Status`,
    `- ${openIssues.length} open issues (${inProgress} in progress, ${blocked} blocked)`,
    ...openIssues.slice(0, 5).map((i) => `  - [${i.status}] ${i.title}`),
    openIssues.length > 5 ? `  - ... and ${openIssues.length - 5} more` : "",
    "",
    `### Blockers`,
    blocked > 0 ? openIssues.filter((i) => i.status === "blocked").map((i) => `  - ${i.title}`).join("\n") : "  - None",
  ].filter(Boolean).join("\n");

  // Store as memory
  await memorySvc.upsert(agentId, companyId, {
    memoryType: "work_summary",
    key: `standup:${new Date().toISOString().split("T")[0]}`,
    content: standup,
    importance: 8,
  });

  // Log activity
  await logActivity(db, {
    companyId,
    actorType: "system",
    actorId: "agent-os-workflows",
    action: "agent.daily_standup",
    entityType: "agent",
    entityId: agentId,
    details: { completed, failed, running, openIssues: openIssues.length, blocked },
  });

  return standup;
}

/**
 * Stale Task Alerting — checks for tasks not updated in 24+ hours.
 */
export async function checkStaleTasks(db: Db, companyId: string, agentId: string): Promise<string[]> {
  const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const staleIssues = await db
    .select({ id: issues.id, title: issues.title, status: issues.status, updatedAt: issues.updatedAt })
    .from(issues)
    .where(and(
      eq(issues.companyId, companyId),
      sql`${issues.status} IN ('in_progress', 'in_review')`,
      lt(issues.updatedAt, staleThreshold),
    ))
    .limit(20);

  if (staleIssues.length === 0) return [];

  const alerts: string[] = [];
  for (const issue of staleIssues) {
    const hoursStale = Math.round((Date.now() - new Date(issue.updatedAt).getTime()) / (60 * 60 * 1000));
    alerts.push(`${issue.title} — stale for ${hoursStale}h (status: ${issue.status})`);
  }

  // Log activity
  await logActivity(db, {
    companyId,
    actorType: "system",
    actorId: "agent-os-workflows",
    action: "agent.stale_tasks_detected",
    entityType: "agent",
    entityId: agentId,
    details: { staleCount: staleIssues.length, alerts },
  });

  return alerts;
}

/**
 * Team Status Check — monitors all agents' health.
 */
export async function checkTeamStatus(db: Db, companyId: string): Promise<{
  healthy: number;
  paused: number;
  failed: number;
  details: Array<{ name: string; status: string; lastError?: string }>;
}> {
  const allAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      status: agents.status,
      pauseReason: agents.pauseReason,
    })
    .from(agents)
    .where(and(
      eq(agents.companyId, companyId),
      sql`${agents.status} != 'terminated'`,
    ));

  const healthy = allAgents.filter((a) => a.status === "idle" || a.status === "running").length;
  const paused = allAgents.filter((a) => a.status === "paused").length;
  const failed = allAgents.filter((a) => a.pauseReason === "budget" || a.pauseReason === "system").length;

  const details = allAgents.map((a) => ({
    name: a.name,
    status: a.status,
    lastError: a.pauseReason ?? undefined,
  }));

  // Log activity
  await logActivity(db, {
    companyId,
    actorType: "system",
    actorId: "agent-os-workflows",
    action: "agent.team_status_check",
    entityType: "company",
    entityId: companyId,
    details: { healthy, paused, failed, total: allAgents.length },
  });

  return { healthy, paused, failed, details };
}
