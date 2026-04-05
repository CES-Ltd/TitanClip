import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";

export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").references(() => companies.id),
    inviteType: text("invite_type").notNull().default("company_join"),
    tokenHash: text("token_hash").notNull(),
    allowedJoinTypes: text("allowed_join_types").notNull().default("both"),
    defaultsPayload: text("defaults_payload").$type<Record<string, unknown> | null>(),
    expiresAt: text("expires_at").notNull(),
    invitedByUserId: text("invited_by_user_id"),
    revokedAt: text("revoked_at"),
    acceptedAt: text("accepted_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    tokenHashUniqueIdx: uniqueIndex("invites_token_hash_unique_idx").on(table.tokenHash),
    companyInviteStateIdx: index("invites_company_invite_state_idx").on(
      table.companyId,
      table.inviteType,
      table.revokedAt,
      table.expiresAt,
    ) }),
);
