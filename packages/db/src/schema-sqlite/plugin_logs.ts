import {
  sqliteTable,
  text,
  index } from "drizzle-orm/sqlite-core";
import { plugins } from "./plugins.js";

/**
 * `plugin_logs` table — structured log storage for plugin workers.
 *
 * Each row stores a single log entry emitted by a plugin worker via
 * `ctx.logger.info(...)` etc. Logs are queryable by plugin, level, and
 * time range to support the operator logs panel and debugging workflows.
 *
 * Rows are inserted by the host when handling `log` notifications from
 * the worker process. A capped retention policy can be applied via
 * periodic cleanup (e.g. delete rows older than 7 days).
 *
 * @see PLUGIN_SPEC.md §26 — Observability
 */
export const pluginLogs = sqliteTable(
  "plugin_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pluginId: text("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    level: text("level").notNull().default("info"),
    message: text("message").notNull(),
    meta: text("meta").$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    pluginTimeIdx: index("plugin_logs_plugin_time_idx").on(
      table.pluginId,
      table.createdAt,
    ),
    levelIdx: index("plugin_logs_level_idx").on(table.level) }),
);
