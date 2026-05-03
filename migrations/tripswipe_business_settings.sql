-- TripSwipe Business Settings
-- Stores per-business TripSwipe overrides completely separate from GCR.
-- Run this in your GCR Supabase SQL editor.

CREATE TABLE IF NOT EXISTS tripswipe_business_settings (
    slug        TEXT PRIMARY KEY,
    enabled     BOOLEAN DEFAULT true,
    hero_image  TEXT,
    extra_images TEXT[] DEFAULT '{}',
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ts_biz_settings_enabled ON tripswipe_business_settings(enabled);
