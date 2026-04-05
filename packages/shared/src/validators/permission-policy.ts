import { z } from "zod";

export const createPermissionPolicySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  canCreateIssues: z.boolean().default(true),
  canUpdateIssues: z.boolean().default(true),
  canDeleteIssues: z.boolean().default(false),
  canCreateAgents: z.boolean().default(false),
  canManageSecrets: z.boolean().default(false),
  canAccessVault: z.boolean().default(false),
  canApproveRequests: z.boolean().default(false),
  allowedVaultCredentials: z.array(z.string()).nullable().default(null),
  allowedWorkspaces: z.array(z.string()).nullable().default(null),
  maxConcurrentRuns: z.number().int().min(1).max(50).default(3),
  maxRunDurationSeconds: z.number().int().min(60).max(86400).default(3600),
  allowedDomains: z.array(z.string()).nullable().default(null),
  blockedDomains: z.array(z.string()).default([]),
});

export const updatePermissionPolicySchema = createPermissionPolicySchema.partial();

export type CreatePermissionPolicy = z.infer<typeof createPermissionPolicySchema>;
export type UpdatePermissionPolicy = z.infer<typeof updatePermissionPolicySchema>;
