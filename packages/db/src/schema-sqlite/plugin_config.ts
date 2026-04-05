import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { plugins } from "./plugins.js";

/**
 * `plugin_config` table — stores operator-provided instance configuration
 * for each plugin (one row per plugin, enforced by a unique index on
 * `plugin_id`).
 *
 * The `config_json` column holds the values that the operator enters in the
 * plugin settings UI. These values are validated at runtime against the
 * plugin's `instanceConfigSchema` from the manifest.
 *
 * @see PLUGIN_SPEC.md §21.3
 */
export const pluginConfig = sqliteTable(
  "plugin_config",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pluginId: text("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    configJson: text("config_json").$type<Record<string, unknown>>().notNull().default('{}'),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    pluginIdIdx: uniqueIndex("plugin_config_plugin_id_idx").on(table.pluginId) }),
);
