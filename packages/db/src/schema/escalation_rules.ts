import { pgTable, uuid, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const escalationRules = pgTable("escalation_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  trigger: text("trigger").notNull(), // sla_breach, error_count, idle_time, consecutive_failures
  triggerThreshold: integer("trigger_threshold").notNull().default(3),
  action: text("action").notNull(), // notify, reassign, escalate_to_manager, pause_agent, restart_agent
  targetAgentId: uuid("target_agent_id"),
  notifyUserIds: jsonb("notify_user_ids").$type<string[]>().default([]),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
  enabled: boolean("enabled").notNull().default(true),
  lastFiredAt: timestamp("last_fired_at", { withTimezone: true }),
  fireCount: integer("fire_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
