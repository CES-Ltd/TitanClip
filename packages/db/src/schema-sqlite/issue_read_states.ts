import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const issueReadStates = sqliteTable(
  "issue_read_states",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    issueId: text("issue_id").notNull().references(() => issues.id),
    userId: text("user_id").notNull(),
    lastReadAt: text("last_read_at").notNull().$defaultFn(() => new Date().toISOString()),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyIssueIdx: index("issue_read_states_company_issue_idx").on(table.companyId, table.issueId),
    companyUserIdx: index("issue_read_states_company_user_idx").on(table.companyId, table.userId),
    companyIssueUserUnique: uniqueIndex("issue_read_states_company_issue_user_idx").on(
      table.companyId,
      table.issueId,
      table.userId,
    ) }),
);
