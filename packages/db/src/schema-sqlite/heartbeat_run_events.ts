import { sqliteTable, text, integer, index, bigserial } from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const heartbeatRunEvents = sqliteTable(
  "heartbeat_run_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    companyId: text("company_id").notNull().references(() => companies.id),
    runId: text("run_id").notNull().references(() => heartbeatRuns.id),
    agentId: text("agent_id").notNull().references(() => agents.id),
    seq: integer("seq").notNull(),
    eventType: text("event_type").notNull(),
    stream: text("stream"),
    level: text("level"),
    color: text("color"),
    message: text("message"),
    payload: text("payload").$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    runSeqIdx: index("heartbeat_run_events_run_seq_idx").on(table.runId, table.seq),
    companyRunIdx: index("heartbeat_run_events_company_run_idx").on(table.companyId, table.runId),
    companyCreatedIdx: index("heartbeat_run_events_company_created_idx").on(table.companyId, table.createdAt) }),
);

