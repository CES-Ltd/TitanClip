import { sqliteTable, text, integer} from "drizzle-orm/sqlite-core";

export const escalationRules = sqliteTable("escalation_rules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  trigger: text("trigger").notNull(), // sla_breach, error_count, idle_time, consecutive_failures
  triggerThreshold: integer("trigger_threshold").notNull().default(3),
  action: text("action").notNull(), // notify, reassign, escalate_to_manager, pause_agent, restart_agent
  targetAgentId: text("target_agent_id"),
  notifyUserIds: text("notify_user_ids").$type<string[]>().default('[]'),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastFiredAt: text("last_fired_at"),
  fireCount: integer("fire_count").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) });
