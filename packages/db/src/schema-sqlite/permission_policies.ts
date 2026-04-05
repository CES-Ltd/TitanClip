import { sqliteTable, text, integer} from "drizzle-orm/sqlite-core";

export const permissionPolicies = sqliteTable("permission_policies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id"), // null = instance-wide policy
  name: text("name").notNull(),
  description: text("description").default(""),

  // Resource access
  canCreateIssues: integer("can_create_issues", { mode: "boolean" }).notNull().default(true),
  canUpdateIssues: integer("can_update_issues", { mode: "boolean" }).notNull().default(true),
  canDeleteIssues: integer("can_delete_issues", { mode: "boolean" }).notNull().default(false),
  canCreateAgents: integer("can_create_agents", { mode: "boolean" }).notNull().default(false),
  canManageSecrets: integer("can_manage_secrets", { mode: "boolean" }).notNull().default(false),
  canAccessVault: integer("can_access_vault", { mode: "boolean" }).notNull().default(false),
  canApproveRequests: integer("can_approve_requests", { mode: "boolean" }).notNull().default(false),

  // Credential scoping
  allowedVaultCredentials: text("allowed_vault_credentials").$type<string[] | null>().default(null),

  // Execution scoping
  allowedWorkspaces: text("allowed_workspaces").$type<string[] | null>().default(null),
  maxConcurrentRuns: integer("max_concurrent_runs").notNull().default(3),
  maxRunDurationSeconds: integer("max_run_duration_seconds").notNull().default(3600),

  // Network (future)
  allowedDomains: text("allowed_domains").$type<string[] | null>().default(null),
  blockedDomains: text("blocked_domains").$type<string[]>().default('[]'),

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) });
