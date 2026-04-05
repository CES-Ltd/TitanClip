import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { companySkills } from "./company_skills.js";
import { heartbeatRuns } from "./heartbeat_runs.js";

export const skillProposals = pgTable(
  "skill_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    title: text("title").notNull(),
    description: text("description"),
    proposedMarkdown: text("proposed_markdown").notNull(),
    sourceRunIds: jsonb("source_run_ids").$type<string[]>().notNull().default([]),
    sourcePattern: text("source_pattern"),
    confidence: text("confidence"), // "0.00"-"1.00" as text to avoid numeric issues
    status: text("status").notNull().default("proposed"), // proposed, approved, rejected, installed
    approvedSkillId: uuid("approved_skill_id").references(() => companySkills.id),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("skill_proposals_company_idx").on(table.companyId, table.status),
    agentIdx: index("skill_proposals_agent_idx").on(table.agentId),
  })
);

export const skillUsageEvents = pgTable(
  "skill_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    skillId: uuid("skill_id").notNull().references(() => companySkills.id),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    runId: uuid("run_id").references(() => heartbeatRuns.id),
    outcome: text("outcome").notNull(), // success, partial, failure
    durationMs: text("duration_ms"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    skillIdx: index("skill_usage_events_skill_idx").on(table.skillId),
    companyIdx: index("skill_usage_events_company_idx").on(table.companyId),
  })
);
