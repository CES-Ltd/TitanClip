-- SLA Policies
CREATE TABLE IF NOT EXISTS "sla_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "priority" text NOT NULL DEFAULT 'medium',
  "target_response_minutes" integer NOT NULL DEFAULT 60,
  "target_resolution_minutes" integer NOT NULL DEFAULT 480,
  "breach_action" text NOT NULL DEFAULT 'notify',
  "escalate_to_agent_id" uuid,
  "notify_user_ids" jsonb DEFAULT '[]',
  "is_default" boolean NOT NULL DEFAULT false,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sla_policies_company_idx" ON "sla_policies" ("company_id");

-- SLA Tracking
CREATE TABLE IF NOT EXISTS "sla_tracking" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "issue_id" uuid NOT NULL,
  "policy_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'running',
  "clock_started_at" timestamptz NOT NULL DEFAULT now(),
  "clock_paused_at" timestamptz,
  "total_paused_minutes" integer NOT NULL DEFAULT 0,
  "response_deadline" timestamptz NOT NULL,
  "resolution_deadline" timestamptz NOT NULL,
  "responded_at" timestamptz,
  "resolved_at" timestamptz,
  "response_breached" boolean NOT NULL DEFAULT false,
  "resolution_breached" boolean NOT NULL DEFAULT false,
  "breach_notified_at" timestamptz,
  "breach_action_taken" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "sla_tracking_company_status_idx" ON "sla_tracking" ("company_id", "status");
CREATE INDEX IF NOT EXISTS "sla_tracking_issue_idx" ON "sla_tracking" ("issue_id");

-- Escalation Rules
CREATE TABLE IF NOT EXISTS "escalation_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "trigger" text NOT NULL,
  "trigger_threshold" integer NOT NULL DEFAULT 3,
  "action" text NOT NULL,
  "target_agent_id" uuid,
  "notify_user_ids" jsonb DEFAULT '[]',
  "cooldown_minutes" integer NOT NULL DEFAULT 60,
  "enabled" boolean NOT NULL DEFAULT true,
  "last_fired_at" timestamptz,
  "fire_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "escalation_rules_company_idx" ON "escalation_rules" ("company_id");
