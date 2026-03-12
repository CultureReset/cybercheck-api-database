-- ============================================================
-- Migration 10: media_library + availability_blocks tables
-- Run in Supabase SQL Editor
-- ============================================================

-- Media library (photos/videos per business)
CREATE TABLE IF NOT EXISTS media_library (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     TEXT NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    caption     TEXT,
    type        TEXT DEFAULT 'image', -- image | video
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_library_site ON media_library(site_id, sort_order);

-- RLS: business owner can manage their media
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_library_owner ON media_library
    USING (site_id IN (SELECT site_id FROM users WHERE id = auth.uid()));

-- Allow service role full access
CREATE POLICY media_library_service ON media_library
    USING (auth.role() = 'service_role');

-- ============================================================
-- Availability blocks (owner-blocked dates/times)
-- ============================================================
CREATE TABLE IF NOT EXISTS availability_blocks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     TEXT NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    block_date  DATE NOT NULL,
    start_time  TIME,            -- null = whole day
    end_time    TIME,
    fleet_type_id TEXT,          -- null = all fleet types
    reason      TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avail_blocks_site_date ON availability_blocks(site_id, block_date);

ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY avail_blocks_owner ON availability_blocks
    USING (site_id IN (SELECT site_id FROM users WHERE id = auth.uid()));
CREATE POLICY avail_blocks_service ON availability_blocks
    USING (auth.role() = 'service_role');

-- ============================================================
-- Tourist tables (for GCR SMS loyalty)
-- ============================================================
CREATE TABLE IF NOT EXISTS tourist_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT,
    phone        TEXT,
    interests    TEXT[],
    visitor_type TEXT,
    checkin      DATE,
    checkout     DATE,
    session_id   UUID UNIQUE DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tourist_conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES tourist_sessions(session_id),
    role       TEXT NOT NULL, -- user | assistant
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tourist_conv_session ON tourist_conversations(session_id, created_at);
