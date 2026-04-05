import type { Db } from "@titanclip/db";
import { agentSkillProficiency, agents as agentsTable, issues as issuesTable, heartbeatRuns, costEvents } from "@titanclip/db";
import { eq, and, desc, sql, gte, count, inArray } from "drizzle-orm";
import type { AgentSkillProficiency, ProficiencyLevel, TaskSkillRequirement, RoutingCandidate, RoutingResult } from "@titanclip/shared";

function toSkill(row: typeof agentSkillProficiency.$inferSelect, agentName?: string): AgentSkillProficiency {
  return {
    id: row.id,
    companyId: row.companyId,
    agentId: row.agentId,
    agentName,
    skillName: row.skillName,
    proficiency: row.proficiency as ProficiencyLevel,
    endorsedBy: row.endorsedBy,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function skillRoutingService(db: Db) {
  return {
    // ── Skill Proficiency CRUD ──

    async listSkillsForCompany(companyId: string): Promise<AgentSkillProficiency[]> {
      const rows = await db.select().from(agentSkillProficiency)
        .where(eq(agentSkillProficiency.companyId, companyId))
        .orderBy(agentSkillProficiency.skillName, agentSkillProficiency.agentId);

      const agentIds = [...new Set(rows.map(r => r.agentId))];
      const agentMap = new Map<string, string>();
      if (agentIds.length > 0) {
        const agents = await db.select({ id: agentsTable.id, name: agentsTable.name })
          .from(agentsTable).where(inArray(agentsTable.id, agentIds));
        for (const a of agents) agentMap.set(a.id, a.name);
      }

      return rows.map(r => toSkill(r, agentMap.get(r.agentId)));
    },

    async listSkillsForAgent(agentId: string): Promise<AgentSkillProficiency[]> {
      const rows = await db.select().from(agentSkillProficiency)
        .where(eq(agentSkillProficiency.agentId, agentId))
        .orderBy(desc(agentSkillProficiency.proficiency));
      return rows.map(r => toSkill(r));
    },

    async setSkill(companyId: string, agentId: string, skillName: string, proficiency: number, opts?: {
      endorsedBy?: string;
      notes?: string;
    }): Promise<AgentSkillProficiency> {
      const now = new Date();
      const [row] = await db.insert(agentSkillProficiency)
        .values({
          companyId,
          agentId,
          skillName: skillName.toLowerCase().trim(),
          proficiency: Math.max(1, Math.min(5, proficiency)),
          endorsedBy: opts?.endorsedBy ?? null,
          notes: opts?.notes ?? "",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [agentSkillProficiency.agentId, agentSkillProficiency.skillName],
          set: {
            proficiency: Math.max(1, Math.min(5, proficiency)),
            endorsedBy: opts?.endorsedBy ?? null,
            notes: opts?.notes ?? "",
            updatedAt: now,
          },
        })
        .returning();
      return toSkill(row);
    },

    async removeSkill(id: string): Promise<void> {
      await db.delete(agentSkillProficiency).where(eq(agentSkillProficiency.id, id));
    },

    async getSkillMatrix(companyId: string): Promise<{
      agents: { id: string; name: string; role: string; status: string }[];
      skills: string[];
      matrix: Record<string, Record<string, number>>; // agentId -> skillName -> proficiency
    }> {
      const agents = await db.select({
        id: agentsTable.id, name: agentsTable.name, role: agentsTable.role, status: agentsTable.status,
      }).from(agentsTable)
        .where(and(eq(agentsTable.companyId, companyId), sql`${agentsTable.status} != 'terminated'`));

      const allSkills = await db.select().from(agentSkillProficiency)
        .where(eq(agentSkillProficiency.companyId, companyId));

      const skillNames = [...new Set(allSkills.map(s => s.skillName))].sort();
      const matrix: Record<string, Record<string, number>> = {};
      for (const agent of agents) {
        matrix[agent.id] = {};
      }
      for (const s of allSkills) {
        if (matrix[s.agentId]) {
          matrix[s.agentId][s.skillName] = s.proficiency;
        }
      }

      return { agents, skills: skillNames, matrix };
    },

    // ── Smart Task Router ──

    async routeTask(companyId: string, requirements: TaskSkillRequirement[]): Promise<RoutingResult> {
      // Get all active agents
      const agents = await db.select().from(agentsTable)
        .where(and(eq(agentsTable.companyId, companyId), sql`${agentsTable.status} in ('active', 'idle')`));

      if (agents.length === 0) {
        return { candidates: [], bestMatch: null, requirements };
      }

      const agentIds = agents.map(a => a.id);

      // Get all skills for these agents
      const skills = await db.select().from(agentSkillProficiency)
        .where(inArray(agentSkillProficiency.agentId, agentIds));
      const skillMap = new Map<string, Map<string, number>>(); // agentId -> skillName -> proficiency
      for (const s of skills) {
        if (!skillMap.has(s.agentId)) skillMap.set(s.agentId, new Map());
        skillMap.get(s.agentId)!.set(s.skillName, s.proficiency);
      }

      // Get current task counts
      const taskCounts = await db.select({
        agentId: issuesTable.assigneeAgentId,
        cnt: count(),
      }).from(issuesTable)
        .where(and(
          eq(issuesTable.companyId, companyId),
          sql`${issuesTable.status} in ('todo', 'in_progress', 'in_review')`,
          sql`${issuesTable.assigneeAgentId} is not null`,
        ))
        .groupBy(issuesTable.assigneeAgentId);
      const taskCountMap = new Map(taskCounts.map(t => [t.agentId!, Number(t.cnt)]));

      // Get recent costs (last 30 days)
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const costData = await db.select({
        agentId: costEvents.agentId,
        totalCost: sql<number>`coalesce(sum(${costEvents.costCents}), 0)`,
      }).from(costEvents)
        .where(and(
          eq(costEvents.companyId, companyId),
          gte(costEvents.occurredAt, since),
        ))
        .groupBy(costEvents.agentId);
      const costMap = new Map(costData.map(c => [c.agentId, Number(c.totalCost)]));

      // Get health scores (recent run success rates)
      const runData = await db.select({
        agentId: heartbeatRuns.agentId,
        total: count(),
        succeeded: sql<number>`count(*) filter (where ${heartbeatRuns.status} = 'succeeded')`,
      }).from(heartbeatRuns)
        .where(and(
          eq(heartbeatRuns.companyId, companyId),
          gte(heartbeatRuns.createdAt, since),
        ))
        .groupBy(heartbeatRuns.agentId);
      const healthMap = new Map<string, number>();
      for (const r of runData) {
        const total = Number(r.total);
        const succeeded = Number(r.succeeded);
        healthMap.set(r.agentId, total > 0 ? Math.round((succeeded / total) * 100) : 50);
      }

      // Score each agent
      const maxTasks = Math.max(1, ...taskCountMap.values());
      const maxCost = Math.max(1, ...costMap.values());

      const candidates: RoutingCandidate[] = agents.map(agent => {
        const agentSkills = skillMap.get(agent.id) ?? new Map<string, number>();
        const currentTasks = taskCountMap.get(agent.id) ?? 0;
        const recentCost = costMap.get(agent.id) ?? 0;
        const health = healthMap.get(agent.id) ?? 50;

        // Skill fit: average proficiency match across requirements
        let skillFitScore = 100;
        const matchedSkills: RoutingCandidate["matchedSkills"] = [];
        const missingSkills: string[] = [];

        if (requirements.length > 0) {
          let totalFit = 0;
          for (const req of requirements) {
            const prof = agentSkills.get(req.skillName) ?? 0;
            if (prof >= req.minProficiency) {
              totalFit += 100;
              matchedSkills.push({ skillName: req.skillName, proficiency: prof as ProficiencyLevel, required: req.minProficiency });
            } else if (prof > 0) {
              totalFit += (prof / req.minProficiency) * 60; // partial credit
              matchedSkills.push({ skillName: req.skillName, proficiency: prof as ProficiencyLevel, required: req.minProficiency });
            } else {
              missingSkills.push(req.skillName);
            }
          }
          skillFitScore = Math.round(totalFit / requirements.length);
        }

        // Availability: fewer current tasks = more available
        const availabilityScore = Math.round(Math.max(0, 100 - (currentTasks / Math.max(maxTasks, 5)) * 100));

        // Workload balance: prefer agents with fewer tasks
        const workloadScore = Math.round(100 - (currentTasks / Math.max(maxTasks, 1)) * 100);

        // Cost efficiency: prefer cheaper agents
        const costScore = Math.round(100 - (recentCost / Math.max(maxCost, 1)) * 100);

        // Weighted composite: skill 40%, availability 25%, workload 20%, cost 15%
        const overallScore = Math.round(
          skillFitScore * 0.4 +
          availabilityScore * 0.25 +
          workloadScore * 0.2 +
          costScore * 0.15
        );

        return {
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          agentStatus: agent.status,
          skillFitScore,
          availabilityScore,
          workloadScore,
          costScore,
          overallScore,
          matchedSkills,
          missingSkills,
          currentTaskCount: currentTasks,
          recentCostCents: recentCost,
          healthScore: health,
        };
      });

      // Sort by overall score descending
      candidates.sort((a, b) => b.overallScore - a.overallScore);

      return {
        candidates: candidates.slice(0, 10),
        bestMatch: candidates[0] ?? null,
        requirements,
      };
    },
  };
}
