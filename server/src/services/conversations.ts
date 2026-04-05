/**
 * Conversation Service — manages conversation threads and messages.
 */

import { eq, and, desc, ilike, sql } from "drizzle-orm";
import type { Db } from "@titanclip/db";
import { conversations, conversationMessages } from "@titanclip/db";

export function conversationService(db: Db) {
  return {
    async create(companyId: string, agentId: string, opts?: {
      title?: string;
      issueId?: string;
      projectId?: string;
    }) {
      const [conv] = await db
        .insert(conversations)
        .values({
          companyId,
          agentId,
          title: opts?.title ?? null,
          issueId: opts?.issueId ?? null,
          projectId: opts?.projectId ?? null,
        })
        .returning();
      return conv;
    },

    async appendMessage(conversationId: string, companyId: string, input: {
      role: string;
      content: string;
      runId?: string;
      tokenCount?: number;
      metadata?: Record<string, unknown>;
    }) {
      const [msg] = await db
        .insert(conversationMessages)
        .values({
          conversationId,
          companyId,
          role: input.role,
          content: input.content,
          runId: input.runId ?? null,
          tokenCount: input.tokenCount ?? null,
          metadata: input.metadata ?? null,
        })
        .returning();

      // Update conversation counters
      await db
        .update(conversations)
        .set({
          messageCount: sql`${conversations.messageCount} + 1`,
          totalTokens: input.tokenCount
            ? sql`${conversations.totalTokens} + ${input.tokenCount}`
            : conversations.totalTokens,
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));

      return msg;
    },

    async list(companyId: string, opts?: {
      agentId?: string;
      issueId?: string;
      projectId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }) {
      const conditions = [eq(conversations.companyId, companyId)];
      if (opts?.agentId) conditions.push(eq(conversations.agentId, opts.agentId));
      if (opts?.issueId) conditions.push(eq(conversations.issueId, opts.issueId));
      if (opts?.projectId) conditions.push(eq(conversations.projectId, opts.projectId));
      if (opts?.status) conditions.push(eq(conversations.status, opts.status));

      return db
        .select()
        .from(conversations)
        .where(and(...conditions))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(opts?.limit ?? 50)
        .offset(opts?.offset ?? 0);
    },

    async getById(id: string) {
      const rows = await db.select().from(conversations).where(eq(conversations.id, id));
      return rows[0] ?? null;
    },

    async getMessages(conversationId: string, opts?: { limit?: number; offset?: number }) {
      return db
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, conversationId))
        .orderBy(conversationMessages.createdAt)
        .limit(opts?.limit ?? 200)
        .offset(opts?.offset ?? 0);
    },

    async search(companyId: string, query: string, opts?: { agentId?: string; limit?: number }) {
      const conditions = [
        eq(conversationMessages.companyId, companyId),
        ilike(conversationMessages.content, `%${query}%`),
      ];

      const results = await db
        .select({
          messageId: conversationMessages.id,
          conversationId: conversationMessages.conversationId,
          role: conversationMessages.role,
          content: conversationMessages.content,
          createdAt: conversationMessages.createdAt,
          conversationTitle: conversations.title,
          agentId: conversations.agentId,
        })
        .from(conversationMessages)
        .innerJoin(conversations, eq(conversationMessages.conversationId, conversations.id))
        .where(and(...conditions))
        .orderBy(desc(conversationMessages.createdAt))
        .limit(opts?.limit ?? 20);

      return results;
    },

    async updateTitle(id: string, title: string) {
      const [conv] = await db
        .update(conversations)
        .set({ title, updatedAt: new Date() })
        .where(eq(conversations.id, id))
        .returning();
      return conv;
    },

    async archive(id: string) {
      const [conv] = await db
        .update(conversations)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(conversations.id, id))
        .returning();
      return conv;
    },

    async linkToIssue(id: string, issueId: string) {
      const [conv] = await db
        .update(conversations)
        .set({ issueId, updatedAt: new Date() })
        .where(eq(conversations.id, id))
        .returning();
      return conv;
    },
  };
}
