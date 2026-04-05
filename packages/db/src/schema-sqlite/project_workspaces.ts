import {
  index,
  sqliteTable,
  text,
  uniqueIndex } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export const projectWorkspaces = sqliteTable(
  "project_workspaces",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceType: text("source_type").notNull().default("local_path"),
    cwd: text("cwd"),
    repoUrl: text("repo_url"),
    repoRef: text("repo_ref"),
    defaultRef: text("default_ref"),
    visibility: text("visibility").notNull().default("default"),
    setupCommand: text("setup_command"),
    cleanupCommand: text("cleanup_command"),
    remoteProvider: text("remote_provider"),
    remoteWorkspaceRef: text("remote_workspace_ref"),
    sharedWorkspaceKey: text("shared_workspace_key"),
    metadata: text("metadata").$type<Record<string, unknown>>(),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyProjectIdx: index("project_workspaces_company_project_idx").on(table.companyId, table.projectId),
    projectPrimaryIdx: index("project_workspaces_project_primary_idx").on(table.projectId, table.isPrimary),
    projectSourceTypeIdx: index("project_workspaces_project_source_type_idx").on(table.projectId, table.sourceType),
    companySharedKeyIdx: index("project_workspaces_company_shared_key_idx").on(table.companyId, table.sharedWorkspaceKey),
    projectRemoteRefIdx: uniqueIndex("project_workspaces_project_remote_ref_idx")
      .on(table.projectId, table.remoteProvider, table.remoteWorkspaceRef) }),
);
