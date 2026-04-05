import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const teamRoles = pgTable(
  "team_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("member"), // instance_admin, team_admin, member, viewer
    assignedBy: text("assigned_by"), // userId who assigned this role
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueUserCompany: uniqueIndex("team_roles_user_company_idx").on(table.companyId, table.userId),
  }),
);
