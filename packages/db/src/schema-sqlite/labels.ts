import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";

export const labels = sqliteTable(
  "labels",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyIdx: index("labels_company_idx").on(table.companyId),
    companyNameIdx: uniqueIndex("labels_company_name_idx").on(table.companyId, table.name) }),
);
