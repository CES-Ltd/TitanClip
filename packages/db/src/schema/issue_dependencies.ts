import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const issueDependencies = pgTable("issue_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  sourceIssueId: uuid("source_issue_id").notNull(),
  targetIssueId: uuid("target_issue_id").notNull(),
  dependencyType: text("dependency_type").notNull(), // blocks, depends_on, relates_to
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("issue_deps_source_idx").on(table.sourceIssueId),
  index("issue_deps_target_idx").on(table.targetIssueId),
  uniqueIndex("issue_deps_unique_idx").on(table.sourceIssueId, table.targetIssueId, table.dependencyType),
]);
