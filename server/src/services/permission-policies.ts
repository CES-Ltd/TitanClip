import type { Db } from "@titanclip/db";
import { permissionPolicies } from "@titanclip/db";
import { eq, desc, isNull, or } from "drizzle-orm";
import type { PermissionPolicy } from "@titanclip/shared";

function toPolicy(row: typeof permissionPolicies.$inferSelect): PermissionPolicy {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    description: row.description ?? "",
    canCreateIssues: row.canCreateIssues,
    canUpdateIssues: row.canUpdateIssues,
    canDeleteIssues: row.canDeleteIssues,
    canCreateAgents: row.canCreateAgents,
    canManageSecrets: row.canManageSecrets,
    canAccessVault: row.canAccessVault,
    canApproveRequests: row.canApproveRequests,
    allowedVaultCredentials: row.allowedVaultCredentials as string[] | null,
    allowedWorkspaces: row.allowedWorkspaces as string[] | null,
    maxConcurrentRuns: row.maxConcurrentRuns,
    maxRunDurationSeconds: row.maxRunDurationSeconds,
    allowedDomains: row.allowedDomains as string[] | null,
    blockedDomains: (row.blockedDomains as string[]) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function permissionPolicyService(db: Db) {
  return {
    async list(companyId?: string): Promise<PermissionPolicy[]> {
      const rows = await db.select().from(permissionPolicies)
        .where(companyId
          ? or(eq(permissionPolicies.companyId, companyId), isNull(permissionPolicies.companyId))
          : undefined
        )
        .orderBy(desc(permissionPolicies.createdAt));
      return rows.map(toPolicy);
    },

    async getById(id: string): Promise<PermissionPolicy | null> {
      const [row] = await db.select().from(permissionPolicies).where(eq(permissionPolicies.id, id));
      return row ? toPolicy(row) : null;
    },

    async create(input: Record<string, unknown>, companyId?: string): Promise<PermissionPolicy> {
      const now = new Date();
      const [row] = await db.insert(permissionPolicies).values({
        companyId: companyId ?? null,
        name: input.name as string,
        description: (input.description as string) ?? "",
        canCreateIssues: (input.canCreateIssues as boolean) ?? true,
        canUpdateIssues: (input.canUpdateIssues as boolean) ?? true,
        canDeleteIssues: (input.canDeleteIssues as boolean) ?? false,
        canCreateAgents: (input.canCreateAgents as boolean) ?? false,
        canManageSecrets: (input.canManageSecrets as boolean) ?? false,
        canAccessVault: (input.canAccessVault as boolean) ?? false,
        canApproveRequests: (input.canApproveRequests as boolean) ?? false,
        allowedVaultCredentials: (input.allowedVaultCredentials as string[] | null) ?? null,
        allowedWorkspaces: (input.allowedWorkspaces as string[] | null) ?? null,
        maxConcurrentRuns: (input.maxConcurrentRuns as number) ?? 3,
        maxRunDurationSeconds: (input.maxRunDurationSeconds as number) ?? 3600,
        allowedDomains: (input.allowedDomains as string[] | null) ?? null,
        blockedDomains: (input.blockedDomains as string[]) ?? [],
        createdAt: now,
        updatedAt: now,
      }).returning();
      return toPolicy(row);
    },

    async update(id: string, patch: Record<string, unknown>): Promise<PermissionPolicy | null> {
      const [row] = await db.update(permissionPolicies)
        .set({ ...patch, updatedAt: new Date() } as any)
        .where(eq(permissionPolicies.id, id))
        .returning();
      return row ? toPolicy(row) : null;
    },

    async remove(id: string): Promise<void> {
      await db.delete(permissionPolicies).where(eq(permissionPolicies.id, id));
    },
  };
}
