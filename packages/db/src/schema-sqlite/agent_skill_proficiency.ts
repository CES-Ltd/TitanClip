import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const agentSkillProficiency = sqliteTable("agent_skill_proficiency", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  agentId: text("agent_id").notNull(),
  skillName: text("skill_name").notNull(),
  proficiency: integer("proficiency").notNull().default(1), // 1-5
  endorsedBy: text("endorsed_by"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) }, (table) => [
  index("agent_skill_company_idx").on(table.companyId),
  index("agent_skill_agent_idx").on(table.agentId),
  uniqueIndex("agent_skill_unique_idx").on(table.agentId, table.skillName),
]);
