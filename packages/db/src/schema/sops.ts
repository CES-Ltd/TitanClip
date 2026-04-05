import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

/**
 * Standard Operating Procedures — declarative multi-step workflows.
 *
 * Each SOP defines a sequence of steps that can be triggered manually,
 * on a schedule, via webhook, or in response to events. Steps are
 * executed as issues assigned to specific agents, with dependency
 * tracking between steps.
 */
export const sops = pgTable(
  "sops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    title: text("title").notNull(),
    description: text("description"),
    /** Array of step definitions: { stepId, title, instruction, assigneeAgentId?, dependsOn[], condition?, timeout? } */
    steps: jsonb("steps").$type<SopStep[]>().notNull().default([]),
    triggerType: text("trigger_type").notNull().default("manual"), // manual, cron, webhook, event
    triggerConfig: jsonb("trigger_config").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("active"), // active, paused, archived
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("sops_company_idx").on(table.companyId, table.status),
  })
);

/**
 * SOP Instances — tracks a specific execution of an SOP.
 */
export const sopInstances = pgTable(
  "sop_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    sopId: uuid("sop_id").notNull().references(() => sops.id),
    status: text("status").notNull().default("running"), // running, completed, failed, cancelled
    /** Per-step execution status: { stepId: "pending"|"running"|"completed"|"failed"|"blocked" } */
    stepStatuses: jsonb("step_statuses").$type<Record<string, string>>().notNull().default({}),
    /** Map of stepId → issueId for created issues */
    stepIssueIds: jsonb("step_issue_ids").$type<Record<string, string>>().notNull().default({}),
    triggeredBy: text("triggered_by"), // userId or "cron" or "webhook" or agentId
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sopIdx: index("sop_instances_sop_idx").on(table.sopId, table.status),
    companyIdx: index("sop_instances_company_idx").on(table.companyId),
  })
);

// ── TypeScript types for the JSONB fields ────────────────────────────────

export interface SopStep {
  stepId: string;
  title: string;
  instruction: string;
  assigneeAgentId?: string;
  dependsOn: string[]; // stepIds that must complete before this step
  condition?: string; // optional: JS expression evaluated at runtime
  timeoutMinutes?: number;
}
