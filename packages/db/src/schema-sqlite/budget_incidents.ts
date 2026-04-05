import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { approvals } from "./approvals.js";
import { budgetPolicies } from "./budget_policies.js";
import { companies } from "./companies.js";

export const budgetIncidents = sqliteTable(
  "budget_incidents",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    policyId: text("policy_id").notNull().references(() => budgetPolicies.id),
    scopeType: text("scope_type").notNull(),
    scopeId: text("scope_id").notNull(),
    metric: text("metric").notNull(),
    windowKind: text("window_kind").notNull(),
    windowStart: text("window_start").notNull(),
    windowEnd: text("window_end").notNull(),
    thresholdType: text("threshold_type").notNull(),
    amountLimit: integer("amount_limit").notNull(),
    amountObserved: integer("amount_observed").notNull(),
    status: text("status").notNull().default("open"),
    approvalId: text("approval_id").references(() => approvals.id),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyStatusIdx: index("budget_incidents_company_status_idx").on(table.companyId, table.status),
    companyScopeIdx: index("budget_incidents_company_scope_idx").on(
      table.companyId,
      table.scopeType,
      table.scopeId,
      table.status,
    ),
    policyWindowIdx: uniqueIndex("budget_incidents_policy_window_threshold_idx").on(
      table.policyId,
      table.windowStart,
      table.thresholdType,
    ).where(sql`${table.status} <> 'dismissed'`) }),
);
