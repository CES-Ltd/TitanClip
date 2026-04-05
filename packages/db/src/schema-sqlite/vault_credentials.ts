import { sqliteTable, text, integer} from "drizzle-orm/sqlite-core";

export const vaultCredentials = sqliteTable("vault_credentials", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description").default(""),
  credentialType: text("credential_type").notNull().default("api_key"), // api_key, ssh_key, oauth_token, service_account, custom
  provider: text("provider").notNull().default("custom"), // github, aws, gcp, azure, npm, docker, custom
  secretId: text("secret_id"), // Links to company_secrets for encrypted storage

  // Access control
  allowedAgentIds: text("allowed_agent_ids").$type<string[] | null>().default(null),
  allowedRoles: text("allowed_roles").$type<string[] | null>().default(null),

  // Rotation policy
  rotationPolicy: text("rotation_policy").notNull().default("manual"), // manual, auto
  rotationIntervalDays: integer("rotation_interval_days"),
  lastRotatedAt: text("last_rotated_at"),
  expiresAt: text("expires_at"),

  // Runtime token config
  tokenTtlSeconds: integer("token_ttl_seconds").notNull().default(3600),
  maxConcurrentCheckouts: integer("max_concurrent_checkouts").notNull().default(5),

  // Audit counters
  totalCheckouts: integer("total_checkouts").notNull().default(0),
  lastCheckedOutAt: text("last_checked_out_at"),
  lastCheckedOutByAgentId: text("last_checked_out_by_agent_id"),

  // Status
  status: text("status").notNull().default("active"), // active, expired, revoked, rotating

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) });

export const vaultTokenCheckouts = sqliteTable("vault_token_checkouts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  credentialId: text("credential_id").notNull(),
  companyId: text("company_id").notNull(),
  agentId: text("agent_id").notNull(),
  runId: text("run_id"),
  envVarName: text("env_var_name").notNull(), // e.g. "GITHUB_TOKEN"

  // Token lifecycle
  issuedAt: text("issued_at").notNull().$defaultFn(() => new Date().toISOString()),
  expiresAt: text("expires_at").notNull(),
  checkedInAt: text("checked_in_at"),
  expiredAt: text("expired_at"), // set if token expired before checkin

  // Status
  status: text("status").notNull().default("active"), // active, checked_in, expired, revoked

  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()) });
