import {
  index,
  integer,
  sqliteTable,
  text } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";
import { projectWorkspaces } from "./project_workspaces.js";
import { executionWorkspaces } from "./execution_workspaces.js";
import { issues } from "./issues.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const workspaceRuntimeServices = sqliteTable(
  "workspace_runtime_services",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull().references(() => companies.id),
    projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
    projectWorkspaceId: text("project_workspace_id").references(() => projectWorkspaces.id, { onDelete: "set null" }),
    executionWorkspaceId: text("execution_workspace_id").references(() => executionWorkspaces.id, { onDelete: "set null" }),
    issueId: text("issue_id").references(() => issues.id, { onDelete: "set null" }),
    scopeType: text("scope_type").notNull(),
    scopeId: text("scope_id"),
    serviceName: text("service_name").notNull(),
    status: text("status").notNull(),
    lifecycle: text("lifecycle").notNull(),
    reuseKey: text("reuse_key"),
    command: text("command"),
    cwd: text("cwd"),
    port: integer("port"),
    url: text("url"),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    ownerAgentId: text("owner_agent_id").references(() => agents.id, { onDelete: "set null" }),
    startedByRunId: text("started_by_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
    lastUsedAt: text("last_used_at").notNull().$defaultFn(() => new Date().toISOString()),
    startedAt: text("started_at").notNull().$defaultFn(() => new Date().toISOString()),
    stoppedAt: text("stopped_at"),
    stopPolicy: text("stop_policy").$type<Record<string, unknown>>(),
    healthStatus: text("health_status").notNull().default("unknown"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyWorkspaceStatusIdx: index("workspace_runtime_services_company_workspace_status_idx").on(
      table.companyId,
      table.projectWorkspaceId,
      table.status,
    ),
    companyExecutionWorkspaceStatusIdx: index("workspace_runtime_services_company_execution_workspace_status_idx").on(
      table.companyId,
      table.executionWorkspaceId,
      table.status,
    ),
    companyProjectStatusIdx: index("workspace_runtime_services_company_project_status_idx").on(
      table.companyId,
      table.projectId,
      table.status,
    ),
    runIdx: index("workspace_runtime_services_run_idx").on(table.startedByRunId),
    companyUpdatedIdx: index("workspace_runtime_services_company_updated_idx").on(
      table.companyId,
      table.updatedAt,
    ) }),
);
