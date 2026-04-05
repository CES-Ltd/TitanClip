import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const agentConfigRevisions = sqliteTable(
  "agent_config_revisions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    source: text("source").notNull().default("patch"),
    rolledBackFromRevisionId: text("rolled_back_from_revision_id"),
    changedKeys: text("changed_keys").$type<string[]>().notNull().default('[]'),
    beforeConfig: text("before_config").$type<Record<string, unknown>>().notNull(),
    afterConfig: text("after_config").$type<Record<string, unknown>>().notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyAgentCreatedIdx: index("agent_config_revisions_company_agent_created_idx").on(
      table.companyId,
      table.agentId,
      table.createdAt,
    ),
    agentCreatedIdx: index("agent_config_revisions_agent_created_idx").on(table.agentId, table.createdAt) }),
);
