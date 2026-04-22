-- Per-booking TCPA consent record for customer SMS
-- Stored inline on the bookings row so each booking carries its own consent proof.
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS sms_consent boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz,
    ADD COLUMN IF NOT EXISTS sms_consent_ip text,
    ADD COLUMN IF NOT EXISTS sms_consent_text text;
