CREATE TABLE IF NOT EXISTS team_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  assigned_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS team_roles_user_company_idx ON team_roles(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_roles_company ON team_roles(company_id);
