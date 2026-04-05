import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex } from "drizzle-orm/sqlite-core";
import { plugins } from "./plugins.js";
import type { PluginJobStatus, PluginJobRunStatus, PluginJobRunTrigger } from "@titanclip/shared";

/**
 * `plugin_jobs` table — registration and runtime configuration for
 * scheduled jobs declared by plugins in their manifests.
 *
 * Each row represents one scheduled job entry for a plugin. The
 * `job_key` matches the key declared in the manifest's `jobs` array.
 * The `schedule` column stores the cron expression or interval string
 * used by the job scheduler to decide when to fire the job.
 *
 * Status values:
 * - `active` — job is enabled and will run on schedule
 * - `paused` — job is temporarily disabled by the operator
 * - `error` — job has been disabled due to repeated failures
 *
 * @see PLUGIN_SPEC.md §21.3 — `plugin_jobs`
 */
export const pluginJobs = sqliteTable(
  "plugin_jobs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    /** FK to the owning plugin. Cascades on delete. */
    pluginId: text("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    /** Identifier matching the key in the plugin manifest's `jobs` array. */
    jobKey: text("job_key").notNull(),
    /** Cron expression (e.g. `"0 * * * *"`) or interval string. */
    schedule: text("schedule").notNull(),
    /** Current scheduling state. */
    status: text("status").$type<PluginJobStatus>().notNull().default("active"),
    /** Timestamp of the most recent successful execution. */
    lastRunAt: text("last_run_at"),
    /** Pre-computed timestamp of the next scheduled execution. */
    nextRunAt: text("next_run_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    pluginIdx: index("plugin_jobs_plugin_idx").on(table.pluginId),
    nextRunIdx: index("plugin_jobs_next_run_idx").on(table.nextRunAt),
    uniqueJobIdx: uniqueIndex("plugin_jobs_unique_idx").on(table.pluginId, table.jobKey) }),
);

/**
 * `plugin_job_runs` table — immutable execution history for plugin-owned jobs.
 *
 * Each row is created when a job run begins and updated when it completes.
 * Rows are never modified after `status` reaches a terminal value
 * (`succeeded` | `failed` | `cancelled`).
 *
 * Trigger values:
 * - `scheduled` — fired automatically by the cron/interval scheduler
 * - `manual` — triggered by an operator via the admin UI or API
 *
 * @see PLUGIN_SPEC.md §21.3 — `plugin_job_runs`
 */
export const pluginJobRuns = sqliteTable(
  "plugin_job_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    /** FK to the parent job definition. Cascades on delete. */
    jobId: text("job_id")
      .notNull()
      .references(() => pluginJobs.id, { onDelete: "cascade" }),
    /** Denormalized FK to the owning plugin for efficient querying. Cascades on delete. */
    pluginId: text("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    /** What caused this run to start (`"scheduled"` or `"manual"`). */
    trigger: text("trigger").$type<PluginJobRunTrigger>().notNull(),
    /** Current lifecycle state of this run. */
    status: text("status").$type<PluginJobRunStatus>().notNull().default("pending"),
    /** Wall-clock duration in milliseconds. Null until the run finishes. */
    durationMs: integer("duration_ms"),
    /** Error message if `status === "failed"`. */
    error: text("error"),
    /** Ordered list of log lines emitted during this run. */
    logs: text("logs").$type<string[]>().notNull().default('[]'),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    jobIdx: index("plugin_job_runs_job_idx").on(table.jobId),
    pluginIdx: index("plugin_job_runs_plugin_idx").on(table.pluginId),
    statusIdx: index("plugin_job_runs_status_idx").on(table.status) }),
);
