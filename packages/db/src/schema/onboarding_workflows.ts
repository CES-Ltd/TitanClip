import { pgTable, uuid, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const onboardingWorkflows = pgTable("onboarding_workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  targetRole: text("target_role").notNull().default("general"),
  steps: jsonb("steps").notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const onboardingInstances = pgTable("onboarding_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  workflowId: uuid("workflow_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  status: text("status").notNull().default("active"),
  issueIds: jsonb("issue_ids").$type<string[]>().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const changeRequests = pgTable("change_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("other"),
  risk: text("risk").notNull().default("medium"),
  status: text("status").notNull().default("draft"),
  requestedByUserId: text("requested_by_user_id").notNull().default("board"),
  reviewerNotes: text("reviewer_notes").notNull().default(""),
  affectedAgentIds: jsonb("affected_agent_ids").$type<string[]>().default([]),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  implementedAt: timestamp("implemented_at", { withTimezone: true }),
  rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
  validationSteps: text("validation_steps").notNull().default(""),
  validationResult: text("validation_result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
