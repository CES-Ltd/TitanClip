import { sqliteTable, text, integer, index} from "drizzle-orm/sqlite-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";
import { goals } from "./goals.js";
import { heartbeatRuns } from "./heartbeat_runs.js";
import { costEvents } from "./cost_events.js";

export const financeEvents = sqliteTable(
  "finance_events",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    companyId: text("company_id").notNull().references(() => companies.id),
    agentId: text("agent_id").references(() => agents.id),
    issueId: text("issue_id").references(() => issues.id),
    projectId: text("project_id").references(() => projects.id),
    goalId: text("goal_id").references(() => goals.id),
    heartbeatRunId: text("heartbeat_run_id").references(() => heartbeatRuns.id),
    costEventId: text("cost_event_id").references(() => costEvents.id),
    billingCode: text("billing_code"),
    description: text("description"),
    eventKind: text("event_kind").notNull(),
    direction: text("direction").notNull().default("debit"),
    biller: text("biller").notNull(),
    provider: text("provider"),
    executionAdapterType: text("execution_adapter_type"),
    pricingTier: text("pricing_tier"),
    region: text("region"),
    model: text("model"),
    quantity: integer("quantity"),
    unit: text("unit"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    estimated: integer("estimated", { mode: "boolean" }).notNull().default(false),
    externalInvoiceId: text("external_invoice_id"),
    metadataJson: text("metadata_json").$type<Record<string, unknown> | null>(),
    occurredAt: text("occurred_at").notNull(),
    createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()) },
  (table) => ({
    companyOccurredIdx: index("finance_events_company_occurred_idx").on(table.companyId, table.occurredAt),
    companyBillerOccurredIdx: index("finance_events_company_biller_occurred_idx").on(
      table.companyId,
      table.biller,
      table.occurredAt,
    ),
    companyKindOccurredIdx: index("finance_events_company_kind_occurred_idx").on(
      table.companyId,
      table.eventKind,
      table.occurredAt,
    ),
    companyDirectionOccurredIdx: index("finance_events_company_direction_occurred_idx").on(
      table.companyId,
      table.direction,
      table.occurredAt,
    ),
    companyHeartbeatRunIdx: index("finance_events_company_heartbeat_run_idx").on(
      table.companyId,
      table.heartbeatRunId,
    ),
    companyCostEventIdx: index("finance_events_company_cost_event_idx").on(
      table.companyId,
      table.costEventId,
    ) }),
);
