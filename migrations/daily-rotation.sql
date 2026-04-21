-- ============================================================
-- Daily Rotating Sections
-- Admin-defined preset sections (e.g. "Catch of the Day") with
-- preset options (e.g. Mahi, Grouper, Tuna). Business owners pick
-- which options are active today via the daily update link.
--
-- Run in GCR Supabase: adpnhipmdefutkzzltbs.supabase.co
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_rotation_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_rotation_sections_entity
    ON daily_rotation_sections(entity_id, sort_order);

CREATE TABLE IF NOT EXISTS daily_rotation_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES daily_rotation_sections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    default_price NUMERIC(10,2),
    default_description TEXT,
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_daily_rotation_options_section
    ON daily_rotation_options(section_id, sort_order);

-- Owner's daily picks. One row per (entity, option, date).
-- Unchecked options simply have no row for that date → not shown publicly.
CREATE TABLE IF NOT EXISTS daily_rotation_picks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES daily_rotation_sections(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES daily_rotation_options(id) ON DELETE CASCADE,
    pick_date DATE NOT NULL DEFAULT CURRENT_DATE,
    price_override NUMERIC(10,2),
    description_override TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_id, option_id, pick_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_rotation_picks_today
    ON daily_rotation_picks(entity_id, pick_date);
