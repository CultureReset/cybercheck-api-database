-- ============================================================
-- GCR Entity Schema — Gulf Coast Radar
-- Separate Supabase project: adpnhipmdefutkzzltbs.supabase.co
-- Run this in the GCR Supabase SQL Editor
-- ============================================================

-- ============================================
-- ENTITY (one row per GCR business)
-- ============================================
CREATE TABLE entity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    subtitle TEXT,
    entity_type VARCHAR(50) NOT NULL DEFAULT 'business',
    entity_subtype VARCHAR(100),          -- dolphin_cruise, parasailing, restaurant, hybrid_venue
    icon VARCHAR(10),                      -- emoji
    phone VARCHAR(30),
    rating NUMERIC(3,1),
    review_count INT DEFAULT 0,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(10),
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    hero_image_url TEXT,
    website_url TEXT,
    directions_url TEXT,
    call_url TEXT,
    parent_entity_id UUID REFERENCES entity(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entity_slug ON entity(slug);
CREATE INDEX idx_entity_subtype ON entity(entity_subtype);
CREATE INDEX idx_entity_active ON entity(is_active);

-- ============================================
-- ENTITY FEATURES (feature chips)
-- ============================================
CREATE TABLE entity_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE INDEX idx_entity_features_entity ON entity_features(entity_id);

-- ============================================
-- ENTITY PERFECT FOR (perfect_for chips)
-- ============================================
CREATE TABLE entity_perfect_for (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE INDEX idx_entity_perfect_for_entity ON entity_perfect_for(entity_id);

-- ============================================
-- ENTITY SECTIONS (one row per tab/section)
-- section_type controls which content table renders it
-- ============================================
CREATE TABLE entity_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    section_key VARCHAR(100) NOT NULL,      -- about, highlights, cruise_times, dinner, happy_hour...
    section_label VARCHAR(100) NOT NULL,    -- display label for nav tab
    section_type VARCHAR(50) NOT NULL,      -- rich_text | bullets | grouped_items | cards | gallery | reviews | hours | location
    sort_order INT DEFAULT 0,
    UNIQUE(entity_id, section_key)
);

CREATE INDEX idx_entity_sections_entity ON entity_sections(entity_id);

-- ============================================
-- SECTION: RICH TEXT (about text)
-- ============================================
CREATE TABLE section_rich_text (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    body_text TEXT,
    UNIQUE(section_id)
);

-- ============================================
-- SECTION: BULLETS (highlights, guest info, restrictions)
-- One row per bullet
-- ============================================
CREATE TABLE section_bullets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    bullet_text TEXT NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE INDEX idx_section_bullets_section ON section_bullets(section_id);

-- ============================================
-- SECTION: GROUPS (groups within grouped_items)
-- e.g. "3:30 PM Afternoon Cruise", "Starters", "Draft Beer"
-- ============================================
CREATE TABLE section_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    title TEXT,
    subtitle TEXT,
    note_text TEXT,
    sort_order INT DEFAULT 0
);

CREATE INDEX idx_section_groups_section ON section_groups(section_id);

-- ============================================
-- SECTION: ITEMS (one row per item — menu item, ticket, drink, etc)
-- EVERY item is its own row. Name, description, price ALL separate columns.
-- ============================================
CREATE TABLE section_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    group_id UUID REFERENCES section_groups(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    item_description TEXT,
    price_label TEXT,
    price_text TEXT,
    price_numeric NUMERIC(10,2),
    price_min NUMERIC(10,2),
    price_max NUMERIC(10,2),
    unit_label TEXT,
    item_type VARCHAR(50),    -- menu_item | ticket | hh_item | drink_item | beer_item | wine_item | spirit_item | game_item
    metadata_json JSONB DEFAULT '{}',
    sort_order INT DEFAULT 0
);

CREATE INDEX idx_section_items_section ON section_items(section_id);
CREATE INDEX idx_section_items_group ON section_items(group_id);
CREATE INDEX idx_section_items_type ON section_items(item_type);

-- ============================================
-- SECTION: CARDS (packages, bookings, events)
-- ============================================
CREATE TABLE section_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    title TEXT,
    subtitle TEXT,
    description TEXT,
    badge_text TEXT,
    price_text TEXT,
    image_url TEXT,
    link_url TEXT,
    sort_order INT DEFAULT 0
);

CREATE INDEX idx_section_cards_section ON section_cards(section_id);

-- ============================================
-- SECTION: PHOTOS (gallery)
-- ============================================
CREATE TABLE section_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    alt_text TEXT,
    sort_order INT DEFAULT 0
);

CREATE INDEX idx_section_photos_section ON section_photos(section_id);

-- ============================================
-- SECTION: REVIEWS
-- ============================================
CREATE TABLE section_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    author_name TEXT,
    rating NUMERIC(2,1),
    review_text TEXT,
    review_date DATE,
    source VARCHAR(50),
    sort_order INT DEFAULT 0
);

CREATE INDEX idx_section_reviews_section ON section_reviews(section_id);

-- ============================================
-- SECTION: HOURS (one row per day)
-- ============================================
CREATE TABLE section_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    day_of_week VARCHAR(10) NOT NULL,   -- Monday, Tuesday, Wednesday...
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN DEFAULT false,
    note_text TEXT,
    sort_order INT DEFAULT 0
);

CREATE INDEX idx_section_hours_section ON section_hours(section_id);

-- ============================================
-- SECTION: LOCATION
-- ============================================
CREATE TABLE section_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    directions_url TEXT,
    phone TEXT,
    website_url TEXT,
    note_text TEXT,
    UNIQUE(section_id)
);

-- ============================================
-- ENTITY TAGS (searchable tags — added via dashboard)
-- ============================================
CREATE TABLE entity_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    tag_category VARCHAR(50),   -- e.g. 'amenity', 'vibe', 'cuisine', 'activity', 'search'
    sort_order INT DEFAULT 0,
    UNIQUE(entity_id, tag)
);

CREATE INDEX idx_entity_tags_entity ON entity_tags(entity_id);
CREATE INDEX idx_entity_tags_tag ON entity_tags(tag);

-- ============================================
-- Section Types Reference:
--   rich_text     → section_rich_text
--   bullets       → section_bullets
--   grouped_items → section_groups + section_items
--   cards         → section_cards
--   gallery       → section_photos
--   reviews       → section_reviews
--   hours         → section_hours
--   location      → section_location
-- ============================================
