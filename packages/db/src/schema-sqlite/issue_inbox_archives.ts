import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const issueInboxArchives = sqliteTable(
  "issue_inbox_archives",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    issueId: text("issue_id").notNull().references(() => issues.id),
    userId: text("user_id").notNull(),
    archivedAt: text("archived_at").notNull().$defaultFn(() => new Date().toISOString()),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyIssueIdx: index("issue_inbox_archives_company_issue_idx").on(table.companyId, table.issueId),
    companyUserIdx: index("issue_inbox_archives_company_user_idx").on(table.companyId, table.userId),
    companyIssueUserUnique: uniqueIndex("issue_inbox_archives_company_issue_user_idx").on(
      table.companyId,
      table.issueId,
      table.userId,
    ) }),
);
