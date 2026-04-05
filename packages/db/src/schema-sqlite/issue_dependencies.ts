import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const issueDependencies = sqliteTable("issue_dependencies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  sourceIssueId: text("source_issue_id").notNull(),
  targetIssueId: text("target_issue_id").notNull(),
  dependencyType: text("dependency_type").notNull(), // blocks, depends_on, relates_to
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()) }, (table) => [
  index("issue_deps_source_idx").on(table.sourceIssueId),
  index("issue_deps_target_idx").on(table.targetIssueId),
  uniqueIndex("issue_deps_unique_idx").on(table.sourceIssueId, table.targetIssueId, table.dependencyType),
]);
