import { sqliteTable, text, integer} from "drizzle-orm/sqlite-core";

export const workflowTemplates = sqliteTable("workflow_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  steps: text("steps").$type<Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    assigneeRole?: string;
    dependsOnStepIds: string[];
    estimatedMinutes?: number;
  }>>().notNull().default('[]'),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) });
