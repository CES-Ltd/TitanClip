import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const agentSkillProficiency = pgTable("agent_skill_proficiency", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  agentId: uuid("agent_id").notNull(),
  skillName: text("skill_name").notNull(),
  proficiency: integer("proficiency").notNull().default(1), // 1-5
  endorsedBy: text("endorsed_by"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("agent_skill_company_idx").on(table.companyId),
  index("agent_skill_agent_idx").on(table.agentId),
  uniqueIndex("agent_skill_unique_idx").on(table.agentId, table.skillName),
]);
