-- ============================================================
-- GCR Migrations — Run in Supabase SQL Editor
-- Run AFTER 01-tables.sql
-- ============================================================

-- ============================================
-- MIGRATION 12: Add GCR columns to businesses
-- ============================================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS emoji          VARCHAR(10)   DEFAULT '🏪';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tagline        VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS featured       BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tags           JSONB         DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS price_range    VARCHAR(10);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS rating         DECIMAL(3,2);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS review_count   INT           DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS happy_hour     VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS kids_friendly  BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pet_friendly   BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS live_music     BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS outdoor        BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reservations   BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS alcohol        BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS booking_required BOOLEAN     DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS delivery       BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS takeout        BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS sort_order     INT           DEFAULT 0;

-- Index for GCR listing queries
CREATE INDEX IF NOT EXISTS idx_businesses_gcr       ON businesses(gcr_listed, status);
CREATE INDEX IF NOT EXISTS idx_businesses_type      ON businesses(type);
CREATE INDEX IF NOT EXISTS idx_businesses_featured  ON businesses(featured);
CREATE INDEX IF NOT EXISTS idx_businesses_tags      ON businesses USING gin(tags);

-- ============================================
-- Fix events table: add GCR-specific fields
-- ============================================
-- 'name' exists but frontend expects 'title' — add title as alias
ALTER TABLE events ADD COLUMN IF NOT EXISTS title        VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS time         VARCHAR(50);   -- "7pm", "2pm – 5pm"
ALTER TABLE events ADD COLUMN IF NOT EXISTS category     VARCHAR(50);   -- live-music|concert|festival|sports|holiday|bar-event|family|the-wharf
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover        VARCHAR(100);  -- "Free", "$10", "No Cover"
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_url   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_name   VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS emoji        VARCHAR(10);
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_charge BOOLEAN DEFAULT false;

-- Keep title/name in sync via trigger (title wins if set, fallback to name)
CREATE OR REPLACE FUNCTION sync_event_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.title IS NOT NULL AND NEW.title != '' THEN
    NEW.name := NEW.title;
  ELSIF NEW.name IS NOT NULL AND NEW.name != '' AND (NEW.title IS NULL OR NEW.title = '') THEN
    NEW.title := NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_event_title ON events;
CREATE TRIGGER trg_sync_event_title
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION sync_event_title();

CREATE INDEX IF NOT EXISTS idx_events_date     ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(site_id, category);

-- ============================================
-- Fix specials table: add GCR filter category
-- ============================================
-- 'type' exists (happy_hour, daily_special, etc.) but GCR filter chips use different values
-- gcr_category maps to filter chips: ayce|daily|weekend|lunch|family|early-bird|kids
ALTER TABLE specials ADD COLUMN IF NOT EXISTS gcr_category VARCHAR(50);  -- ayce|daily|weekend|lunch|family|early-bird|kids
ALTER TABLE specials ADD COLUMN IF NOT EXISTS discount TEXT;             -- flat discount string for display ("$3 wells, $4 drafts")
ALTER TABLE specials ADD COLUMN IF NOT EXISTS items_list JSONB DEFAULT '[]'; -- [{name, description, price}] for expand dropdown

CREATE INDEX IF NOT EXISTS idx_specials_gcr_cat ON specials(site_id, gcr_category);

-- ============================================
-- Fix site_content: add hours_note
-- ============================================
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS hours_note TEXT;  -- "Seasonal hours may vary"

-- ============================================
-- NEW TABLE: artists (musicians / local performers)
-- Listed on the events page "Artists & Musicians" section
-- ============================================
CREATE TABLE IF NOT EXISTS artists (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id      UUID REFERENCES businesses(site_id) ON DELETE SET NULL,  -- linked biz (optional)
    name         VARCHAR(255) NOT NULL,
    slug         VARCHAR(100) UNIQUE,                -- for URL: /artists/tim-roberts
    genre        VARCHAR(100),                       -- "Country Rock", "Beach Pop", "Blues"
    bio          TEXT,
    photo_url    TEXT,
    cover_url    TEXT,
    website      TEXT,
    booking_email VARCHAR(255),
    booking_phone VARCHAR(20),
    social       JSONB DEFAULT '{}',                 -- {instagram, facebook, spotify, tiktok, youtube}
    tags         JSONB DEFAULT '[]',                 -- ["live-music","country","local"]
    gcr_listed   BOOLEAN DEFAULT true,
    featured     BOOLEAN DEFAULT false,
    home_venue   VARCHAR(255),                       -- "Flora-Bama", "The Wharf", etc.
    upcoming_shows JSONB DEFAULT '[]',               -- [{venue, date, time, cover, ticket_url}]
    sort_order   INT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_gcr    ON artists(gcr_listed);
CREATE INDEX IF NOT EXISTS idx_artists_slug   ON artists(slug);
CREATE INDEX IF NOT EXISTS idx_artists_site   ON artists(site_id);

-- ============================================
-- NEW TABLE: gcr_feed_posts (live local feed)
-- Businesses post updates — shows on /feed page
-- ============================================
CREATE TABLE IF NOT EXISTS gcr_feed_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    type        VARCHAR(50) DEFAULT 'update',   -- update|event|special|news|alert|photo
    text        TEXT,
    image_url   TEXT,
    link_url    TEXT,
    link_text   VARCHAR(100),
    emoji       VARCHAR(10),
    pinned      BOOLEAN DEFAULT false,
    active      BOOLEAN DEFAULT true,
    expires_at  TIMESTAMPTZ,                    -- optional: auto-hide after date
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_site    ON gcr_feed_posts(site_id);
CREATE INDEX IF NOT EXISTS idx_feed_active  ON gcr_feed_posts(active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_pinned  ON gcr_feed_posts(pinned);

-- ============================================
-- NEW TABLE: tourist_sessions
-- Created when tourist signs up via GCR loyalty modal
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID UNIQUE DEFAULT gen_random_uuid(),
    name         TEXT,
    phone        TEXT,
    email        TEXT,
    interests    TEXT[],           -- ['restaurants','boat-rentals','fishing','live-music']
    visitor_type TEXT,             -- tourist|local|snowbird
    checkin      DATE,
    checkout     DATE,
    chat_url     TEXT,             -- generated link sent via SMS
    sms_sent     BOOLEAN DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tourist_sessions_phone   ON tourist_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_tourist_sessions_sid     ON tourist_sessions(session_id);

-- ============================================
-- NEW TABLE: tourist_conversations
-- Grok AI chat history per tourist session
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES tourist_sessions(session_id) ON DELETE CASCADE,
    role       TEXT NOT NULL,   -- user | assistant
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tourist_conv_session ON tourist_conversations(session_id, created_at);

-- ============================================
-- GCR API helper view: full business listing
-- Used by gcr-api.js for the /api/gcr/businesses endpoint
-- ============================================
CREATE OR REPLACE VIEW gcr_businesses_view AS
SELECT
    b.site_id,
    b.subdomain                         AS slug,
    b.name,
    b.type,
    b.emoji,
    b.tagline,
    b.featured,
    b.tags,
    b.price_range,
    b.rating,
    b.review_count,
    b.happy_hour,
    b.kids_friendly,
    b.pet_friendly,
    b.live_music,
    b.outdoor,
    b.reservations,
    b.alcohol,
    b.booking_required,
    b.delivery,
    b.takeout,
    b.sort_order,
    b.gcr_listed,
    b.gcr_verified,
    b.logo_url,
    b.cover_url,
    -- From site_content
    sc.address,
    sc.city,
    sc.state,
    sc.zip,
    sc.lat,
    sc.lng,
    sc.contact_phone                    AS phone,
    sc.contact_email                    AS email,
    sc.website_url                      AS website,
    sc.hours,
    sc.hours_note,
    sc.about_text                       AS description,
    sc.gallery,
    sc.social_links                     AS social,
    sc.cover_url                        AS cover_image
FROM businesses b
LEFT JOIN site_content sc ON sc.site_id = b.site_id
WHERE b.gcr_listed = true
  AND b.status = 'active'
ORDER BY b.featured DESC, b.sort_order ASC, b.name ASC;

-- ============================================
-- NEW TABLE: artist_shows
-- Links an artist to a venue + date (the co-op data)
-- When artist adds a show → also appears on venue's events page
-- ============================================
CREATE TABLE IF NOT EXISTS artist_shows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id   UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    site_id     UUID REFERENCES businesses(site_id) ON DELETE SET NULL,  -- venue (null = external venue)
    venue_name  VARCHAR(255) NOT NULL,      -- "Flora-Bama" (fallback if no site_id)
    venue_city  VARCHAR(100),
    show_date   DATE NOT NULL,
    start_time  VARCHAR(50),               -- "7pm", "8:30pm"
    end_time    VARCHAR(50),
    show_type   VARCHAR(50) DEFAULT 'live-music',  -- live-music|acoustic|duo|trio|headline
    cover       VARCHAR(100) DEFAULT 'Free',       -- "Free", "$10", "No Cover"
    ticket_url  TEXT,
    notes       TEXT,
    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_shows_artist  ON artist_shows(artist_id, show_date);
CREATE INDEX IF NOT EXISTS idx_artist_shows_venue   ON artist_shows(site_id, show_date);
CREATE INDEX IF NOT EXISTS idx_artist_shows_date    ON artist_shows(show_date);

-- ============================================
-- NEW TABLE: song_requests
-- Fan requests during a live show
-- Artist manages queue from their dashboard
-- ============================================
CREATE TABLE IF NOT EXISTS song_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id      UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    show_id        UUID REFERENCES artist_shows(id) ON DELETE SET NULL,
    song_name      VARCHAR(255) NOT NULL,
    requester_name VARCHAR(100),
    tip_amount     DECIMAL(6,2) DEFAULT 0,
    tip_method     VARCHAR(20),            -- venmo|cashapp|paypal
    tip_handle     VARCHAR(100),           -- their handle for confirmation
    position       INT DEFAULT 0,          -- queue position (lower = higher priority)
    status         VARCHAR(20) DEFAULT 'pending',  -- pending|played|skipped
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_song_requests_artist  ON song_requests(artist_id, status, position);
CREATE INDEX IF NOT EXISTS idx_song_requests_show    ON song_requests(show_id, status);

-- ============================================
-- MISSING #1: businesses.area — geographic area tag
-- Critical for location-based filtering on GCR
-- ============================================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS area VARCHAR(50);
-- Values: orange-beach | gulf-shores | perdido-key | the-wharf | owa | foley | fort-morgan

CREATE INDEX IF NOT EXISTS idx_businesses_area ON businesses(area);

-- ============================================
-- MISSING #2: events.artist_id — co-op data link
-- When artist adds a show → event row created here
-- Shows on BOTH the venue's GCR page AND artist's profile
-- ============================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES artists(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS artist_name VARCHAR(255);  -- denormalized for speed

CREATE INDEX IF NOT EXISTS idx_events_artist ON events(artist_id);

-- ============================================
-- MISSING #3: services — package/charter inclusions
-- Fishing charters, boat tours, parasailing have "what's included"
-- ============================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS whats_included  JSONB DEFAULT '[]';  -- ["Fuel","Bait","Life Jackets","Captain"]
ALTER TABLE services ADD COLUMN IF NOT EXISTS min_guests       INT DEFAULT 1;
ALTER TABLE services ADD COLUMN IF NOT EXISTS max_guests       INT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS booking_url      TEXT;               -- external booking link override
ALTER TABLE services ADD COLUMN IF NOT EXISTS notes            TEXT;               -- "Weather permitting", "Minimum age 6"

-- ============================================
-- MISSING #4: gcr_claims — business claim requests
-- When someone fills out claim.html, tracked here
-- Admin approves → business gets a CyberCheck account
-- ============================================
CREATE TABLE IF NOT EXISTS gcr_claims (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id        UUID REFERENCES businesses(site_id) ON DELETE SET NULL,  -- linked listing (if exists)
    business_name  VARCHAR(255) NOT NULL,
    claimant_name  VARCHAR(255) NOT NULL,
    claimant_email VARCHAR(255) NOT NULL,
    claimant_phone VARCHAR(20),
    business_role  VARCHAR(100),           -- "Owner", "Manager", "Marketing"
    notes          TEXT,                   -- how they want to use the platform
    claim_type     VARCHAR(50) DEFAULT 'business',  -- business | artist | event
    status         VARCHAR(20) DEFAULT 'pending',   -- pending | approved | denied | contacted
    admin_notes    TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcr_claims_status ON gcr_claims(status);
CREATE INDEX IF NOT EXISTS idx_gcr_claims_email  ON gcr_claims(claimant_email);

-- ============================================
-- MISSING #5: loyalty_signups — GCR loyalty modal
-- Simpler than tourist_sessions — just name + email/phone
-- Feeds into marketing list + optionally creates a tourist_session
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_signups (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(255),
    email          VARCHAR(255),
    phone          VARCHAR(20),
    visitor_type   VARCHAR(50),            -- tourist | local | snowbird
    interests      TEXT[],
    checkin        DATE,
    checkout       DATE,
    source         VARCHAR(100),           -- which page/modal they signed up on
    session_id     UUID REFERENCES tourist_sessions(session_id) ON DELETE SET NULL,  -- if they went full AI agent
    sms_sent       BOOLEAN DEFAULT false,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_email ON loyalty_signups(email);
CREATE INDEX IF NOT EXISTS idx_loyalty_phone ON loyalty_signups(phone);

-- ============================================
-- PHASE 1B: Final missing columns
-- ============================================

-- businesses.subcategory — the filter chip value for that business
-- Separate from tags[] so filtering is a single column equality check
-- restaurants: seafood|italian|burgers|bbq|pizza|mexican|breakfast|waterfront|bar-food
-- things-to-do: boat-rentals|fishing|parasailing|dolphin-tours|kayaking|paddleboarding|golf|mini-golf|arcade|free
-- nightlife: bar|beach-bar|sports-bar|late-night|karaoke
-- coffee-sweets: coffee|bakery|ice-cream|sweets
-- shopping: clothing|gifts|beachwear|souvenirs|jewelry|home-decor
-- hotels: resort|oceanfront|pet-friendly|pool
-- services: salon|spa|fitness|photography|cleaning|repair
-- other: public-beach|boat-launch|parking|free
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_businesses_subcategory ON businesses(type, subcategory);

-- High-value boolean attributes — AI uses these for natural language queries
-- "waterfront restaurant with outdoor seating that's pet friendly"
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS waterfront   BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS beachfront   BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS dockside     BOOLEAN DEFAULT false;  -- boat-accessible, dock parking
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS gluten_free  BOOLEAN DEFAULT false;  -- has gluten-free menu options
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS vegan        BOOLEAN DEFAULT false;  -- has vegan options
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS vegetarian   BOOLEAN DEFAULT false;

-- menu_items.section — flat section label for restaurants that don't use the
-- full category/subcategory hierarchy (just "Starters", "Mains", "Desserts")
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS section       VARCHAR(100);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS dietary_tags  JSONB DEFAULT '[]';
-- dietary_tags values: ["gluten-free","vegan","vegetarian","dairy-free","nut-free","spicy","kids","popular"]
CREATE INDEX IF NOT EXISTS idx_menu_items_section ON menu_items(site_id, section);
CREATE INDEX IF NOT EXISTS idx_menu_items_dietary ON menu_items USING gin(dietary_tags);

-- events — kid-friendly flag + age restriction
ALTER TABLE events ADD COLUMN IF NOT EXISTS kids_friendly  BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS age_limit      VARCHAR(20);  -- "21+", "18+", "All Ages"
ALTER TABLE events ADD COLUMN IF NOT EXISTS pet_friendly   BOOLEAN DEFAULT false;

-- services (things-to-do packages) — age/kids flags
-- e.g. "Minimum age 6" for parasailing, "Family friendly" for dolphin tours
ALTER TABLE services ADD COLUMN IF NOT EXISTS kids_friendly  BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS age_minimum    INT;           -- minimum age in years
ALTER TABLE services ADD COLUMN IF NOT EXISTS weight_limit   INT;           -- lbs, for parasailing/rentals
ALTER TABLE services ADD COLUMN IF NOT EXISTS pet_friendly   BOOLEAN DEFAULT false;

-- artists.user_id — links artist to a CyberCheck login account
-- Same users table as business owners, role = 'artist'
ALTER TABLE artists ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_artists_user ON artists(user_id);

-- gcr_feed_posts — denormalized business name + logo for fast rendering
-- Avoids a JOIN on every feed render
ALTER TABLE gcr_feed_posts ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE gcr_feed_posts ADD COLUMN IF NOT EXISTS business_logo TEXT;

-- ============================================
-- Sample data: GCR page subcategory reference
-- (not stored in DB — just here for reference)
-- ============================================
-- restaurants:   seafood|italian|burgers|bbq|pizza|mexican|breakfast|waterfront|gluten-free|vegan|bar-food
-- things-to-do:  boat-rentals|fishing|parasailing|dolphin-tours|kayaking|paddleboarding|golf|mini-golf|arcade|free
-- happy-hours:   bar|beach-bar|sports-bar|waterfront|live-music|food-specials
-- specials:      ayce|daily|weekend|lunch|family|early-bird|kids
-- events:        live-music|concert|festival|sports|family|bar-event|holiday|the-wharf
-- shopping:      clothing|gifts|beachwear|souvenirs|jewelry|home-decor
-- coffee-sweets: coffee|bakery|ice-cream|sweets
-- hotels:        resort|beach-access|pet-friendly|pool|oceanfront
-- services:      salon|spa|cleaning|repair|fitness|photography|childcare
-- other:         public-beach|boat-launch|parking|free
-- nightlife:     bar|live-music|beach-bar|sports-bar|late-night|karaoke

-- ============================================
-- RENTAL TABLE FIXES (for gcr-push.js compatibility)
-- 01-tables.sql uses time_slot_id FK; gcr-push.js uses slot_label text
-- These alters make the tables work with the push script
-- ============================================

-- fleet_types: add featured + active flags used by push script
ALTER TABLE fleet_types ADD COLUMN IF NOT EXISTS featured   BOOLEAN DEFAULT false;
ALTER TABLE fleet_types ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT true;

-- rental_pricing: add slot_label text column + active flag
-- time_slot_id is nullable so push script rows (no time slot FK) work
ALTER TABLE rental_pricing ADD COLUMN IF NOT EXISTS slot_label VARCHAR(100);
ALTER TABLE rental_pricing ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT true;
ALTER TABLE rental_pricing ALTER COLUMN time_slot_id DROP NOT NULL;

-- rental_group_rates: push script sends title/description/price/price_label
-- fleet_type_id and min_qty are optional for GCR group rate display
ALTER TABLE rental_group_rates ADD COLUMN IF NOT EXISTS title       VARCHAR(255);
ALTER TABLE rental_group_rates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rental_group_rates ADD COLUMN IF NOT EXISTS price       DECIMAL(10,2);
ALTER TABLE rental_group_rates ADD COLUMN IF NOT EXISTS price_label VARCHAR(100);
ALTER TABLE rental_group_rates ADD COLUMN IF NOT EXISTS active      BOOLEAN DEFAULT true;
ALTER TABLE rental_group_rates ALTER COLUMN fleet_type_id DROP NOT NULL;
ALTER TABLE rental_group_rates ALTER COLUMN min_qty       DROP NOT NULL;

-- rental_addons: docks need price_half/price_full; accessories need unit/badge/specs/features
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS price_half DECIMAL(10,2);
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS price_full DECIMAL(10,2);
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS badge      VARCHAR(50);
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS specs      TEXT;
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS features   JSONB DEFAULT '[]';
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS unit       VARCHAR(50);
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT true;
ALTER TABLE rental_addons ALTER COLUMN price DROP NOT NULL;
