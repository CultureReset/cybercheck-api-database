-- ============================================================
-- SMS Automation Module — DB Tables
-- Run in your MAIN CyberCheck Supabase SQL Editor
-- ============================================================

-- Automation rules
CREATE TABLE IF NOT EXISTS sms_automations (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id               UUID,                          -- NULL = platform-wide
    name                    VARCHAR(255) NOT NULL,
    trigger_type            VARCHAR(50) NOT NULL,          -- schedule | booking_created | booking_reminder | webhook | manual
    cron_schedule           VARCHAR(100),                  -- cron string for schedule triggers: "0 7 * * *" = 7am daily
    trigger_event           VARCHAR(100),                  -- event name for webhook triggers
    send_at_offset_minutes  INTEGER DEFAULT 0,             -- offset from trigger time (negative = before)
    recipient_type          VARCHAR(50) DEFAULT 'phone',   -- phone | entity_owner | customer | list
    recipient_phone         VARCHAR(20),                   -- direct phone number
    recipient_config        JSONB,                         -- { phones: [], role: 'owner' }
    message_template        TEXT NOT NULL,                 -- supports {{variables}}
    data_sources            TEXT[] DEFAULT '{}',           -- ['weather', 'bookings', 'tides', 'entity']
    is_active               BOOLEAN DEFAULT true,
    last_run_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Automation run history
CREATE TABLE IF NOT EXISTS sms_automation_logs (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    automation_id   UUID REFERENCES sms_automations(id) ON DELETE CASCADE,
    entity_id       UUID,
    recipient_phone VARCHAR(20),
    message_sent    TEXT,
    status          VARCHAR(20) DEFAULT 'sent',    -- sent | failed | pending
    twilio_sid      VARCHAR(100),
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Daily update links (catch of day, specials, menu prices)
CREATE TABLE IF NOT EXISTS sms_update_links (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id       UUID NOT NULL,
    link_type       VARCHAR(50) NOT NULL,           -- specials | catch_of_day | menu_prices | custom
    link_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    token           VARCHAR(100) UNIQUE NOT NULL,  -- secure random token — IS the URL secret
    fields_config   JSONB,                          -- which fields to show in the update form
    send_phone      VARCHAR(20),                   -- phone to SMS the link to
    expires_at      TIMESTAMPTZ,
    submitted_at    TIMESTAMPTZ,                   -- set when form is submitted (makes link one-use)
    submitted_data  JSONB,                         -- what was submitted
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_id, link_type, link_date)        -- one link per type per day per business
);

-- Webhook registrations
CREATE TABLE IF NOT EXISTS webhook_registrations (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id       UUID,
    name            VARCHAR(255) NOT NULL,
    platform        VARCHAR(100),                  -- fareharbor | toast | stripe | custom
    endpoint_path   VARCHAR(255) UNIQUE NOT NULL,  -- /api/webhooks/custom/[slug]
    secret          VARCHAR(255),                  -- for signature verification
    event_types     TEXT[] DEFAULT '{}',           -- which events to listen for
    action          VARCHAR(100),                  -- what to do: run_automation | update_entity | notify
    action_config   JSONB,                         -- config for the action
    is_active       BOOLEAN DEFAULT true,
    last_received_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook event log
CREATE TABLE IF NOT EXISTS webhook_events (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    registration_id UUID REFERENCES webhook_registrations(id) ON DELETE SET NULL,
    platform        VARCHAR(100),
    event_type      VARCHAR(100),
    payload         JSONB,
    processed       BOOLEAN DEFAULT false,
    error           TEXT,
    received_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sms_automations_entity ON sms_automations(entity_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_automation ON sms_automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_automation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_update_links_entity ON sms_update_links(entity_id, link_date);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events(received_at);
