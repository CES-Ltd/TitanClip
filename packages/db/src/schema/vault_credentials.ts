import { pgTable, uuid, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const vaultCredentials = pgTable("vault_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description").default(""),
  credentialType: text("credential_type").notNull().default("api_key"), // api_key, ssh_key, oauth_token, service_account, custom
  provider: text("provider").notNull().default("custom"), // github, aws, gcp, azure, npm, docker, custom
  secretId: uuid("secret_id"), // Links to company_secrets for encrypted storage

  // Access control
  allowedAgentIds: jsonb("allowed_agent_ids").$type<string[] | null>().default(null),
  allowedRoles: jsonb("allowed_roles").$type<string[] | null>().default(null),

  // Rotation policy
  rotationPolicy: text("rotation_policy").notNull().default("manual"), // manual, auto
  rotationIntervalDays: integer("rotation_interval_days"),
  lastRotatedAt: timestamp("last_rotated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  // Runtime token config
  tokenTtlSeconds: integer("token_ttl_seconds").notNull().default(3600),
  maxConcurrentCheckouts: integer("max_concurrent_checkouts").notNull().default(5),

  // Audit counters
  totalCheckouts: integer("total_checkouts").notNull().default(0),
  lastCheckedOutAt: timestamp("last_checked_out_at", { withTimezone: true }),
  lastCheckedOutByAgentId: uuid("last_checked_out_by_agent_id"),

  // Status
  status: text("status").notNull().default("active"), // active, expired, revoked, rotating

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vaultTokenCheckouts = pgTable("vault_token_checkouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  credentialId: uuid("credential_id").notNull(),
  companyId: uuid("company_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  runId: uuid("run_id"),
  envVarName: text("env_var_name").notNull(), // e.g. "GITHUB_TOKEN"

  // Token lifecycle
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  expiredAt: timestamp("expired_at", { withTimezone: true }), // set if token expired before checkin

  // Status
  status: text("status").notNull().default("active"), // active, checked_in, expired, revoked

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
