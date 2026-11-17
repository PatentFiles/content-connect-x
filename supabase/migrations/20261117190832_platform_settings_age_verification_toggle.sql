/*
# Platform settings: global age verification toggle

1. New Tables
- `platform_settings` — singleton key/value settings table for global platform toggles.
  - `key` (text, primary key) — setting name
  - `value` (jsonb, not null) — setting value
  - `updated_at` (timestamptz) — last change
  - `updated_by` (uuid) — admin who changed it

2. Data
- Seed `age_verification_required` = true (current behavior preserved).

3. Security
- Enable RLS on `platform_settings`.
- GRANT SELECT to `authenticated` so the frontend can read the toggle.
- GRANT SELECT, INSERT, UPDATE to `service_role` for edge function admin writes.
- Only `service_role` can write; no client-side writes.
*/

CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON platform_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON platform_settings TO service_role;

INSERT INTO platform_settings (key, value, updated_at)
VALUES ('age_verification_required', 'true'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
