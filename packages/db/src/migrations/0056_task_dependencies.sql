-- Issue Dependencies
CREATE TABLE IF NOT EXISTS "issue_dependencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "source_issue_id" uuid NOT NULL,
  "target_issue_id" uuid NOT NULL,
  "dependency_type" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "issue_deps_source_idx" ON "issue_dependencies" ("source_issue_id");
CREATE INDEX IF NOT EXISTS "issue_deps_target_idx" ON "issue_dependencies" ("target_issue_id");
CREATE UNIQUE INDEX IF NOT EXISTS "issue_deps_unique_idx" ON "issue_dependencies" ("source_issue_id", "target_issue_id", "dependency_type");

-- Workflow Templates
CREATE TABLE IF NOT EXISTS "workflow_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "steps" jsonb NOT NULL DEFAULT '[]',
  "enabled" boolean NOT NULL DEFAULT true,
  "usage_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "workflow_templates_company_idx" ON "workflow_templates" ("company_id");
