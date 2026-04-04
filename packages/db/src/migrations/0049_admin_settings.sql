ALTER TABLE instance_settings ADD COLUMN IF NOT EXISTS admin jsonb NOT NULL DEFAULT '{}'::jsonb;
