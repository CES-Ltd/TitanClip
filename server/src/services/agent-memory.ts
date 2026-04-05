/**
 * Agent Memory Service — persistent memory across sessions.
 *
 * Stores user profile, preferences, project context, and learned facts.
 * Supports exact-key lookup and full-text search (semantic search via pgvector is Phase B+).
 */

import { eq, and, desc, ilike, sql } from "drizzle-orm";
import type { Db } from "@titanclip/db";
import { agentMemories } from "@titanclip/db";

export type MemoryType =
  | "user_profile"
  | "preference"
  | "project_context"
  | "learned_fact"
  | "entity"
  // Enterprise workflow memory types
  | "todo_list"       // Persistent task backlog maintained across sessions
  | "work_summary"    // Last completed work summary (auto-generated)
  | "shift_context";  // Shift handoff notes (in-progress, follow-ups)

export interface UpsertMemoryInput {
  memoryType: MemoryType;
  category?: string;
  key: string;
  content: string;
  importance?: number;
  sourceRunId?: string;
  sourceIssueId?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export function agentMemoryService(db: Db) {
  return {
    async upsert(agentId: string, companyId: string, input: UpsertMemoryInput) {
      const now = new Date();
      const existing = await db
        .select()
        .from(agentMemories)
        .where(
          and(
            eq(agentMemories.agentId, agentId),
            eq(agentMemories.memoryType, input.memoryType),
            eq(agentMemories.key, input.key),
            input.category
              ? eq(agentMemories.category, input.category)
              : sql`${agentMemories.category} IS NULL`
          )
        )
        .then((rows) => rows[0]);

      if (existing) {
        const [updated] = await db
          .update(agentMemories)
          .set({
            content: input.content,
            importance: input.importance ?? existing.importance,
            sourceRunId: input.sourceRunId ?? existing.sourceRunId,
            sourceIssueId: input.sourceIssueId ?? existing.sourceIssueId,
            expiresAt: input.expiresAt ?? existing.expiresAt,
            metadata: input.metadata ?? existing.metadata,
            updatedAt: now,
          })
          .where(eq(agentMemories.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(agentMemories)
        .values({
          companyId,
          agentId,
          memoryType: input.memoryType,
          category: input.category ?? null,
          key: input.key,
          content: input.content,
          importance: input.importance ?? 5,
          sourceRunId: input.sourceRunId ?? null,
          sourceIssueId: input.sourceIssueId ?? null,
          expiresAt: input.expiresAt ?? null,
          metadata: input.metadata ?? null,
        })
        .returning();
      return created;
    },

    async recallByKey(agentId: string, memoryType: MemoryType, category: string | null, key: string) {
      const rows = await db
        .select()
        .from(agentMemories)
        .where(
          and(
            eq(agentMemories.agentId, agentId),
            eq(agentMemories.memoryType, memoryType),
            eq(agentMemories.key, key),
            category
              ? eq(agentMemories.category, category)
              : sql`${agentMemories.category} IS NULL`
          )
        );
      return rows[0] ?? null;
    },

    async search(agentId: string, query: string, opts?: { types?: MemoryType[]; limit?: number }) {
      const limit = opts?.limit ?? 20;
      const conditions = [eq(agentMemories.agentId, agentId)];
      if (opts?.types?.length) {
        conditions.push(sql`${agentMemories.memoryType} = ANY(${opts.types})`);
      }
      // Full-text search on content
      conditions.push(ilike(agentMemories.content, `%${query}%`));

      return db
        .select()
        .from(agentMemories)
        .where(and(...conditions))
        .orderBy(desc(agentMemories.importance), desc(agentMemories.updatedAt))
        .limit(limit);
    },

    async list(agentId: string, opts?: { type?: MemoryType; category?: string; limit?: number; offset?: number }) {
      const conditions = [eq(agentMemories.agentId, agentId)];
      if (opts?.type) conditions.push(eq(agentMemories.memoryType, opts.type));
      if (opts?.category) conditions.push(eq(agentMemories.category, opts.category));

      return db
        .select()
        .from(agentMemories)
        .where(and(...conditions))
        .orderBy(desc(agentMemories.importance), desc(agentMemories.updatedAt))
        .limit(opts?.limit ?? 50)
        .offset(opts?.offset ?? 0);
    },

    async remove(id: string) {
      const [row] = await db.delete(agentMemories).where(eq(agentMemories.id, id)).returning();
      return row;
    },

    /**
     * Build a memory context string to inject into the agent's system prompt.
     * Returns the top memories sorted by importance.
     */
    async buildMemoryContext(agentId: string, opts?: { maxTokenEstimate?: number }): Promise<string> {
      const maxChars = (opts?.maxTokenEstimate ?? 2000) * 4;

      const memories = await db
        .select()
        .from(agentMemories)
        .where(eq(agentMemories.agentId, agentId))
        .orderBy(desc(agentMemories.importance), desc(agentMemories.updatedAt))
        .limit(100); // fetch more, then rank with time decay

      if (memories.length === 0) return "";

      // Apply ZeroClaw-style time decay: non-core memories lose importance over time
      const now = Date.now();
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

      const scored = memories.map((mem) => {
        let effectiveImportance = mem.importance;

        // Core memories (user_profile, preference) don't decay
        if (mem.memoryType !== "user_profile" && mem.memoryType !== "preference") {
          const ageMs = now - new Date(mem.updatedAt).getTime();
          const weeksOld = Math.floor(ageMs / ONE_WEEK_MS);
          effectiveImportance = Math.max(1, mem.importance - weeksOld);
        }

        return { ...mem, effectiveImportance };
      });

      // Sort by effective importance (decayed)
      scored.sort((a, b) => b.effectiveImportance - a.effectiveImportance);

      const sections: Record<string, string[]> = {};
      let totalChars = 0;

      for (const mem of scored) {
        if (totalChars >= maxChars) break;
        const section = mem.memoryType;
        if (!sections[section]) sections[section] = [];
        const line = mem.category ? `[${mem.category}] ${mem.key}: ${mem.content}` : `${mem.key}: ${mem.content}`;
        sections[section].push(line);
        totalChars += line.length;
      }

      const parts: string[] = [];
      const typeLabels: Record<string, string> = {
        user_profile: "About the User",
        preference: "User Preferences",
        project_context: "Project Context",
        learned_fact: "Learned Facts",
        entity: "Known Entities",
        todo_list: "Active Todo List",
        work_summary: "Last Work Summary",
        shift_context: "Shift Context",
      };

      // Enterprise workflow memories go FIRST (highest visibility)
      const priorityOrder = ["todo_list", "work_summary", "shift_context"];
      const orderedTypes = [
        ...priorityOrder.filter((t) => sections[t]),
        ...Object.keys(sections).filter((t) => !priorityOrder.includes(t)),
      ];

      for (const type of orderedTypes) {
        const lines = sections[type];
        if (lines) parts.push(`### ${typeLabels[type] ?? type}\n${lines.join("\n")}`);
      }

      return parts.join("\n\n");
    },

    async expireStale() {
      const now = new Date();
      return db
        .delete(agentMemories)
        .where(
          and(
            sql`${agentMemories.expiresAt} IS NOT NULL`,
            sql`${agentMemories.expiresAt} < ${now}`
          )
        );
    },
  };
}
