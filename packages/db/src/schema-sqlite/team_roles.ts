import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const teamRoles = sqliteTable(
  "team_roles",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("member"), // instance_admin, team_admin, member, viewer
    assignedBy: text("assigned_by"), // userId who assigned this role
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    uniqueUserCompany: uniqueIndex("team_roles_user_company_idx").on(table.companyId, table.userId) }),
);
