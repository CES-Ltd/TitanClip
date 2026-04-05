/**
 * Session Agent Cleanup — terminates expired session agents.
 *
 * Called periodically by the heartbeat scheduler to find session agents
 * whose sessionExpiresAt has passed and terminate them.
 */

import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "@titanclip/db";
import { agents } from "@titanclip/db";
import { logActivity } from "./activity-log.js";

/**
 * Find and terminate all expired session agents.
 * Returns the count of terminated agents.
 */
export async function cleanupExpiredSessionAgents(db: Db): Promise<number> {
  const now = new Date();

  // Find expired session agents that are still active
  const expired = await db
    .select({ id: agents.id, companyId: agents.companyId, name: agents.name })
    .from(agents)
    .where(
      and(
        eq(agents.isSessionAgent, true),
        lt(agents.sessionExpiresAt, now),
        sql`${agents.status} NOT IN ('terminated')`,
      )
    );

  if (expired.length === 0) return 0;

  // Terminate each expired agent
  for (const agent of expired) {
    await db
      .update(agents)
      .set({ status: "terminated", updatedAt: now })
      .where(eq(agents.id, agent.id));

    await logActivity(db, {
      companyId: agent.companyId,
      actorType: "system",
      actorId: "session-agent-cleanup",
      action: "agent.session_expired",
      entityType: "agent",
      entityId: agent.id,
      details: {
        agentName: agent.name,
        sessionAgent: true,
        expiredAt: now.toISOString(),
      },
    });
  }

  return expired.length;
}
