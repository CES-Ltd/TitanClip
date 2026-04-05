import { sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { approvals } from "./approvals.js";
import { agents } from "./agents.js";

export const issueApprovals = sqliteTable(
  "issue_approvals",
  {
    companyId: text("company_id").notNull().references(() => companies.id),
    issueId: text("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    approvalId: text("approval_id").notNull().references(() => approvals.id, { onDelete: "cascade" }),
    linkedByAgentId: text("linked_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    linkedByUserId: text("linked_by_user_id"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    pk: primaryKey({ columns: [table.issueId, table.approvalId], name: "issue_approvals_pk" }),
    issueIdx: index("issue_approvals_issue_idx").on(table.issueId),
    approvalIdx: index("issue_approvals_approval_idx").on(table.approvalId),
    companyIdx: index("issue_approvals_company_idx").on(table.companyId) }),
);
