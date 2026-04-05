-- Session Agents: temporary agents created on-the-fly by Agent OS
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "is_session_agent" BOOLEAN NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "session_expires_at" TIMESTAMPTZ;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "parent_agent_id" UUID REFERENCES "agents"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_session_idx" ON "agents" ("company_id", "is_session_agent") WHERE "is_session_agent" = true;
