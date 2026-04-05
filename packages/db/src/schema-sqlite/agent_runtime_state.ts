import { sqliteTable, text, bigint, index } from "drizzle-orm/sqlite-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const agentRuntimeState = sqliteTable(
  "agent_runtime_state",
  {
    agentId: text("agent_id").primaryKey().references(() => agents.id),
    companyId: text("company_id").notNull().references(() => companies.id),
    adapterType: text("adapter_type").notNull(),
    sessionId: text("session_id"),
    stateJson: text("state_json").$type<Record<string, unknown>>().notNull().default('{}'),
    lastRunId: text("last_run_id"),
    lastRunStatus: text("last_run_status"),
    totalInputTokens: bigint("total_input_tokens", { mode: "number" }).notNull().default(0),
    totalOutputTokens: bigint("total_output_tokens", { mode: "number" }).notNull().default(0),
    totalCachedInputTokens: bigint("total_cached_input_tokens", { mode: "number" }).notNull().default(0),
    totalCostCents: bigint("total_cost_cents", { mode: "number" }).notNull().default(0),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyAgentIdx: index("agent_runtime_state_company_agent_idx").on(table.companyId, table.agentId),
    companyUpdatedIdx: index("agent_runtime_state_company_updated_idx").on(table.companyId, table.updatedAt) }),
);

