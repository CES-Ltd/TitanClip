import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { invites } from "./invites.js";
import { agents } from "./agents.js";

export const joinRequests = sqliteTable(
  "join_requests",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    inviteId: text("invite_id").notNull().references(() => invites.id),
    companyId: text("company_id").notNull().references(() => companies.id),
    requestType: text("request_type").notNull(),
    status: text("status").notNull().default("pending_approval"),
    requestIp: text("request_ip").notNull(),
    requestingUserId: text("requesting_user_id"),
    requestEmailSnapshot: text("request_email_snapshot"),
    agentName: text("agent_name"),
    adapterType: text("adapter_type"),
    capabilities: text("capabilities"),
    agentDefaultsPayload: text("agent_defaults_payload").$type<Record<string, unknown> | null>(),
    claimSecretHash: text("claim_secret_hash"),
    claimSecretExpiresAt: text("claim_secret_expires_at"),
    claimSecretConsumedAt: text("claim_secret_consumed_at"),
    createdAgentId: text("created_agent_id").references(() => agents.id),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: text("approved_at"),
    rejectedByUserId: text("rejected_by_user_id"),
    rejectedAt: text("rejected_at"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    inviteUniqueIdx: uniqueIndex("join_requests_invite_unique_idx").on(table.inviteId),
    companyStatusTypeCreatedIdx: index("join_requests_company_status_type_created_idx").on(
      table.companyId,
      table.status,
      table.requestType,
      table.createdAt,
    ) }),
);
