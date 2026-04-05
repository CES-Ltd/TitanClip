import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";
import { authUsers } from "./auth.js";
import { companies } from "./companies.js";
import { boardApiKeys } from "./board_api_keys.js";

export const cliAuthChallenges = sqliteTable(
  "cli_auth_challenges",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    secretHash: text("secret_hash").notNull(),
    command: text("command").notNull(),
    clientName: text("client_name"),
    requestedAccess: text("requested_access").notNull().default("board"),
    requestedCompanyId: text("requested_company_id").references(() => companies.id, { onDelete: "set null" }),
    pendingKeyHash: text("pending_key_hash").notNull(),
    pendingKeyName: text("pending_key_name").notNull(),
    approvedByUserId: text("approved_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    boardApiKeyId: text("board_api_key_id").references(() => boardApiKeys.id, { onDelete: "set null" }),
    approvedAt: text("approved_at"),
    cancelledAt: text("cancelled_at"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    secretHashIdx: index("cli_auth_challenges_secret_hash_idx").on(table.secretHash),
    approvedByIdx: index("cli_auth_challenges_approved_by_idx").on(table.approvedByUserId),
    requestedCompanyIdx: index("cli_auth_challenges_requested_company_idx").on(table.requestedCompanyId) }),
);
