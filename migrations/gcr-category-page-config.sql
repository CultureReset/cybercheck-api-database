-- ============================================================
-- GCR Category Page Config
-- Run this in GCR Supabase: adpnhipmdefutkzzltbs.supabase.co
-- ============================================================

CREATE TABLE IF NOT EXISTS gcr_category_page_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR(100) UNIQUE NOT NULL,  -- e.g. 'restaurants', 'happy-hours', 'events'
    page_title TEXT,
    page_description TEXT,
    hero_image_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcr_cat_config_category ON gcr_category_page_config(category_id);
