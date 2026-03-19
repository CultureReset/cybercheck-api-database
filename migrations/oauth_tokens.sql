-- OAuth Tokens Table
-- Stores encrypted OAuth tokens for third-party integrations per site
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS oauth_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id       UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    provider      TEXT NOT NULL,        -- 'google_business', 'facebook', 'instagram', etc.
    access_token  TEXT,                 -- AES-256-GCM encrypted
    refresh_token TEXT,                 -- AES-256-GCM encrypted
    expires_at    TIMESTAMPTZ,
    account_email TEXT,
    account_name  TEXT,
    account_id    TEXT,                 -- Provider's account/location ID
    extra         JSONB DEFAULT '{}',   -- Provider-specific data (location list, etc.)
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (site_id, provider)
);

-- Index for fast per-site lookups
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_site_provider ON oauth_tokens(site_id, provider);

-- RLS: only service role can read/write (API handles auth)
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON oauth_tokens USING (false);  -- block all direct access
