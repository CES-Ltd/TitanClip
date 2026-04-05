import {
  bigint,
  index,
  integer,
  sqliteTable,
  text } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { executionWorkspaces } from "./execution_workspaces.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const workspaceOperations = sqliteTable(
  "workspace_operations",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    executionWorkspaceId: text("execution_workspace_id").references(() => executionWorkspaces.id, {
      onDelete: "set null" }),
    heartbeatRunId: text("heartbeat_run_id").references(() => heartbeatRuns.id, {
      onDelete: "set null" }),
    phase: text("phase").notNull(),
    command: text("command"),
    cwd: text("cwd"),
    status: text("status").notNull().default("running"),
    exitCode: integer("exit_code"),
    logStore: text("log_store"),
    logRef: text("log_ref"),
    logBytes: bigint("log_bytes", { mode: "number" }),
    logSha256: text("log_sha256"),
    logCompressed: integer("log_compressed", { mode: "boolean" }).notNull().default(false),
    stdoutExcerpt: text("stdout_excerpt"),
    stderrExcerpt: text("stderr_excerpt"),
    metadata: text("metadata").$type<Record<string, unknown>>(),
    startedAt: text("started_at").notNull().$defaultFn(() => new Date().toISOString()),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyRunStartedIdx: index("workspace_operations_company_run_started_idx").on(
      table.companyId,
      table.heartbeatRunId,
      table.startedAt,
    ),
    companyWorkspaceStartedIdx: index("workspace_operations_company_workspace_started_idx").on(
      table.companyId,
      table.executionWorkspaceId,
      table.startedAt,
    ) }),
);
