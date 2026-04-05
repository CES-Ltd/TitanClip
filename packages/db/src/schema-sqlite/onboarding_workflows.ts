import { sqliteTable, text, integer} from "drizzle-orm/sqlite-core";

export const onboardingWorkflows = sqliteTable("onboarding_workflows", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  targetRole: text("target_role").notNull().default("general"),
  steps: text("steps").notNull().default('[]'),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) });

export const onboardingInstances = sqliteTable("onboarding_instances", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  workflowId: text("workflow_id").notNull(),
  agentId: text("agent_id").notNull(),
  status: text("status").notNull().default("active"),
  issueIds: text("issue_ids").$type<string[]>().default('[]'),
  startedAt: text("started_at").notNull().$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at") });

export const changeRequests = sqliteTable("change_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("other"),
  risk: text("risk").notNull().default("medium"),
  status: text("status").notNull().default("draft"),
  requestedByUserId: text("requested_by_user_id").notNull().default("board"),
  reviewerNotes: text("reviewer_notes").notNull().default(""),
  affectedAgentIds: text("affected_agent_ids").$type<string[]>().default('[]'),
  scheduledAt: text("scheduled_at"),
  implementedAt: text("implemented_at"),
  rolledBackAt: text("rolled_back_at"),
  validationSteps: text("validation_steps").notNull().default(""),
  validationResult: text("validation_result"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) });
