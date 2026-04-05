import { sqliteTable, index, primaryKey } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";
import { goals } from "./goals.js";

export const projectGoals = sqliteTable(
  "project_goals",
  {
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    goalId: text("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    companyId: text("company_id").notNull().references(() => companies.id),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.goalId] }),
    projectIdx: index("project_goals_project_idx").on(table.projectId),
    goalIdx: index("project_goals_goal_idx").on(table.goalId),
    companyIdx: index("project_goals_company_idx").on(table.companyId) }),
);
