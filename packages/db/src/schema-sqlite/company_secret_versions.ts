import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { agents } from "./agents.js";
import { companySecrets } from "./company_secrets.js";

export const companySecretVersions = sqliteTable(
  "company_secret_versions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    secretId: text("secret_id").notNull().references(() => companySecrets.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    material: text("material").$type<Record<string, unknown>>().notNull(),
    valueSha256: text("value_sha256").notNull(),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    revokedAt: text("revoked_at") },
  (table) => ({
    secretIdx: index("company_secret_versions_secret_idx").on(table.secretId, table.createdAt),
    valueHashIdx: index("company_secret_versions_value_sha256_idx").on(table.valueSha256),
    secretVersionUq: uniqueIndex("company_secret_versions_secret_version_uq").on(table.secretId, table.version) }),
);
