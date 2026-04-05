import type { Db } from "@titanclip/db";
import { chatterMessages } from "@titanclip/db";
import { eq, and, desc, lt } from "drizzle-orm";
import type { ChatterMessage } from "@titanclip/shared";
import { publishLiveEvent } from "./live-events.js";

function toChatterMessage(row: typeof chatterMessages.$inferSelect): ChatterMessage {
  return {
    id: row.id,
    companyId: row.companyId,
    channel: row.channel,
    messageType: row.messageType as ChatterMessage["messageType"],
    authorAgentId: row.authorAgentId,
    authorUserId: row.authorUserId,
    body: row.body,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    issueId: row.issueId,
    runId: row.runId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function chatterService(db: Db) {
  return {
    async postMessage(companyId: string, input: {
      channel?: string;
      messageType?: string;
      authorAgentId?: string | null;
      authorUserId?: string | null;
      body: string;
      metadata?: Record<string, unknown>;
      issueId?: string | null;
      runId?: string | null;
    }): Promise<ChatterMessage> {
      const [row] = await db.insert(chatterMessages).values({
        companyId,
        channel: input.channel ?? "general",
        messageType: input.messageType ?? "text",
        authorAgentId: input.authorAgentId ?? null,
        authorUserId: input.authorUserId ?? null,
        body: input.body,
        metadata: input.metadata ?? {},
        issueId: input.issueId ?? null,
        runId: input.runId ?? null,
      }).returning();

      const msg = toChatterMessage(row);

      // Publish live event
      publishLiveEvent({
        companyId,
        type: "activity.logged" as any, // Reuse existing event type for UI invalidation
        payload: {
          action: "chatter.message",
          entityType: "chatter",
          entityId: msg.id,
          details: { channel: msg.channel, messageType: msg.messageType, body: msg.body.slice(0, 100) },
        },
      });

      return msg;
    },

    async listMessages(companyId: string, channel = "general", cursor?: string, limit = 50): Promise<ChatterMessage[]> {
      const conditions = [
        eq(chatterMessages.companyId, companyId),
        eq(chatterMessages.channel, channel),
      ];
      if (cursor) {
        conditions.push(lt(chatterMessages.createdAt, new Date(cursor)));
      }
      const rows = await db.select().from(chatterMessages)
        .where(and(...conditions))
        .orderBy(desc(chatterMessages.createdAt))
        .limit(limit);
      return rows.map(toChatterMessage).reverse(); // Return in chronological order
    },
  };
}
