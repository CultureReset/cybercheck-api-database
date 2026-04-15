-- ============================================================
-- GCR: entity_integrations — stores OAuth tokens for connected
-- platforms (Google Business, Facebook, Instagram, Square, etc.)
-- Run this in the GCR Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_integrations (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id       UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    platform        VARCHAR(50) NOT NULL,   -- google_business | facebook | instagram | square | stripe
    access_token    TEXT,                   -- OAuth access token (encrypted at rest by Supabase)
    refresh_token   TEXT,                   -- OAuth refresh token
    platform_id     VARCHAR(255),           -- Platform's user/page/location ID
    platform_user   VARCHAR(255),           -- Human-readable name/handle
    scope           TEXT,                   -- Granted OAuth scopes
    token_expires_at TIMESTAMPTZ,
    connected_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_id, platform)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_entity_integrations_entity ON entity_integrations(entity_id);

-- RLS: only authenticated service role can read tokens
ALTER TABLE entity_integrations ENABLE ROW LEVEL SECURITY;
