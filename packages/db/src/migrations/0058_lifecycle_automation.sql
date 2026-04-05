-- Onboarding Workflows
CREATE TABLE IF NOT EXISTS "onboarding_workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "target_role" text NOT NULL DEFAULT 'general',
  "steps" jsonb NOT NULL DEFAULT '[]',
  "enabled" boolean NOT NULL DEFAULT true,
  "usage_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "onboarding_wf_company_idx" ON "onboarding_workflows" ("company_id");

-- Onboarding Instances (tracks which agents went through which onboarding)
CREATE TABLE IF NOT EXISTS "onboarding_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "workflow_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "issue_ids" jsonb DEFAULT '[]',
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "onboarding_inst_company_idx" ON "onboarding_instances" ("company_id");
CREATE INDEX IF NOT EXISTS "onboarding_inst_agent_idx" ON "onboarding_instances" ("agent_id");

-- Change Requests
CREATE TABLE IF NOT EXISTS "change_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "category" text NOT NULL DEFAULT 'other',
  "risk" text NOT NULL DEFAULT 'medium',
  "status" text NOT NULL DEFAULT 'draft',
  "requested_by_user_id" text NOT NULL DEFAULT 'board',
  "reviewer_notes" text NOT NULL DEFAULT '',
  "affected_agent_ids" jsonb DEFAULT '[]',
  "scheduled_at" timestamptz,
  "implemented_at" timestamptz,
  "rolled_back_at" timestamptz,
  "validation_steps" text NOT NULL DEFAULT '',
  "validation_result" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "change_requests_company_idx" ON "change_requests" ("company_id", "status");
