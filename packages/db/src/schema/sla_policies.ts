import { pgTable, uuid, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const slaPolicies = pgTable("sla_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priority: text("priority").notNull().default("medium"), // critical, high, medium, low
  targetResponseMinutes: integer("target_response_minutes").notNull().default(60),
  targetResolutionMinutes: integer("target_resolution_minutes").notNull().default(480),
  breachAction: text("breach_action").notNull().default("notify"), // notify, escalate, reassign, pause_agent
  escalateToAgentId: uuid("escalate_to_agent_id"),
  notifyUserIds: jsonb("notify_user_ids").$type<string[]>().default([]),
  isDefault: boolean("is_default").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
