import {
  type AnySQLiteColumn,
  index,
  sqliteTable,
  text } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { projectWorkspaces } from "./project_workspaces.js";
import { projects } from "./projects.js";

export const executionWorkspaces = sqliteTable(
  "execution_workspaces",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    projectWorkspaceId: text("project_workspace_id").references(() => projectWorkspaces.id, { onDelete: "set null" }),
    sourceIssueId: text("source_issue_id").references((): AnySQLiteColumn => issues.id, { onDelete: "set null" }),
    mode: text("mode").notNull(),
    strategyType: text("strategy_type").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    cwd: text("cwd"),
    repoUrl: text("repo_url"),
    baseRef: text("base_ref"),
    branchName: text("branch_name"),
    providerType: text("provider_type").notNull().default("local_fs"),
    providerRef: text("provider_ref"),
    derivedFromExecutionWorkspaceId: text("derived_from_execution_workspace_id")
      .references((): AnySQLiteColumn => executionWorkspaces.id, { onDelete: "set null" }),
    lastUsedAt: text("last_used_at").notNull().$defaultFn(() => new Date().toISOString()),
    openedAt: text("opened_at").notNull().$defaultFn(() => new Date().toISOString()),
    closedAt: text("closed_at"),
    cleanupEligibleAt: text("cleanup_eligible_at"),
    cleanupReason: text("cleanup_reason"),
    metadata: text("metadata").$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyProjectStatusIdx: index("execution_workspaces_company_project_status_idx").on(
      table.companyId,
      table.projectId,
      table.status,
    ),
    companyProjectWorkspaceStatusIdx: index("execution_workspaces_company_project_workspace_status_idx").on(
      table.companyId,
      table.projectWorkspaceId,
      table.status,
    ),
    companySourceIssueIdx: index("execution_workspaces_company_source_issue_idx").on(
      table.companyId,
      table.sourceIssueId,
    ),
    companyLastUsedIdx: index("execution_workspaces_company_last_used_idx").on(
      table.companyId,
      table.lastUsedAt,
    ),
    companyBranchIdx: index("execution_workspaces_company_branch_idx").on(
      table.companyId,
      table.branchName,
    ) }),
);
