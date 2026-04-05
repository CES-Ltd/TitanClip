import {
  type AnySQLiteColumn,
  sqliteTable,
  text,
  integer,
  index } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";

export const agents = sqliteTable(
  "agents",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    role: text("role").notNull().default("general"),
    title: text("title"),
    icon: text("icon"),
    status: text("status").notNull().default("idle"),
    reportsTo: text("reports_to").references((): AnySQLiteColumn => agents.id),
    capabilities: text("capabilities"),
    adapterType: text("adapter_type").notNull().default("process"),
    adapterConfig: text("adapter_config").$type<Record<string, unknown>>().notNull().default('{}'),
    runtimeConfig: text("runtime_config").$type<Record<string, unknown>>().notNull().default('{}'),
    budgetMonthlyCents: integer("budget_monthly_cents").notNull().default(0),
    spentMonthlyCents: integer("spent_monthly_cents").notNull().default(0),
    pauseReason: text("pause_reason"),
    pausedAt: text("paused_at"),
    permissions: text("permissions").$type<Record<string, unknown>>().notNull().default('{}'),
    lastHeartbeatAt: text("last_heartbeat_at"),
    metadata: text("metadata").$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyStatusIdx: index("agents_company_status_idx").on(table.companyId, table.status),
    companyReportsToIdx: index("agents_company_reports_to_idx").on(table.companyId, table.reportsTo) }),
);
