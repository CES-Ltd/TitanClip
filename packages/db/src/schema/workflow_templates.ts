import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const workflowTemplates = pgTable("workflow_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  steps: jsonb("steps").$type<Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    assigneeRole?: string;
    dependsOnStepIds: string[];
    estimatedMinutes?: number;
  }>>().notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
