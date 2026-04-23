-- Add SMS consent columns to messaging_settings table
ALTER TABLE messaging_settings
  ADD COLUMN IF NOT EXISTS owner_sms_consent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_sms_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_sms_consent_text text,
  ADD COLUMN IF NOT EXISTS notification_email_2 text;

-- Seed Circle Boats owner consent (owner confirmed consent in dashboard)
UPDATE messaging_settings
  SET owner_sms_consent = true,
      owner_sms_consent_at = now(),
      owner_sms_consent_text = 'Business owner consent — confirmed via dashboard'
  WHERE site_id = '22222222-2222-2222-2222-222222222222';
