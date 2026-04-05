-- Agent OS: LLM Provider Configs, Memories, Conversations, Skill Proposals
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "llm_provider_configs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL REFERENCES "companies"("id"),
  "provider_slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "base_url" TEXT,
  "api_key_secret_id" UUID REFERENCES "company_secrets"("id"),
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "llm_provider_configs_company_provider_idx" ON "llm_provider_configs" ("company_id", "provider_slug");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_memories" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL REFERENCES "companies"("id"),
  "agent_id" UUID NOT NULL REFERENCES "agents"("id"),
  "memory_type" TEXT NOT NULL,
  "category" TEXT,
  "key" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "importance" INTEGER NOT NULL DEFAULT 5,
  "source_run_id" UUID REFERENCES "heartbeat_runs"("id"),
  "source_issue_id" UUID REFERENCES "issues"("id"),
  "expires_at" TIMESTAMPTZ,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_memories_agent_type_key_idx" ON "agent_memories" ("agent_id", "memory_type", "category", "key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_memories_agent_type_idx" ON "agent_memories" ("agent_id", "memory_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_memories_company_idx" ON "agent_memories" ("company_id");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL REFERENCES "companies"("id"),
  "agent_id" UUID NOT NULL REFERENCES "agents"("id"),
  "title" TEXT,
  "issue_id" UUID REFERENCES "issues"("id"),
  "project_id" UUID REFERENCES "projects"("id"),
  "status" TEXT NOT NULL DEFAULT 'active',
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" BIGINT NOT NULL DEFAULT 0,
  "last_message_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_company_idx" ON "conversations" ("company_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_agent_idx" ON "conversations" ("agent_id", "created_at");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "company_id" UUID NOT NULL REFERENCES "companies"("id"),
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "run_id" UUID REFERENCES "heartbeat_runs"("id"),
  "token_count" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversation_messages_conv_idx" ON "conversation_messages" ("conversation_id", "created_at");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skill_proposals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL REFERENCES "companies"("id"),
  "agent_id" UUID NOT NULL REFERENCES "agents"("id"),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "proposed_markdown" TEXT NOT NULL,
  "source_run_ids" JSONB NOT NULL DEFAULT '[]',
  "source_pattern" TEXT,
  "confidence" TEXT,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "approved_skill_id" UUID REFERENCES "company_skills"("id"),
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_proposals_company_idx" ON "skill_proposals" ("company_id", "status");

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skill_usage_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL REFERENCES "companies"("id"),
  "skill_id" UUID NOT NULL REFERENCES "company_skills"("id"),
  "agent_id" UUID NOT NULL REFERENCES "agents"("id"),
  "run_id" UUID REFERENCES "heartbeat_runs"("id"),
  "outcome" TEXT NOT NULL,
  "duration_ms" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_usage_events_skill_idx" ON "skill_usage_events" ("skill_id");
