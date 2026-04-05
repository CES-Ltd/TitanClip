import { index, sqliteTable, text, uniqueIndex} from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";

export const feedbackVotes = sqliteTable(
  "feedback_votes",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    issueId: text("issue_id").notNull().references(() => issues.id),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    authorUserId: text("author_user_id").notNull(),
    vote: text("vote").notNull(),
    reason: text("reason"),
    sharedWithLabs: integer("shared_with_labs", { mode: "boolean" }).notNull().default(false),
    sharedAt: text("shared_at"),
    consentVersion: text("consent_version"),
    redactionSummary: text("redaction_summary"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyIssueIdx: index("feedback_votes_company_issue_idx").on(table.companyId, table.issueId),
    issueTargetIdx: index("feedback_votes_issue_target_idx").on(table.issueId, table.targetType, table.targetId),
    authorIdx: index("feedback_votes_author_idx").on(table.authorUserId, table.createdAt),
    companyTargetAuthorUniqueIdx: uniqueIndex("feedback_votes_company_target_author_idx").on(
      table.companyId,
      table.targetType,
      table.targetId,
      table.authorUserId,
    ) }),
);
