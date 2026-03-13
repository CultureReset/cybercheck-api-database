-- ============================================================
-- Migration 11: waitlist + waitlist_settings + locations
-- Run in Supabase SQL Editor
-- ============================================================

-- Waitlist entries (customers waiting for an open slot)
CREATE TABLE IF NOT EXISTS waitlist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         TEXT NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    customer_name   TEXT NOT NULL,
    customer_email  TEXT,
    customer_phone  TEXT,
    preferred_date  DATE,
    preferred_slot  TEXT,           -- e.g. "Half Day AM", "All Day"
    fleet_type_id   UUID REFERENCES fleet_types(id),
    party_size      INTEGER DEFAULT 1,
    status          TEXT DEFAULT 'waiting', -- waiting | notified | booked | removed
    notified_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_site ON waitlist(site_id, status, created_at);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlist_owner ON waitlist
    USING (site_id IN (SELECT site_id FROM users WHERE id = auth.uid()));
CREATE POLICY waitlist_service ON waitlist
    USING (auth.role() = 'service_role');

-- Waitlist settings per business
CREATE TABLE IF NOT EXISTS waitlist_settings (
    site_id         TEXT PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    enabled         BOOLEAN DEFAULT true,
    max_size        INTEGER DEFAULT 20,
    auto_notify     BOOLEAN DEFAULT true,
    sms_message     TEXT DEFAULT 'Great news, {{customer_name}}! A spot just opened up for {{date}} ({{time_slot}}). Book now: {{booking_link}}',
    updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE waitlist_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlist_settings_owner ON waitlist_settings
    USING (site_id IN (SELECT site_id FROM users WHERE id = auth.uid()));
CREATE POLICY waitlist_settings_service ON waitlist_settings
    USING (auth.role() = 'service_role');

-- ============================================================
-- Locations (pickup/launch points per business)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     TEXT NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    address     TEXT,
    city        TEXT,
    state       TEXT,
    zip         TEXT,
    lat         DECIMAL(10,7),
    lng         DECIMAL(10,7),
    phone       TEXT,
    notes       TEXT,
    is_primary  BOOLEAN DEFAULT false,
    active      BOOLEAN DEFAULT true,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_site ON locations(site_id, sort_order);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY locations_owner ON locations
    USING (site_id IN (SELECT site_id FROM users WHERE id = auth.uid()));
CREATE POLICY locations_service ON locations
    USING (auth.role() = 'service_role');
