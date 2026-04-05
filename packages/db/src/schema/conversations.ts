import { pgTable, uuid, text, integer, timestamp, jsonb, index, bigint } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    title: text("title"),
    issueId: uuid("issue_id").references(() => issues.id),
    projectId: uuid("project_id").references(() => projects.id),
    status: text("status").notNull().default("active"), // active, archived
    messageCount: integer("message_count").notNull().default(0),
    totalTokens: bigint("total_tokens", { mode: "number" }).notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("conversations_company_idx").on(table.companyId, table.createdAt),
    agentIdx: index("conversations_agent_idx").on(table.agentId, table.createdAt),
    issueIdx: index("conversations_issue_idx").on(table.issueId),
  })
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    role: text("role").notNull(), // user, assistant, system, tool_call, tool_result
    content: text("content").notNull(),
    runId: uuid("run_id").references(() => heartbeatRuns.id),
    tokenCount: integer("token_count"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationIdx: index("conversation_messages_conv_idx").on(table.conversationId, table.createdAt),
    companyIdx: index("conversation_messages_company_idx").on(table.companyId, table.createdAt),
  })
);
