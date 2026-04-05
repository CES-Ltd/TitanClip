import { sqliteTable, text, integer} from "drizzle-orm/sqlite-core";

export const slaPolicies = sqliteTable("sla_policies", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priority: text("priority").notNull().default("medium"), // critical, high, medium, low
  targetResponseMinutes: integer("target_response_minutes").notNull().default(60),
  targetResolutionMinutes: integer("target_resolution_minutes").notNull().default(480),
  breachAction: text("breach_action").notNull().default("notify"), // notify, escalate, reassign, pause_agent
  escalateToAgentId: text("escalate_to_agent_id"),
  notifyUserIds: text("notify_user_ids").$type<string[]>().default('[]'),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) });
