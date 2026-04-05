import { sqliteTable, uniqueIndex } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { assets } from "./assets.js";

export const companyLogos = sqliteTable(
  "company_logos",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    assetId: text("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyUq: uniqueIndex("company_logos_company_uq").on(table.companyId),
    assetUq: uniqueIndex("company_logos_asset_uq").on(table.assetId) }),
);
