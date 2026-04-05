import {
  type AnySQLiteColumn,
  sqliteTable,
  text,
  index } from "drizzle-orm/sqlite-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const goals = sqliteTable(
  "goals",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    title: text("title").notNull(),
    description: text("description"),
    level: text("level").notNull().default("task"),
    status: text("status").notNull().default("planned"),
    parentId: text("parent_id").references((): AnySQLiteColumn => goals.id),
    ownerAgentId: text("owner_agent_id").references(() => agents.id),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyIdx: index("goals_company_idx").on(table.companyId) }),
);
