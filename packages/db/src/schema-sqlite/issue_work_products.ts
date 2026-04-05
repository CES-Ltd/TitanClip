import {
  index,
  sqliteTable,
  text } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { executionWorkspaces } from "./execution_workspaces.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";
import { workspaceRuntimeServices } from "./workspace_runtime_services.js";

export const issueWorkProducts = sqliteTable(
  "issue_work_products",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    issueId: text("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
    executionWorkspaceId: text("execution_workspace_id")
      .references(() => executionWorkspaces.id, { onDelete: "set null" }),
    runtimeServiceId: text("runtime_service_id")
      .references(() => workspaceRuntimeServices.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    url: text("url"),
    status: text("status").notNull(),
    reviewState: text("review_state").notNull().default("none"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    healthStatus: text("health_status").notNull().default("unknown"),
    summary: text("summary"),
    metadata: text("metadata").$type<Record<string, unknown>>(),
    createdByRunId: text("created_by_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyIssueTypeIdx: index("issue_work_products_company_issue_type_idx").on(
      table.companyId,
      table.issueId,
      table.type,
    ),
    companyExecutionWorkspaceTypeIdx: index("issue_work_products_company_execution_workspace_type_idx").on(
      table.companyId,
      table.executionWorkspaceId,
      table.type,
    ),
    companyProviderExternalIdIdx: index("issue_work_products_company_provider_external_id_idx").on(
      table.companyId,
      table.provider,
      table.externalId,
    ),
    companyUpdatedIdx: index("issue_work_products_company_updated_idx").on(
      table.companyId,
      table.updatedAt,
    ) }),
);
