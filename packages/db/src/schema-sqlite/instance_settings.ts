import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const instanceSettings = sqliteTable(
  "instance_settings",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    singletonKey: text("singleton_key").notNull().default("default"),
    general: text("general").$type<Record<string, unknown>>().notNull().default('{}'),
    experimental: text("experimental").$type<Record<string, unknown>>().notNull().default('{}'),
    admin: text("admin").$type<Record<string, unknown>>().notNull().default('{}'),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    singletonKeyIdx: uniqueIndex("instance_settings_singleton_key_idx").on(table.singletonKey) }),
);
