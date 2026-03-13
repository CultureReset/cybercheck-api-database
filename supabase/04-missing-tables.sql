-- ============================================
-- MISSING TABLES (run in Supabase SQL Editor)
-- These are queried by the backend but not
-- defined in the main schema files.
-- ============================================

-- platform_settings — stores platform-level config (API keys, feature flags)
-- Used by admin.js routes for saving/reading platform config
CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- site_data_store — full-blob CMS data store per business
-- Used by server.js GET/POST /api/site-data for page builder saves
CREATE TABLE IF NOT EXISTS site_data_store (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- booking_time column fix — bookings table stores times as text (e.g. "10:00 AM")
-- Run this if bookings are returning 500 errors
ALTER TABLE bookings ALTER COLUMN booking_time TYPE TEXT USING booking_time::TEXT;
