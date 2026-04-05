import type { Db } from "@titanclip/db";
import { teamRoles } from "@titanclip/db";
import { eq, and, desc } from "drizzle-orm";
import type { TeamRole } from "@titanclip/shared";

function toTeamRole(row: typeof teamRoles.$inferSelect): TeamRole {
  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    role: row.role as TeamRole["role"],
    assignedBy: row.assignedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function teamRoleService(db: Db) {
  return {
    async list(companyId: string): Promise<TeamRole[]> {
      const rows = await db.select().from(teamRoles)
        .where(eq(teamRoles.companyId, companyId))
        .orderBy(desc(teamRoles.createdAt));
      return rows.map(toTeamRole);
    },

    async getForUser(companyId: string, userId: string): Promise<TeamRole | null> {
      const [row] = await db.select().from(teamRoles)
        .where(and(eq(teamRoles.companyId, companyId), eq(teamRoles.userId, userId)));
      return row ? toTeamRole(row) : null;
    },

    async assign(companyId: string, userId: string, role: string, assignedBy?: string): Promise<TeamRole> {
      const existing = await this.getForUser(companyId, userId);
      if (existing) {
        const [updated] = await db.update(teamRoles)
          .set({ role, assignedBy: assignedBy ?? null, updatedAt: new Date() })
          .where(eq(teamRoles.id, existing.id))
          .returning();
        return toTeamRole(updated);
      }
      const [created] = await db.insert(teamRoles).values({
        companyId, userId, role,
        assignedBy: assignedBy ?? null,
        createdAt: new Date(), updatedAt: new Date(),
      }).returning();
      return toTeamRole(created);
    },

    async remove(companyId: string, userId: string): Promise<void> {
      await db.delete(teamRoles)
        .where(and(eq(teamRoles.companyId, companyId), eq(teamRoles.userId, userId)));
    },
  };
}
