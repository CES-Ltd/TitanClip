import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex } from "drizzle-orm/sqlite-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";
import { goals } from "./goals.js";
import type { RoutineVariable } from "@titanclip/shared";

export const routines = sqliteTable(
  "routines",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    goalId: text("goal_id").references(() => goals.id, { onDelete: "set null" }),
    parentIssueId: text("parent_issue_id").references(() => issues.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    assigneeAgentId: text("assignee_agent_id").notNull().references(() => agents.id),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("active"),
    concurrencyPolicy: text("concurrency_policy").notNull().default("coalesce_if_active"),
    catchUpPolicy: text("catch_up_policy").notNull().default("skip_missed"),
    variables: text("variables").$type<RoutineVariable[]>().notNull().default('[]'),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    updatedByAgentId: text("updated_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id"),
    lastTriggeredAt: text("last_triggered_at"),
    lastEnqueuedAt: text("last_enqueued_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyStatusIdx: index("routines_company_status_idx").on(table.companyId, table.status),
    companyAssigneeIdx: index("routines_company_assignee_idx").on(table.companyId, table.assigneeAgentId),
    companyProjectIdx: index("routines_company_project_idx").on(table.companyId, table.projectId) }),
);

export const routineTriggers = sqliteTable(
  "routine_triggers",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    routineId: text("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    cronExpression: text("cron_expression"),
    timezone: text("timezone"),
    nextRunAt: text("next_run_at"),
    lastFiredAt: text("last_fired_at"),
    publicId: text("public_id"),
    secretId: text("secret_id").references(() => companySecrets.id, { onDelete: "set null" }),
    signingMode: text("signing_mode"),
    replayWindowSec: integer("replay_window_sec"),
    lastRotatedAt: text("last_rotated_at"),
    lastResult: text("last_result"),
    createdByAgentId: text("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    updatedByAgentId: text("updated_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyRoutineIdx: index("routine_triggers_company_routine_idx").on(table.companyId, table.routineId),
    companyKindIdx: index("routine_triggers_company_kind_idx").on(table.companyId, table.kind),
    nextRunIdx: index("routine_triggers_next_run_idx").on(table.nextRunAt),
    publicIdIdx: index("routine_triggers_public_id_idx").on(table.publicId),
    publicIdUq: uniqueIndex("routine_triggers_public_id_uq").on(table.publicId) }),
);

export const routineRuns = sqliteTable(
  "routine_runs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    routineId: text("routine_id").notNull().references(() => routines.id, { onDelete: "cascade" }),
    triggerId: text("trigger_id").references(() => routineTriggers.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    status: text("status").notNull().default("received"),
    triggeredAt: text("triggered_at").notNull().$defaultFn(() => new Date().toISOString()),
    idempotencyKey: text("idempotency_key"),
    triggerPayload: text("trigger_payload").$type<Record<string, unknown>>(),
    linkedIssueId: text("linked_issue_id").references(() => issues.id, { onDelete: "set null" }),
    coalescedIntoRunId: text("coalesced_into_run_id"),
    failureReason: text("failure_reason"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyRoutineIdx: index("routine_runs_company_routine_idx").on(table.companyId, table.routineId, table.createdAt),
    triggerIdx: index("routine_runs_trigger_idx").on(table.triggerId, table.createdAt),
    linkedIssueIdx: index("routine_runs_linked_issue_idx").on(table.linkedIssueId),
    idempotencyIdx: index("routine_runs_trigger_idempotency_idx").on(table.triggerId, table.idempotencyKey) }),
);
