CREATE TABLE IF NOT EXISTS chatter_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'general',
  message_type text NOT NULL DEFAULT 'text',
  author_agent_id uuid,
  author_user_id text,
  body text NOT NULL,
  metadata jsonb DEFAULT '{}',
  issue_id uuid,
  run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chatter_company_channel ON chatter_messages(company_id, channel, created_at);
