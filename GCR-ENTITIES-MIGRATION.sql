-- ============================================================
-- GCR ENTITIES MIGRATION — matches launching-GCR entity system
-- Add place_id (Google Place ID) as canonical key
-- Run in new Supabase SQL editor (xbptmkpbiqzvxptjkfoi)
-- ============================================================

-- Drop all tables cleanly first (in reverse dependency order)
DROP TABLE IF EXISTS entity_page_views CASCADE;
DROP TABLE IF EXISTS entity_claims CASCADE;
DROP TABLE IF EXISTS entity_owners CASCADE;
DROP TABLE IF EXISTS ai_chunks CASCADE;
DROP TABLE IF EXISTS entity_bookings CASCADE;
DROP TABLE IF EXISTS entity_packages CASCADE;
DROP TABLE IF EXISTS entity_staff CASCADE;
DROP TABLE IF EXISTS entity_faqs CASCADE;
DROP TABLE IF EXISTS entity_media CASCADE;
DROP TABLE IF EXISTS entity_reviews CASCADE;
DROP TABLE IF EXISTS entity_happy_hours CASCADE;
DROP TABLE IF EXISTS entity_specials CASCADE;
DROP TABLE IF EXISTS entity_events CASCADE;
DROP TABLE IF EXISTS section_location CASCADE;
DROP TABLE IF EXISTS section_hours CASCADE;
DROP TABLE IF EXISTS section_reviews CASCADE;
DROP TABLE IF EXISTS section_photos CASCADE;
DROP TABLE IF EXISTS section_cards CASCADE;
DROP TABLE IF EXISTS section_items CASCADE;
DROP TABLE IF EXISTS section_groups CASCADE;
DROP TABLE IF EXISTS section_bullets CASCADE;
DROP TABLE IF EXISTS section_rich_text CASCADE;
DROP TABLE IF EXISTS entity_sections CASCADE;
DROP TABLE IF EXISTS entity_perfect_for CASCADE;
DROP TABLE IF EXISTS entity_features CASCADE;
DROP TABLE IF EXISTS entity_tags CASCADE;
DROP TABLE IF EXISTS entity_seo CASCADE;
DROP TABLE IF EXISTS entity CASCADE;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- 1. ENTITY (one row per business — place_id is the master key)
-- ============================================================
CREATE TABLE IF NOT EXISTS entity (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id            VARCHAR(100) UNIQUE,           -- Google Place ID (ChIJ...) — canonical key
    google_maps_uri     TEXT,
    slug                VARCHAR(255) UNIQUE NOT NULL,
    name                VARCHAR(255) NOT NULL,
    subtitle            TEXT,
    entity_type         VARCHAR(100) NOT NULL DEFAULT 'business',
    entity_subtype      VARCHAR(100),
    secondary_types     JSONB DEFAULT '[]',
    google_type         VARCHAR(100),
    google_types        JSONB DEFAULT '[]',
    icon                VARCHAR(10),
    emoji               VARCHAR(10),
    tagline             TEXT,

    -- Contact
    phone               VARCHAR(30),
    international_phone VARCHAR(30),
    website_url         TEXT,
    email               TEXT,
    directions_url      TEXT,
    call_url            TEXT,

    -- Location
    address_line_1      TEXT,
    address_line_2      TEXT,
    city                VARCHAR(100),
    state               VARCHAR(50) DEFAULT 'AL',
    zip                 VARCHAR(10),
    latitude            NUMERIC(10,7),
    longitude           NUMERIC(10,7),
    short_address       TEXT,
    plus_code           JSONB,

    -- Google data
    rating              NUMERIC(3,1),
    review_count        INT DEFAULT 0,
    price_level         VARCHAR(20),
    business_status     VARCHAR(50),
    editorial_summary   TEXT,

    -- GCR content
    description         TEXT,
    hero_image_url      TEXT,
    cover_url           TEXT,
    logo_url            TEXT,

    -- Status
    is_active           BOOLEAN DEFAULT false,
    featured            BOOLEAN DEFAULT false,
    gcr_listed          BOOLEAN DEFAULT false,
    gcr_verified        BOOLEAN DEFAULT false,
    sort_order          INT DEFAULT 0,

    -- Booking / pricing
    booking_url         TEXT,
    reservation_url     TEXT,
    order_url           TEXT,
    price_range         VARCHAR(20),
    price_from          DECIMAL(10,2),
    price_to            DECIMAL(10,2),
    price_unit          VARCHAR(50),

    -- Social
    social_instagram    TEXT,
    social_facebook     TEXT,
    social_tiktok       TEXT,

    -- Google dining/service flags
    outdoor_seating     BOOLEAN,
    reservable          BOOLEAN,
    dine_in             BOOLEAN,
    takeout             BOOLEAN,
    delivery            BOOLEAN,
    good_for_groups     BOOLEAN,
    live_music          BOOLEAN,
    serves_breakfast    BOOLEAN,
    serves_brunch       BOOLEAN,
    serves_lunch        BOOLEAN,
    serves_dinner       BOOLEAN,
    serves_beer         BOOLEAN,
    serves_wine         BOOLEAN,
    serves_cocktails    BOOLEAN,
    serves_vegetarian   BOOLEAN,

    -- Google structured data
    accessibility       JSONB,
    parking             JSONB,
    payment             JSONB,

    -- Hours (Google 7-day array)
    hours_text          JSONB DEFAULT '[]',

    -- Happy hour (entity-level quick fields)
    hh_days             VARCHAR(100),
    hh_start            TIME,
    hh_end              TIME,
    hh_description      TEXT,

    -- Menu (full scraped menu object)
    menu                JSONB,

    -- Parent entity (for chains/locations)
    parent_entity_id    UUID REFERENCES entity(id) ON DELETE SET NULL,

    -- Metadata
    _sources            JSONB DEFAULT '[]',
    _extra_photos       JSONB DEFAULT '[]',

    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_place_id   ON entity(place_id);
CREATE INDEX IF NOT EXISTS idx_entity_slug       ON entity(slug);
CREATE INDEX IF NOT EXISTS idx_entity_active     ON entity(is_active);
CREATE INDEX IF NOT EXISTS idx_entity_city       ON entity(city);
CREATE INDEX IF NOT EXISTS idx_entity_type       ON entity(entity_type, entity_subtype);
CREATE INDEX IF NOT EXISTS idx_entity_featured   ON entity(featured, is_active);
CREATE INDEX IF NOT EXISTS idx_entity_geo        ON entity(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entity_rating     ON entity(rating DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_entity_gtypes     ON entity USING gin(google_types);
CREATE INDEX IF NOT EXISTS idx_entity_name_trgm  ON entity USING gin(name gin_trgm_ops);

-- ============================================================
-- 2. ENTITY TAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_tags (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id    UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    place_id     VARCHAR(100),
    tag          TEXT NOT NULL,
    tag_category VARCHAR(50) DEFAULT 'type',
    sort_order   INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_place  ON entity_tags(place_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag    ON entity_tags(tag);

-- ============================================================
-- 3. ENTITY FEATURES (feature chips shown on profile)
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_features (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    place_id  VARCHAR(100),
    label     TEXT NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entity_features_entity ON entity_features(entity_id);

-- ============================================================
-- 4. ENTITY PERFECT FOR chips
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_perfect_for (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    place_id  VARCHAR(100),
    label     TEXT NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_entity_perfect_for_entity ON entity_perfect_for(entity_id);

-- ============================================================
-- 5. ENTITY SECTIONS (tabs/sections on the profile page)
--    section_type controls which content table renders it:
--    rich_text | bullets | grouped_items | cards | gallery | reviews | hours | location
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_sections (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id     UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    place_id      VARCHAR(100),
    section_key   VARCHAR(100) NOT NULL,
    section_label VARCHAR(100) NOT NULL,
    section_type  VARCHAR(50) NOT NULL,
    sort_order    INT DEFAULT 0,
    UNIQUE(entity_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_entity_sections_entity ON entity_sections(entity_id);

-- ============================================================
-- 6. SECTION: RICH TEXT (about / description)
-- ============================================================
CREATE TABLE IF NOT EXISTS section_rich_text (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    body_text  TEXT,
    UNIQUE(section_id)
);

-- ============================================================
-- 7. SECTION: BULLETS
-- ============================================================
CREATE TABLE IF NOT EXISTS section_bullets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id  UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    bullet_text TEXT,
    sort_order  INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_section_bullets_section ON section_bullets(section_id);

-- ============================================================
-- 8. SECTION: GROUPS (grouped items container)
-- ============================================================
CREATE TABLE IF NOT EXISTS section_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id  UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    title       TEXT,
    subtitle    TEXT,
    note_text   TEXT,
    sort_order  INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_section_groups_section ON section_groups(section_id);

-- ============================================================
-- 9. SECTION: ITEMS (menu items, packages, tours, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS section_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id      UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    group_id        UUID REFERENCES section_groups(id) ON DELETE SET NULL,
    item_name       TEXT,
    item_description TEXT,
    price_label     TEXT,
    price_text      TEXT,
    price_numeric   NUMERIC(10,2),
    price_min       NUMERIC(10,2),
    price_max       NUMERIC(10,2),
    unit_label      TEXT,
    item_type       VARCHAR(50),
    image_url       TEXT,
    metadata_json   JSONB,
    sort_order      INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_section_items_section ON section_items(section_id);
CREATE INDEX IF NOT EXISTS idx_section_items_group   ON section_items(group_id);

-- ============================================================
-- 10. SECTION: CARDS
-- ============================================================
CREATE TABLE IF NOT EXISTS section_cards (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    title      TEXT,
    subtitle   TEXT,
    description TEXT,
    badge_text TEXT,
    price_text TEXT,
    image_url  TEXT,
    link_url   TEXT,
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_section_cards_section ON section_cards(section_id);

-- ============================================================
-- 11. SECTION: PHOTOS (gallery)
-- ============================================================
CREATE TABLE IF NOT EXISTS section_photos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    image_url  TEXT,
    caption    TEXT,
    alt_text   TEXT,
    sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_section_photos_section ON section_photos(section_id);

-- ============================================================
-- 12. SECTION: REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS section_reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id  UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    author_name TEXT,
    rating      NUMERIC(2,1),
    review_text TEXT,
    review_date DATE,
    source      VARCHAR(50),
    sort_order  INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_section_reviews_section ON section_reviews(section_id);

-- ============================================================
-- 13. SECTION: HOURS (hours by day of week)
-- ============================================================
CREATE TABLE IF NOT EXISTS section_hours (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id  UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    day_of_week VARCHAR(10),
    open_time   TIME,
    close_time  TIME,
    is_closed   BOOLEAN DEFAULT false,
    note_text   TEXT,
    sort_order  INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_section_hours_section ON section_hours(section_id);

-- ============================================================
-- 14. SECTION: LOCATION
-- ============================================================
CREATE TABLE IF NOT EXISTS section_location (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id     UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city           TEXT,
    state          TEXT,
    zip            TEXT,
    latitude       NUMERIC(10,7),
    longitude      NUMERIC(10,7),
    directions_url TEXT,
    phone          TEXT,
    website_url    TEXT,
    note_text      TEXT,
    UNIQUE(section_id)
);

-- ============================================================
-- 15. EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_events (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id            UUID REFERENCES entity(id) ON DELETE CASCADE,
    place_id             VARCHAR(100),
    event_name           TEXT NOT NULL,
    event_type           VARCHAR(100),
    description          TEXT,
    artist_name          TEXT,
    artist_about         TEXT,
    music_style          VARCHAR(100),
    venue_location       TEXT,
    day_of_week          VARCHAR(20),
    event_date           DATE,
    start_time           TIME,
    end_time             TIME,
    recurring            BOOLEAN DEFAULT false,
    recurring_start_date DATE,
    recurring_end_date   DATE,
    cover_charge         VARCHAR(100),
    image_url            TEXT,
    ticket_url           TEXT,
    is_active            BOOLEAN DEFAULT true,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_events_entity  ON entity_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_events_place   ON entity_events(place_id);
CREATE INDEX IF NOT EXISTS idx_entity_events_date    ON entity_events(event_date);
CREATE INDEX IF NOT EXISTS idx_entity_events_active  ON entity_events(is_active, event_date);

-- ============================================================
-- 16. SPECIALS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_specials (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   UUID REFERENCES entity(id) ON DELETE CASCADE,
    place_id    VARCHAR(100),
    title       TEXT,
    description TEXT,
    type        VARCHAR(50),
    day_of_week VARCHAR(20),
    days        JSONB,
    start_time  TIME,
    end_time    TIME,
    start_date  DATE,
    end_date    DATE,
    price       VARCHAR(50),
    discount    TEXT,
    image_url   TEXT,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_specials_entity ON entity_specials(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_specials_place  ON entity_specials(place_id);

-- ============================================================
-- 17. HAPPY HOURS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_happy_hours (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   UUID REFERENCES entity(id) ON DELETE CASCADE,
    place_id    VARCHAR(100),
    days        VARCHAR(100),
    start_time  TIME,
    end_time    TIME,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_hh_entity ON entity_happy_hours(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_hh_place  ON entity_happy_hours(place_id);

-- ============================================================
-- 18. REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID REFERENCES entity(id) ON DELETE CASCADE,
    place_id        VARCHAR(100),
    customer_name   TEXT,
    customer_email  TEXT,
    customer_phone  TEXT,
    rating          INT,
    review_text     TEXT,
    photos          JSONB DEFAULT '[]',
    source          TEXT,
    status          TEXT DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_reviews_entity ON entity_reviews(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_reviews_place  ON entity_reviews(place_id);

-- ============================================================
-- 19. MEDIA / PHOTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   UUID REFERENCES entity(id) ON DELETE CASCADE,
    place_id    VARCHAR(100),
    url         TEXT NOT NULL,
    filename    TEXT,
    alt_text    TEXT,
    file_type   VARCHAR(50),
    folder      VARCHAR(100),
    featured    BOOLEAN DEFAULT false,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_media_entity ON entity_media(entity_id);

-- ============================================================
-- 20. FAQS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_faqs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    place_id    VARCHAR(100),
    question    TEXT,
    answer      TEXT,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_faqs_entity ON entity_faqs(entity_id);

-- ============================================================
-- 21. STAFF
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_staff (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    place_id    VARCHAR(100),
    name        TEXT,
    role        TEXT,
    bio         TEXT,
    photo_url   TEXT,
    sort_order  INT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_staff_entity ON entity_staff(entity_id);

-- ============================================================
-- 22. PACKAGES / SERVICES / TOURS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_packages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    place_id        VARCHAR(100),
    name            TEXT NOT NULL,
    description     TEXT,
    price           DECIMAL(10,2),
    price_label     TEXT,
    duration_minutes INT,
    whats_included  JSONB DEFAULT '[]',
    min_guests      INT,
    max_guests      INT,
    booking_url     TEXT,
    advance_hours   INT DEFAULT 24,
    active          BOOLEAN DEFAULT true,
    sort_order      INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_packages_entity ON entity_packages(entity_id);

-- ============================================================
-- 23. BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_bookings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID REFERENCES entity(id) ON DELETE CASCADE,
    place_id        VARCHAR(100),
    customer_name   TEXT,
    customer_email  TEXT,
    customer_phone  TEXT,
    booking_date    DATE,
    start_time      TEXT,
    end_time        TEXT,
    party_size      INT,
    items           JSONB,
    total_amount    NUMERIC(10,2),
    deposit_amount  NUMERIC(10,2),
    payment_status  TEXT DEFAULT 'pending',
    payment_id      TEXT,
    status          TEXT DEFAULT 'pending',
    token           TEXT,
    notes           TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_bookings_entity ON entity_bookings(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_bookings_date   ON entity_bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_entity_bookings_status ON entity_bookings(status);

-- ============================================================
-- 24. SEO SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_seo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID UNIQUE NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    place_id        VARCHAR(100),
    seo_title       TEXT,
    seo_description TEXT,
    seo_keywords    TEXT,
    og_image        TEXT,
    canonical_url   TEXT,
    ga4_id          TEXT,
    facebook_pixel  TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 25. AI CHUNKS (embeddings for RAG / AI concierge)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   UUID REFERENCES entity(id) ON DELETE CASCADE,
    place_id    VARCHAR(100),
    chunk_type  TEXT,           -- about | menu | events | hours | specials | tags
    content     TEXT,
    embedding   vector(1536),
    metadata    JSONB,
    source      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chunks_entity   ON ai_chunks(entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_chunks_place    ON ai_chunks(place_id);
CREATE INDEX IF NOT EXISTS idx_ai_chunks_type     ON ai_chunks(chunk_type);
-- IVFFlat index added after data is loaded (requires rows to exist)
-- CREATE INDEX ai_chunks_embedding_idx ON ai_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- 26. OWNERS (link to users/auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_owners (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    place_id  VARCHAR(100),
    user_id   UUID,
    role      TEXT DEFAULT 'owner',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_owners_entity ON entity_owners(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_owners_user   ON entity_owners(user_id);

-- ============================================================
-- 27. CLAIMS (businesses claiming their listing)
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_claims (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID REFERENCES entity(id) ON DELETE CASCADE,
    place_id        VARCHAR(100),
    business_name   TEXT,
    claimant_name   TEXT,
    claimant_email  TEXT,
    claimant_phone  TEXT,
    business_role   TEXT,
    claim_type      TEXT,
    status          TEXT DEFAULT 'pending',
    admin_notes     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 28. ANALYTICS
-- ============================================================
CREATE TABLE IF NOT EXISTS entity_page_views (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   UUID REFERENCES entity(id) ON DELETE CASCADE,
    place_id    VARCHAR(100),
    page_path   TEXT,
    referrer    TEXT,
    utm_source  TEXT,
    device_type TEXT,
    session_id  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_views_entity ON entity_page_views(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_views_date   ON entity_page_views(created_at);

-- ============================================================
-- Updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_entity_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entity_updated_at ON entity;
CREATE TRIGGER trg_entity_updated_at
  BEFORE UPDATE ON entity
  FOR EACH ROW EXECUTE FUNCTION update_entity_updated_at();
