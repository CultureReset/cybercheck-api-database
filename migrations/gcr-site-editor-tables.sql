-- ============================================================
-- GCR Site Editor Tables
-- Run in GCR Supabase: adpnhipmdefutkzzltbs.supabase.co
-- ============================================================

-- Site config (one row — homepage hero, global settings)
CREATE TABLE IF NOT EXISTS gcr_site_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hero_title TEXT,
    hero_subtitle TEXT,
    hero_image_url TEXT,
    hero_cta_text TEXT,
    hero_cta_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category cards (home page grid)
CREATE TABLE IF NOT EXISTS gcr_category_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label VARCHAR(100) NOT NULL,
    emoji VARCHAR(10),
    image_url TEXT,
    href VARCHAR(200),
    sort_order INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcr_cat_cards_sort ON gcr_category_cards(sort_order);

-- Page assignments (controls entity order on category listing pages)
CREATE TABLE IF NOT EXISTS gcr_page_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0,
    UNIQUE(category_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_gcr_page_assign_cat ON gcr_page_assignments(category_id);

-- Entity pages (custom section layout per entity profile)
CREATE TABLE IF NOT EXISTS gcr_entity_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    section_key VARCHAR(100) NOT NULL,
    section_label TEXT,
    sort_order INT DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_gcr_entity_pages_entity ON gcr_entity_pages(entity_id);
