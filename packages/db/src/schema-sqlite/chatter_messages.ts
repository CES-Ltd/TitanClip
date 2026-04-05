import { sqliteTable, text} from "drizzle-orm/sqlite-core";

export const chatterMessages = sqliteTable("chatter_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyId: text("company_id").notNull(),
  channel: text("channel").notNull().default("general"),
  messageType: text("message_type").notNull().default("text"), // text, handoff, status, system
  authorAgentId: text("author_agent_id"),
  authorUserId: text("author_user_id"),
  body: text("body").notNull(),
  metadata: text("metadata").$type<Record<string, unknown>>().default('{}'),
  issueId: text("issue_id"),
  runId: text("run_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()) });
