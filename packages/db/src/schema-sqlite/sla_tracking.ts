import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const slaTracking = sqliteTable("sla_tracking", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  issueId: text("issue_id").notNull(),
  policyId: text("policy_id").notNull(),
  status: text("status").notNull().default("running"), // running, paused, completed, breached
  clockStartedAt: text("clock_started_at").notNull().$defaultFn(() => new Date().toISOString()),
  clockPausedAt: text("clock_paused_at"),
  totalPausedMinutes: integer("total_paused_minutes").notNull().default(0),
  responseDeadline: text("response_deadline").notNull(),
  resolutionDeadline: text("resolution_deadline").notNull(),
  respondedAt: text("responded_at"),
  resolvedAt: text("resolved_at"),
  responseBreached: integer("response_breached", { mode: "boolean" }).notNull().default(false),
  resolutionBreached: integer("resolution_breached", { mode: "boolean" }).notNull().default(false),
  breachNotifiedAt: text("breach_notified_at"),
  breachActionTaken: text("breach_action_taken"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) }, (table) => [
  index("sla_tracking_company_status_idx").on(table.companyId, table.status),
  index("sla_tracking_issue_idx").on(table.issueId),
]);
