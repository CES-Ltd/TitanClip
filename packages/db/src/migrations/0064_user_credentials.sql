-- User-scoped credentials: allow non-admin users to manage dev credentials
--> statement-breakpoint
ALTER TABLE "vault_credentials" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'admin';
--> statement-breakpoint
ALTER TABLE "vault_credentials" ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vault_credentials_scope_idx" ON "vault_credentials" ("company_id", "scope");
