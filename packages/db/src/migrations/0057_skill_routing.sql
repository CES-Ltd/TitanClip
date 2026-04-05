-- Agent Skill Proficiency
CREATE TABLE IF NOT EXISTS "agent_skill_proficiency" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "skill_name" text NOT NULL,
  "proficiency" integer NOT NULL DEFAULT 1,
  "endorsed_by" text,
  "notes" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "agent_skill_company_idx" ON "agent_skill_proficiency" ("company_id");
CREATE INDEX IF NOT EXISTS "agent_skill_agent_idx" ON "agent_skill_proficiency" ("agent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_skill_unique_idx" ON "agent_skill_proficiency" ("agent_id", "skill_name");

-- Add skill requirements column to issues
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "skill_requirements" jsonb DEFAULT '[]';
