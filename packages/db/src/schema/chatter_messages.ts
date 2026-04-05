import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const chatterMessages = pgTable("chatter_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  channel: text("channel").notNull().default("general"),
  messageType: text("message_type").notNull().default("text"), // text, handoff, status, system
  authorAgentId: uuid("author_agent_id"),
  authorUserId: text("author_user_id"),
  body: text("body").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  issueId: uuid("issue_id"),
  runId: uuid("run_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
