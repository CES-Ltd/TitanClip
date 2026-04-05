import { pgTable, uuid, text, integer, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { issues } from "./issues.js";

export const agentMemories = pgTable(
  "agent_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    memoryType: text("memory_type").notNull(), // user_profile, preference, project_context, learned_fact, entity
    category: text("category"), // grouping key
    key: text("key").notNull(), // dedup/lookup key
    content: text("content").notNull(),
    importance: integer("importance").notNull().default(5), // 1-10
    sourceRunId: uuid("source_run_id").references(() => heartbeatRuns.id),
    sourceIssueId: uuid("source_issue_id").references(() => issues.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentTypeKeyIdx: uniqueIndex("agent_memories_agent_type_key_idx").on(
      table.agentId, table.memoryType, table.category, table.key
    ),
    agentTypeIdx: index("agent_memories_agent_type_idx").on(table.agentId, table.memoryType),
    companyIdx: index("agent_memories_company_idx").on(table.companyId),
  })
);
