import {
  sqliteTable,
  text,
  integer,
  index } from "drizzle-orm/sqlite-core";
import { plugins } from "./plugins.js";
import type { PluginWebhookDeliveryStatus } from "@titanclip/shared";

/**
 * `plugin_webhook_deliveries` table — inbound webhook delivery history for plugins.
 *
 * When an external system sends an HTTP POST to a plugin's registered webhook
 * endpoint (e.g. `/api/plugins/:pluginKey/webhooks/:webhookKey`), the server
 * creates a row in this table before dispatching the payload to the plugin
 * worker. This provides an auditable log of every delivery attempt.
 *
 * The `webhook_key` matches the key declared in the plugin manifest's
 * `webhooks` array. `external_id` is an optional identifier supplied by the
 * remote system (e.g. a GitHub delivery GUID) that can be used to detect
 * and reject duplicate deliveries.
 *
 * Status values:
 * - `pending` — received but not yet dispatched to the worker
 * - `processing` — currently being handled by the plugin worker
 * - `succeeded` — worker processed the payload successfully
 * - `failed` — worker returned an error or timed out
 *
 * @see PLUGIN_SPEC.md §21.3 — `plugin_webhook_deliveries`
 */
export const pluginWebhookDeliveries = sqliteTable(
  "plugin_webhook_deliveries",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    /** FK to the owning plugin. Cascades on delete. */
    pluginId: text("plugin_id")
      .notNull()
      .references(() => plugins.id, { onDelete: "cascade" }),
    /** Identifier matching the key in the plugin manifest's `webhooks` array. */
    webhookKey: text("webhook_key").notNull(),
    /** Optional de-duplication ID provided by the external system. */
    externalId: text("external_id"),
    /** Current delivery state. */
    status: text("status").$type<PluginWebhookDeliveryStatus>().notNull().default("pending"),
    /** Wall-clock processing duration in milliseconds. Null until delivery finishes. */
    durationMs: integer("duration_ms"),
    /** Error message if `status === "failed"`. */
    error: text("error"),
    /** Raw JSON body of the inbound HTTP request. */
    payload: text("payload").$type<Record<string, unknown>>().notNull(),
    /** Relevant HTTP headers from the inbound request (e.g. signature headers). */
    headers: text("headers").$type<Record<string, string>>().notNull().default('{}'),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    pluginIdx: index("plugin_webhook_deliveries_plugin_idx").on(table.pluginId),
    statusIdx: index("plugin_webhook_deliveries_status_idx").on(table.status),
    keyIdx: index("plugin_webhook_deliveries_key_idx").on(table.webhookKey) }),
);
