import { pgTable, uuid, text, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const slaTracking = pgTable("sla_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  issueId: uuid("issue_id").notNull(),
  policyId: uuid("policy_id").notNull(),
  status: text("status").notNull().default("running"), // running, paused, completed, breached
  clockStartedAt: timestamp("clock_started_at", { withTimezone: true }).notNull().defaultNow(),
  clockPausedAt: timestamp("clock_paused_at", { withTimezone: true }),
  totalPausedMinutes: integer("total_paused_minutes").notNull().default(0),
  responseDeadline: timestamp("response_deadline", { withTimezone: true }).notNull(),
  resolutionDeadline: timestamp("resolution_deadline", { withTimezone: true }).notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  responseBreached: boolean("response_breached").notNull().default(false),
  resolutionBreached: boolean("resolution_breached").notNull().default(false),
  breachNotifiedAt: timestamp("breach_notified_at", { withTimezone: true }),
  breachActionTaken: text("breach_action_taken"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("sla_tracking_company_status_idx").on(table.companyId, table.status),
  index("sla_tracking_issue_idx").on(table.issueId),
]);
