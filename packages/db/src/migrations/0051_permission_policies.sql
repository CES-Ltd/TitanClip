CREATE TABLE IF NOT EXISTS permission_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  name text NOT NULL,
  description text DEFAULT '',
  can_create_issues boolean NOT NULL DEFAULT true,
  can_update_issues boolean NOT NULL DEFAULT true,
  can_delete_issues boolean NOT NULL DEFAULT false,
  can_create_agents boolean NOT NULL DEFAULT false,
  can_manage_secrets boolean NOT NULL DEFAULT false,
  can_access_vault boolean NOT NULL DEFAULT false,
  can_approve_requests boolean NOT NULL DEFAULT false,
  allowed_vault_credentials jsonb DEFAULT NULL,
  allowed_workspaces jsonb DEFAULT NULL,
  max_concurrent_runs integer NOT NULL DEFAULT 3,
  max_run_duration_seconds integer NOT NULL DEFAULT 3600,
  allowed_domains jsonb DEFAULT NULL,
  blocked_domains jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_permission_policies_company ON permission_policies(company_id);
