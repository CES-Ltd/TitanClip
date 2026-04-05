import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    provider: text("provider").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    sha256: text("sha256").notNull(),
    originalFilename: text("original_filename"),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyCreatedIdx: index("assets_company_created_idx").on(table.companyId, table.createdAt),
    companyProviderIdx: index("assets_company_provider_idx").on(table.companyId, table.provider),
    companyObjectKeyUq: uniqueIndex("assets_company_object_key_uq").on(table.companyId, table.objectKey) }),
);
