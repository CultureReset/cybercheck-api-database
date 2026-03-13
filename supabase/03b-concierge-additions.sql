-- ============================================================
-- 03b-concierge-additions.sql
-- Missing tables + column additions from full concierge schema
-- Run AFTER 03-concierge-schema.sql
-- ============================================================

-- ============================================================
-- MISSING COLUMN ADDITIONS TO EXISTING TABLES
-- ============================================================

ALTER TABLE businesses   ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);
ALTER TABLE menu_items   ADD COLUMN IF NOT EXISTS section VARCHAR(100);
ALTER TABLE services     ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE services     ADD COLUMN IF NOT EXISTS booking_url TEXT;
ALTER TABLE services     ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- business_attributes
-- Every filterable attribute about a business in one place
-- ============================================================

CREATE TABLE IF NOT EXISTS business_attributes (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,

  -- Dietary
  dietary_options       TEXT[],
  -- ['vegan','gluten-free','halal','kosher','dairy-free','nut-free']

  -- Atmosphere
  atmosphere            TEXT[],
  -- ['romantic','lively','casual','upscale','dive-bar','family','sports']

  -- Practical
  parking               TEXT,
  -- 'free'|'paid'|'valet'|'street'|'none'
  dress_code            TEXT DEFAULT 'casual',
  reservations_required BOOL DEFAULT false,
  walk_ins_welcome      BOOL DEFAULT true,
  cash_only             BOOL DEFAULT false,
  accepts_crypto        BOOL DEFAULT false,
  wifi                  BOOL DEFAULT false,
  wifi_password         TEXT,
  charging_stations     BOOL DEFAULT false,

  -- Who it's best for
  best_for              TEXT[],
  -- ['families','couples','groups','solo','business','bachelor','bachelorette']

  -- Noise + vibe
  noise_level           TEXT,
  -- 'quiet'|'moderate'|'lively'|'loud'
  age_range             TEXT,
  -- 'all ages'|'21+'|'mostly 30s-50s'|'college crowd'

  -- Service
  service_style         TEXT,
  -- 'full service'|'counter order'|'buffet'|'self-serve'|'food truck'
  avg_check_per_person  TEXT,
  -- '$10-15'|'$20-35'|'$50+'

  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- business_highlights
-- Bullet points + tips — what the AI says first
-- ============================================================

CREATE TABLE IF NOT EXISTS business_highlights (
  site_id             UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,

  headline            TEXT,
  -- "Best grouper sandwich on the Alabama Gulf Coast"

  bullets             TEXT[],
  -- ["BYOB friendly", "cash only", "locals eat here daily", "no reservations needed"]

  local_tip           TEXT,
  -- "Park behind the building, the front lot fills up by noon"

  avoid_tip           TEXT,
  -- "Skip it on Saturday afternoons — 45 min wait"

  best_time           TEXT,
  -- "Tuesday-Thursday lunch, or after 8pm on weekends"

  signature_item      TEXT,
  -- "The Kraken Grouper Platter — $24, feeds two"

  fun_fact            TEXT,
  -- "Family owned since 1987, same recipe the whole time"

  deal_alert          TEXT,
  -- "Happy hour Mon-Fri 3-6pm: $2 off all drafts"

  updated_at          TIMESTAMP DEFAULT now()
);

-- ============================================================
-- amenities
-- Hotel / venue amenities as structured boolean flags
-- ============================================================

CREATE TABLE IF NOT EXISTS amenities (
  site_id             UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,

  -- Pool
  pool                BOOL DEFAULT false,
  pools_count         INT DEFAULT 0,
  indoor_pool         BOOL DEFAULT false,
  heated_pool         BOOL DEFAULT false,
  lazy_river          BOOL DEFAULT false,
  waterslide          BOOL DEFAULT false,
  hot_tub             BOOL DEFAULT false,

  -- Beach
  beachfront          BOOL DEFAULT false,
  beach_access        BOOL DEFAULT false,
  private_beach       BOOL DEFAULT false,
  beach_chairs        BOOL DEFAULT false,
  beach_umbrellas     BOOL DEFAULT false,

  -- On-site
  restaurant          BOOL DEFAULT false,
  bar                 BOOL DEFAULT false,
  room_service        BOOL DEFAULT false,
  gym                 BOOL DEFAULT false,
  spa                 BOOL DEFAULT false,
  sauna               BOOL DEFAULT false,
  business_center     BOOL DEFAULT false,
  concierge           BOOL DEFAULT false,

  -- Kids
  kids_club           BOOL DEFAULT false,
  playground          BOOL DEFAULT false,
  game_room           BOOL DEFAULT false,
  kids_pool           BOOL DEFAULT false,

  -- Connectivity
  wifi                BOOL DEFAULT true,
  wifi_free           BOOL DEFAULT true,

  -- Parking
  parking             BOOL DEFAULT false,
  parking_free        BOOL DEFAULT false,
  valet               BOOL DEFAULT false,

  -- Pet
  pet_friendly        BOOL DEFAULT false,
  pet_fee_note        TEXT,

  -- Other
  airport_shuttle     BOOL DEFAULT false,
  golf_course         BOOL DEFAULT false,
  tennis_courts       BOOL DEFAULT false,
  marina              BOOL DEFAULT false,
  boat_rentals        BOOL DEFAULT false,

  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- area_guides
-- Neighborhood + location guides the AI uses
-- ============================================================

CREATE TABLE IF NOT EXISTS area_guides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name            TEXT NOT NULL,
  -- "The Wharf", "Gulf Place", "Perdido Key", "Orange Beach Marina"

  area            TEXT,
  -- "Orange Beach" | "Gulf Shores" | "Fort Morgan"

  slug            TEXT UNIQUE,
  -- "the-wharf" | "gulf-place"

  short_desc      TEXT,
  -- 1 sentence for voice AI
  -- "The Wharf is Orange Beach's waterfront marina district with dining, shops, and concerts"

  full_desc       TEXT,
  -- full paragraph the AI can read from

  highlights      TEXT[],
  -- ["free parking", "waterfront dining", "live music nightly", "boat tours"]

  best_for        TEXT[],
  -- ["date night", "families", "nightlife", "shopping"]

  parking_note    TEXT,
  walkable        BOOL DEFAULT false,
  drive_from_beach TEXT,
  -- "5 min from Gulf Shores Public Beach"

  tip             TEXT,
  -- insider tip about this area

  image_url       TEXT,
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7),
  active          BOOL DEFAULT true,
  created_at      TIMESTAMP DEFAULT now()
);

-- ============================================================
-- itineraries (pre-built system itineraries)
-- NOT tourist-specific — these are templates AI uses
-- ============================================================

CREATE TABLE IF NOT EXISTS itineraries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  -- "Perfect Family Day in Orange Beach"
  -- "Date Night on the Gulf Coast"
  -- "The Ultimate Fishing Trip"
  -- "Rainy Day Plan B"

  description     TEXT,
  duration_hours  INT,
  tags            TEXT[],
  -- ["family","budget","outdoor","rainy-day","couples","fishing"]

  best_for        TEXT[],
  season          TEXT[],
  -- ["summer","fall","year-round"]

  est_cost_min    DECIMAL(8,2),
  est_cost_max    DECIMAL(8,2),
  created_by      TEXT DEFAULT 'gcr',
  -- 'gcr'|'admin'|'ai-generated'
  active          BOOL DEFAULT true,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS itinerary_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id        UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  site_id             UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  stop_order          INT,
  stop_type           TEXT,
  -- 'breakfast'|'activity'|'lunch'|'beach'|'dinner'|'drinks'|'shopping'
  suggested_time      TEXT,
  -- "7:00 AM" | "around noon" | "sunset"
  duration_minutes    INT,
  est_cost_per_person DECIMAL(8,2),
  why_included        TEXT,
  -- "great for kids, right on the water, easy parking"
  tip                 TEXT,
  -- "ask for the window table"
  optional            BOOL DEFAULT false
);

-- ============================================================
-- tourist_preferences
-- Simpler quick-access preferences pulled from tourist_memory
-- Updated as AI learns more
-- ============================================================

CREATE TABLE IF NOT EXISTS tourist_preferences (
  tourist_id          UUID PRIMARY KEY REFERENCES tourists(id) ON DELETE CASCADE,

  dietary             TEXT[],
  -- ['gluten-free','no-shellfish','vegetarian']
  budget              TEXT,
  -- 'budget'|'mid'|'upscale'|'luxury'
  party_size          INT,
  has_kids            BOOL DEFAULT false,
  kids_ages           INT[],
  has_pets            BOOL DEFAULT false,
  interests           TEXT[],
  -- ['fishing','beach','food','nightlife','shopping']
  max_drive_minutes   INT DEFAULT 20,
  wants_outdoor       BOOL,
  wants_waterfront    BOOL,
  wants_live_music    BOOL,
  wants_quiet         BOOL,

  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- ai_responses
-- Pre-built response templates for common intents
-- AI fills in business names + details at runtime
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_responses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  intent              TEXT NOT NULL,
  -- 'recommend_restaurant'|'find_happy_hour'|'what_to_do_tonight'
  -- 'find_live_music'|'kid_friendly'|'pet_friendly'|'rainy_day'
  -- 'best_seafood'|'romantic_dinner'|'cheap_eats'|'late_night'
  -- 'fishing_charter'|'boat_rental'|'beach_recommendation'

  conditions          JSONB,
  -- {"has_kids": true, "budget": "mid", "weather": "rainy"}
  -- {"time_of_day": "evening", "party_size": 2}

  response_template   TEXT NOT NULL,
  -- "Since you've got kids and it's raining, I'd head to {biz_1} —
  --  they have {biz_1.highlight}. Second option is {biz_2}."

  followup_questions  TEXT[],
  -- ["How many people?", "Any dietary restrictions?", "What time are you thinking?"]

  site_ids            UUID[],
  -- pre-matched businesses for this intent

  priority            INT DEFAULT 0,
  active              BOOL DEFAULT true,
  created_at          TIMESTAMP DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS ba_best_for_idx    ON business_attributes USING gin(best_for);
CREATE INDEX IF NOT EXISTS ba_dietary_idx     ON business_attributes USING gin(dietary_options);
CREATE INDEX IF NOT EXISTS ba_atmosphere_idx  ON business_attributes USING gin(atmosphere);
CREATE INDEX IF NOT EXISTS ag_area_idx        ON area_guides(area);
CREATE INDEX IF NOT EXISTS ag_slug_idx        ON area_guides(slug);
CREATE INDEX IF NOT EXISTS it_tags_idx        ON itineraries USING gin(tags);
CREATE INDEX IF NOT EXISTS tp_tourist_idx     ON tourist_preferences(tourist_id);
CREATE INDEX IF NOT EXISTS ai_intent_idx      ON ai_responses(intent);

-- ============================================================
-- DONE — added:
-- business_attributes, business_highlights, amenities
-- area_guides, itineraries, itinerary_items
-- tourist_preferences, ai_responses
-- Column additions: businesses.subcategory, menu_items.section
--   services.duration_minutes, services.booking_url, services.notes
-- ============================================================
