import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const permissionPolicies = pgTable("permission_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id"), // null = instance-wide policy
  name: text("name").notNull(),
  description: text("description").default(""),

  // Resource access
  canCreateIssues: boolean("can_create_issues").notNull().default(true),
  canUpdateIssues: boolean("can_update_issues").notNull().default(true),
  canDeleteIssues: boolean("can_delete_issues").notNull().default(false),
  canCreateAgents: boolean("can_create_agents").notNull().default(false),
  canManageSecrets: boolean("can_manage_secrets").notNull().default(false),
  canAccessVault: boolean("can_access_vault").notNull().default(false),
  canApproveRequests: boolean("can_approve_requests").notNull().default(false),

  // Credential scoping
  allowedVaultCredentials: jsonb("allowed_vault_credentials").$type<string[] | null>().default(null),

  // Execution scoping
  allowedWorkspaces: jsonb("allowed_workspaces").$type<string[] | null>().default(null),
  maxConcurrentRuns: integer("max_concurrent_runs").notNull().default(3),
  maxRunDurationSeconds: integer("max_run_duration_seconds").notNull().default(3600),

  // Network (future)
  allowedDomains: jsonb("allowed_domains").$type<string[] | null>().default(null),
  blockedDomains: jsonb("blocked_domains").$type<string[]>().default([]),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
