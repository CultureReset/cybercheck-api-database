-- ========================================
-- GULF COAST RADAR — MASTER SCHEMA (SAFE TO RUN)
-- ========================================
-- This file uses CREATE TABLE IF NOT EXISTS
-- Safe to run even if tables already exist
-- ========================================

-- ========================================
-- CORE BUSINESS ENTITY
-- ========================================
CREATE TABLE IF NOT EXISTS entity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    entity_type TEXT,
    entity_subtype TEXT,
    description TEXT,
    short_description TEXT,
    tagline TEXT,

    -- Contact & Location
    address_line_1 TEXT,
    address_line_2 TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT DEFAULT 'USA',
    latitude NUMERIC,
    longitude NUMERIC,
    plus_code TEXT,
    phone TEXT,
    international_phone TEXT,
    email TEXT,

    -- Web & Social
    website_url TEXT,
    booking_url TEXT,
    reservation_url TEXT,
    order_url TEXT,
    directions_url TEXT,
    call_url TEXT,

    social_facebook TEXT,
    social_instagram TEXT,
    social_tiktok TEXT,
    social_twitter TEXT,
    social_linkedin TEXT,
    social_youtube TEXT,

    -- Hours & Operations
    hours_text TEXT,
    open_time TEXT,
    close_time TEXT,

    -- Happy Hour (stored at entity level)
    hh_days TEXT,
    hh_start TIME,
    hh_end TIME,
    hh_description TEXT,

    -- Images
    hero_image_url TEXT,
    logo_url TEXT,
    cover_url TEXT,
    icon TEXT,

    -- Ratings & Reviews
    rating NUMERIC(3,2),
    review_count INTEGER,

    -- Google Data
    google_places_id TEXT,
    google_type TEXT,
    google_types TEXT[],
    google_maps_uri TEXT,
    business_status TEXT,

    -- Service Flags
    dine_in BOOLEAN DEFAULT false,
    takeout BOOLEAN DEFAULT false,
    delivery BOOLEAN DEFAULT false,
    reservable BOOLEAN DEFAULT false,

    -- Amenities
    wifi BOOLEAN DEFAULT false,
    outdoor_seating BOOLEAN DEFAULT false,
    parking BOOLEAN DEFAULT false,
    wheelchair_accessible BOOLEAN DEFAULT false,
    good_for_groups BOOLEAN DEFAULT false,
    live_music BOOLEAN DEFAULT false,

    -- Food & Drink
    serves_breakfast BOOLEAN DEFAULT false,
    serves_brunch BOOLEAN DEFAULT false,
    serves_lunch BOOLEAN DEFAULT false,
    serves_dinner BOOLEAN DEFAULT false,
    serves_vegetarian BOOLEAN DEFAULT false,
    serves_beer BOOLEAN DEFAULT false,
    serves_wine BOOLEAN DEFAULT false,
    serves_cocktails BOOLEAN DEFAULT false,

    -- Pricing
    price_level TEXT,
    price_range TEXT,
    price_from NUMERIC,
    price_to NUMERIC,
    price_unit TEXT,

    -- Payment & Services
    accepts_payment TEXT[],

    -- Status & Organization
    is_active BOOLEAN DEFAULT true,
    gcr_listed BOOLEAN DEFAULT false,
    gcr_verified BOOLEAN DEFAULT false,
    featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,

    -- Extra Data
    _sources TEXT,
    _extra_photos TEXT,
    metadata_json JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Admin
    parent_entity_id UUID REFERENCES entity(id)
);

-- ========================================
-- ENTITY METADATA & CATEGORIZATION
-- ========================================
CREATE TABLE IF NOT EXISTS entity_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    tag_category TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_perfect_for (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- OPERATIONAL DATA
-- ========================================
CREATE TABLE IF NOT EXISTS entity_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    day_of_week INTEGER,
    open_time TIME,
    close_time TIME,
    is_open BOOLEAN DEFAULT true,
    special_hours TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_about_bullets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    bullet_text TEXT NOT NULL,
    category TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- CONTENT SECTIONS
-- ========================================
CREATE TABLE IF NOT EXISTS entity_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    section_key TEXT NOT NULL,
    section_label TEXT NOT NULL,
    section_type TEXT NOT NULL,
    section_note TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(entity_id, section_key)
);

CREATE TABLE IF NOT EXISTS section_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    item_description TEXT,
    item_type TEXT,
    item_style TEXT,
    price_numeric NUMERIC(10,2),
    price_text TEXT,
    price_min NUMERIC(10,2),
    price_max NUMERIC(10,2),
    price_label TEXT,
    unit_label TEXT,
    image_url TEXT,
    allergens TEXT,
    calories INTEGER,
    abv NUMERIC(5,2),
    ibu INTEGER,
    brewery TEXT,
    availability TEXT,
    is_available BOOLEAN DEFAULT true,
    tags TEXT[],
    features TEXT[],
    metadata_json JSONB,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS section_bullets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    bullet_text TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- MEDIA & ASSETS
-- ========================================
CREATE TABLE IF NOT EXISTS entity_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    caption TEXT,
    photo_type TEXT,
    credit TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- EVENTS & SPECIALS
-- ========================================
CREATE TABLE IF NOT EXISTS entity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID REFERENCES entity(id) ON DELETE CASCADE,
    artist_name TEXT,
    event_name TEXT NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    event_type TEXT,
    description TEXT,
    venue_location TEXT,
    cover_charge NUMERIC(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_specials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    special_name TEXT NOT NULL,
    special_type TEXT,
    description TEXT,
    discount_type TEXT,
    discount_value NUMERIC(10,2),
    valid_from DATE,
    valid_until DATE,
    day_of_week TEXT[],
    start_time TIME,
    end_time TIME,
    applicable_items TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_happy_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    days TEXT,
    start_time TIME,
    end_time TIME,
    description TEXT,
    item TEXT,
    deal_name TEXT,
    hh_price NUMERIC(10,2),
    discount_percent INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- LEGACY MENU TABLES
-- ========================================
CREATE TABLE IF NOT EXISTS menu_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    section_name TEXT NOT NULL,
    section_note TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    menu_section_id UUID REFERENCES menu_sections(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    description TEXT,
    price_numeric NUMERIC(10,2),
    price_text TEXT,
    image_url TEXT,
    allergens TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_sub_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_section_id UUID NOT NULL REFERENCES menu_sections(id) ON DELETE CASCADE,
    sub_section_name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drink_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    section_name TEXT NOT NULL,
    section_note TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drink_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    drink_section_id UUID REFERENCES drink_sections(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    description TEXT,
    price_numeric NUMERIC(10,2),
    price_text TEXT,
    item_style TEXT,
    abv NUMERIC(5,2),
    ibu INTEGER,
    brewery TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS happy_hour_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    section_name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS happy_hour_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    happy_hour_section_id UUID REFERENCES happy_hour_sections(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    description TEXT,
    price_numeric NUMERIC(10,2),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- BOOKING & RESERVATIONS
-- ========================================
CREATE TABLE IF NOT EXISTS booking_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    slot_name TEXT NOT NULL,
    duration_minutes INTEGER,
    max_capacity INTEGER,
    price NUMERIC(10,2),
    currency TEXT DEFAULT 'USD',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_qna (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- ACTIVITIES & PRICING
-- ========================================
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    activity_name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    duration_minutes INTEGER,
    max_capacity INTEGER,
    price NUMERIC(10,2),
    currency TEXT DEFAULT 'USD',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2),
    currency TEXT DEFAULT 'USD',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- PRODUCTS & SHOPPING
-- ========================================
CREATE TABLE IF NOT EXISTS product_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    section_name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_sub_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_section_id UUID NOT NULL REFERENCES product_sections(id) ON DELETE CASCADE,
    sub_section_name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    product_section_id UUID REFERENCES product_sections(id),
    item_name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2),
    currency TEXT DEFAULT 'USD',
    image_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- TOURS & ACTIVITIES MANAGEMENT
-- ========================================
CREATE TABLE IF NOT EXISTS fleet_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    vehicle_name TEXT NOT NULL,
    vehicle_type TEXT,
    capacity INTEGER,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    addon_name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whats_included (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    included_item TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    requirement_text TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    policy_name TEXT NOT NULL,
    policy_text TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meeting_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    meeting_point_name TEXT NOT NULL,
    address TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================
CREATE INDEX IF NOT EXISTS idx_entity_slug ON entity(slug);
CREATE INDEX IF NOT EXISTS idx_entity_is_active ON entity(is_active);
CREATE INDEX IF NOT EXISTS idx_entity_city ON entity(city);
CREATE INDEX IF NOT EXISTS idx_entity_type ON entity(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_sections_entity ON entity_sections(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_sections_type ON entity_sections(section_type);
CREATE INDEX IF NOT EXISTS idx_section_items_section ON section_items(section_id);
CREATE INDEX IF NOT EXISTS idx_entity_photos_entity ON entity_photos(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_events_entity ON entity_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_events_date ON entity_events(event_date);
CREATE INDEX IF NOT EXISTS idx_entity_specials_entity ON entity_specials(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_specials_active ON entity_specials(is_active);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_features_entity ON entity_features(entity_id);

-- ========================================
-- AUDIT TRIGGERS
-- ========================================
CREATE OR REPLACE FUNCTION update_entity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS entity_update_timestamp ON entity;
CREATE TRIGGER entity_update_timestamp
BEFORE UPDATE ON entity
FOR EACH ROW
EXECUTE FUNCTION update_entity_timestamp();

DROP TRIGGER IF EXISTS entity_sections_update_timestamp ON entity_sections;
CREATE TRIGGER entity_sections_update_timestamp
BEFORE UPDATE ON entity_sections
FOR EACH ROW
EXECUTE FUNCTION update_entity_timestamp();

DROP TRIGGER IF EXISTS section_items_update_timestamp ON section_items;
CREATE TRIGGER section_items_update_timestamp
BEFORE UPDATE ON section_items
FOR EACH ROW
EXECUTE FUNCTION update_entity_timestamp();

DROP TRIGGER IF EXISTS entity_specials_update_timestamp ON entity_specials;
CREATE TRIGGER entity_specials_update_timestamp
BEFORE UPDATE ON entity_specials
FOR EACH ROW
EXECUTE FUNCTION update_entity_timestamp();

DROP TRIGGER IF EXISTS entity_events_update_timestamp ON entity_events;
CREATE TRIGGER entity_events_update_timestamp
BEFORE UPDATE ON entity_events
FOR EACH ROW
EXECUTE FUNCTION update_entity_timestamp();

-- ========================================
-- DONE - All tables created/updated safely
-- ========================================
