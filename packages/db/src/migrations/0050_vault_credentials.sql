CREATE TABLE IF NOT EXISTS vault_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  credential_type text NOT NULL DEFAULT 'api_key',
  provider text NOT NULL DEFAULT 'custom',
  secret_id uuid,
  allowed_agent_ids jsonb DEFAULT NULL,
  allowed_roles jsonb DEFAULT NULL,
  rotation_policy text NOT NULL DEFAULT 'manual',
  rotation_interval_days integer,
  last_rotated_at timestamptz,
  expires_at timestamptz,
  token_ttl_seconds integer NOT NULL DEFAULT 3600,
  max_concurrent_checkouts integer NOT NULL DEFAULT 5,
  total_checkouts integer NOT NULL DEFAULT 0,
  last_checked_out_at timestamptz,
  last_checked_out_by_agent_id uuid,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vault_token_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL,
  company_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  run_id uuid,
  env_var_name text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  checked_in_at timestamptz,
  expired_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_credentials_company ON vault_credentials(company_id);
CREATE INDEX idx_vault_token_checkouts_credential ON vault_token_checkouts(credential_id);
CREATE INDEX idx_vault_token_checkouts_agent ON vault_token_checkouts(agent_id);
CREATE INDEX idx_vault_token_checkouts_status ON vault_token_checkouts(status);
