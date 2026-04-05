import { index, integer, sqliteTable, text, uniqueIndex} from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { feedbackVotes } from "./feedback_votes.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";

export const feedbackExports = sqliteTable(
  "feedback_exports",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    feedbackVoteId: text("feedback_vote_id").notNull().references(() => feedbackVotes.id, { onDelete: "cascade" }),
    issueId: text("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    authorUserId: text("author_user_id").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    vote: text("vote").notNull(),
    status: text("status").notNull().default("local_only"),
    destination: text("destination"),
    exportId: text("export_id"),
    consentVersion: text("consent_version"),
    schemaVersion: text("schema_version").notNull().default("paperclip-feedback-envelope-v2"),
    bundleVersion: text("bundle_version").notNull().default("paperclip-feedback-bundle-v2"),
    payloadVersion: text("payload_version").notNull().default("paperclip-feedback-v1"),
    payloadDigest: text("payload_digest"),
    payloadSnapshot: text("payload_snapshot"),
    targetSummary: text("target_summary").notNull(),
    redactionSummary: text("redaction_summary"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptedAt: text("last_attempted_at"),
    exportedAt: text("exported_at"),
    failureReason: text("failure_reason"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    voteUniqueIdx: uniqueIndex("feedback_exports_feedback_vote_idx").on(table.feedbackVoteId),
    companyCreatedIdx: index("feedback_exports_company_created_idx").on(table.companyId, table.createdAt),
    companyStatusIdx: index("feedback_exports_company_status_idx").on(table.companyId, table.status, table.createdAt),
    companyIssueIdx: index("feedback_exports_company_issue_idx").on(table.companyId, table.issueId, table.createdAt),
    companyProjectIdx: index("feedback_exports_company_project_idx").on(table.companyId, table.projectId, table.createdAt),
    companyAuthorIdx: index("feedback_exports_company_author_idx").on(table.companyId, table.authorUserId, table.createdAt) }),
);
