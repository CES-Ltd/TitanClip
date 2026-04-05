/**
 * Skill Proposer — auto-generates skill proposals from successful runs.
 */

import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@titanclip/db";
import { skillProposals, skillUsageEvents } from "@titanclip/db";

export function skillProposerService(db: Db) {
  return {
    async propose(
      companyId: string,
      agentId: string,
      input: {
        title: string;
        description?: string;
        proposedMarkdown: string;
        sourceRunIds: string[];
        sourcePattern?: string;
        confidence?: string;
      }
    ) {
      const [proposal] = await db
        .insert(skillProposals)
        .values({
          companyId,
          agentId,
          title: input.title,
          description: input.description ?? null,
          proposedMarkdown: input.proposedMarkdown,
          sourceRunIds: input.sourceRunIds,
          sourcePattern: input.sourcePattern ?? null,
          confidence: input.confidence ?? "0.50",
        })
        .returning();
      return proposal;
    },

    async list(companyId: string, opts?: { status?: string; agentId?: string }) {
      const conditions = [eq(skillProposals.companyId, companyId)];
      if (opts?.status) conditions.push(eq(skillProposals.status, opts.status));
      if (opts?.agentId) conditions.push(eq(skillProposals.agentId, opts.agentId));

      return db
        .select()
        .from(skillProposals)
        .where(and(...conditions))
        .orderBy(desc(skillProposals.createdAt));
    },

    async getById(id: string) {
      const rows = await db.select().from(skillProposals).where(eq(skillProposals.id, id));
      return rows[0] ?? null;
    },

    async approve(id: string, userId: string, approvedSkillId: string) {
      const [proposal] = await db
        .update(skillProposals)
        .set({
          status: "approved",
          approvedSkillId,
          reviewedBy: userId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(skillProposals.id, id))
        .returning();
      return proposal;
    },

    async reject(id: string, userId: string) {
      const [proposal] = await db
        .update(skillProposals)
        .set({
          status: "rejected",
          reviewedBy: userId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(skillProposals.id, id))
        .returning();
      return proposal;
    },

    async recordUsage(
      companyId: string,
      skillId: string,
      agentId: string,
      runId: string,
      outcome: "success" | "partial" | "failure",
      durationMs?: number
    ) {
      const [event] = await db
        .insert(skillUsageEvents)
        .values({
          companyId,
          skillId,
          agentId,
          runId,
          outcome,
          durationMs: durationMs?.toString() ?? null,
        })
        .returning();
      return event;
    },

    async getEffectiveness(skillId: string) {
      const events = await db
        .select()
        .from(skillUsageEvents)
        .where(eq(skillUsageEvents.skillId, skillId))
        .orderBy(desc(skillUsageEvents.createdAt))
        .limit(100);

      const total = events.length;
      const success = events.filter((e) => e.outcome === "success").length;
      const partial = events.filter((e) => e.outcome === "partial").length;
      const failure = events.filter((e) => e.outcome === "failure").length;

      return {
        total,
        success,
        partial,
        failure,
        successRate: total > 0 ? success / total : 0,
      };
    },
  };
}
