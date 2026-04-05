-- Initial SQLite migration
-- Auto-generated from PostgreSQL schema
-- This creates all tables needed for TitanClip

-- Note: SQLite uses TEXT for UUIDs, timestamps (ISO 8601), and JSON data.
-- Booleans are stored as INTEGER (0/1).
-- Foreign keys are enforced via PRAGMA foreign_keys = ON.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companies" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "pause_reason" TEXT,
  "paused_at" TEXT,
  "issue_prefix" TEXT NOT NULL DEFAULT 'PAP',
  "issue_counter" INTEGER NOT NULL DEFAULT 0,
  "budget_monthly_cents" INTEGER NOT NULL DEFAULT 0,
  "spent_monthly_cents" INTEGER NOT NULL DEFAULT 0,
  "require_board_approval_for_new_agents" INTEGER NOT NULL DEFAULT 1,
  "feedback_data_sharing_enabled" INTEGER NOT NULL DEFAULT 0,
  "feedback_data_sharing_consent_at" TEXT,
  "feedback_data_sharing_consent_by_user_id" TEXT,
  "feedback_data_sharing_terms_version" TEXT,
  "brand_color" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companies_issue_prefix_idx" ON "companies" ("issue_prefix");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_users" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT,
  "email" TEXT,
  "email_verified" INTEGER NOT NULL DEFAULT 0,
  "image" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "auth_users"("id"),
  "token" TEXT NOT NULL,
  "expires_at" TEXT NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "instance_user_roles" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "created_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "instance_settings" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT 'singleton',
  "general" TEXT NOT NULL DEFAULT '{}',
  "experimental" TEXT NOT NULL DEFAULT '{}',
  "admin" TEXT NOT NULL DEFAULT '{}',
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'general',
  "title" TEXT,
  "icon" TEXT,
  "status" TEXT NOT NULL DEFAULT 'idle',
  "reports_to" TEXT REFERENCES "agents"("id"),
  "capabilities" TEXT,
  "adapter_type" TEXT NOT NULL DEFAULT 'process',
  "adapter_config" TEXT NOT NULL DEFAULT '{}',
  "runtime_config" TEXT NOT NULL DEFAULT '{}',
  "budget_monthly_cents" INTEGER NOT NULL DEFAULT 0,
  "spent_monthly_cents" INTEGER NOT NULL DEFAULT 0,
  "pause_reason" TEXT,
  "paused_at" TEXT,
  "permissions" TEXT NOT NULL DEFAULT '{}',
  "last_heartbeat_at" TEXT,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_company_status_idx" ON "agents" ("company_id", "status");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "color" TEXT,
  "url_key" TEXT,
  "repository_url" TEXT,
  "repository_default_branch" TEXT,
  "codebase_config" TEXT,
  "execution_workspace_policy" TEXT,
  "default_workspace_mode" TEXT,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "level" TEXT NOT NULL DEFAULT 'objective',
  "status" TEXT NOT NULL DEFAULT 'active',
  "parent_id" TEXT REFERENCES "goals"("id"),
  "due_date" TEXT,
  "progress_percent" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issues" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "project_id" TEXT REFERENCES "projects"("id"),
  "goal_id" TEXT REFERENCES "goals"("id"),
  "parent_id" TEXT REFERENCES "issues"("id"),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'backlog',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "assignee_agent_id" TEXT REFERENCES "agents"("id"),
  "assignee_user_id" TEXT,
  "issue_number" INTEGER,
  "identifier" TEXT,
  "origin_kind" TEXT NOT NULL DEFAULT 'manual',
  "origin_id" TEXT,
  "origin_run_id" TEXT,
  "request_depth" INTEGER NOT NULL DEFAULT 0,
  "billing_code" TEXT,
  "assignee_adapter_overrides" TEXT,
  "execution_workspace_settings" TEXT,
  "skill_requirements" TEXT DEFAULT '[]',
  "started_at" TEXT,
  "completed_at" TEXT,
  "cancelled_at" TEXT,
  "hidden_at" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_company_status_idx" ON "issues" ("company_id", "status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "issues_identifier_idx" ON "issues" ("identifier");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "issue_comments" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "issue_id" TEXT NOT NULL REFERENCES "issues"("id"),
  "body" TEXT NOT NULL,
  "author_type" TEXT NOT NULL DEFAULT 'user',
  "author_id" TEXT,
  "agent_id" TEXT REFERENCES "agents"("id"),
  "run_id" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "heartbeat_runs" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "agent_id" TEXT NOT NULL REFERENCES "agents"("id"),
  "issue_id" TEXT REFERENCES "issues"("id"),
  "status" TEXT NOT NULL DEFAULT 'queued',
  "invocation_source" TEXT NOT NULL DEFAULT 'heartbeat',
  "trigger_detail" TEXT,
  "session_id" TEXT,
  "session_params" TEXT,
  "exit_code" INTEGER,
  "error_message" TEXT,
  "usage_input_tokens" INTEGER,
  "usage_output_tokens" INTEGER,
  "cost_usd" TEXT,
  "provider" TEXT,
  "biller" TEXT,
  "model" TEXT,
  "billing_type" TEXT,
  "started_at" TEXT,
  "completed_at" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "heartbeat_runs_company_status_idx" ON "heartbeat_runs" ("company_id", "status");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cost_events" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "agent_id" TEXT REFERENCES "agents"("id"),
  "issue_id" TEXT REFERENCES "issues"("id"),
  "run_id" TEXT,
  "provider" TEXT,
  "model" TEXT,
  "biller" TEXT,
  "billing_type" TEXT,
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "cost_usd" TEXT NOT NULL DEFAULT '0',
  "created_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "approvals" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requester_type" TEXT NOT NULL DEFAULT 'agent',
  "requester_id" TEXT,
  "payload" TEXT NOT NULL DEFAULT '{}',
  "decision_note" TEXT,
  "decided_by" TEXT,
  "decided_at" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_log" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "actor_type" TEXT NOT NULL,
  "actor_id" TEXT,
  "agent_id" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "details" TEXT,
  "created_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_log_company_idx" ON "activity_log" ("company_id", "created_at");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_memberships" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "principal_type" TEXT NOT NULL,
  "principal_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_secrets" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'local_encrypted',
  "external_ref" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routines" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "company_id" TEXT NOT NULL REFERENCES "companies"("id"),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "agent_id" TEXT REFERENCES "agents"("id"),
  "issue_template" TEXT NOT NULL DEFAULT '{}',
  "variables" TEXT NOT NULL DEFAULT '[]',
  "concurrency_policy" TEXT NOT NULL DEFAULT 'skip',
  "catch_up_policy" TEXT NOT NULL DEFAULT 'skip',
  "metadata" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

-- Note: This is a representative initial migration covering core tables.
-- Additional tables (plugins, vault, SLA, etc.) are created by subsequent
-- migration files generated from the PostgreSQL schema.
