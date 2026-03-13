-- ============================================================
-- 03-concierge-schema.sql
-- Gulf Coast Radar — Tourist Concierge + Voice AI Schema
-- Run this in Supabase SQL Editor AFTER 01 and 02
-- ============================================================

-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- SECTION 1 — RAG / VECTOR SEARCH
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  chunk_type      TEXT NOT NULL,
  -- 'about'|'menu'|'hours'|'specials'|'reviews'|'packages'
  -- 'faq'|'amenities'|'vibe'|'tips'|'logistics'|'area'|'local-knowledge'
  content         TEXT NOT NULL,
  embedding       vector(1536),
  metadata        JSONB DEFAULT '{}',
  source          TEXT DEFAULT 'admin',
  -- 'admin'|'owner'|'scraper'|'ai-generated'
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chunks_embedding_idx
  ON ai_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS ai_chunks_site_id_idx ON ai_chunks(site_id);
CREATE INDEX IF NOT EXISTS ai_chunks_type_idx ON ai_chunks(chunk_type);

-- Pre-built Q&A pairs the AI learns from
CREATE TABLE IF NOT EXISTS qa_pairs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  -- NULL site_id = general GCR/area knowledge
  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  category        TEXT,
  -- 'hours'|'parking'|'menu'|'booking'|'directions'|'price'|'policy'
  embedding       vector(1536),
  confidence      DECIMAL(3,2) DEFAULT 1.0,
  active          BOOL DEFAULT true,
  created_at      TIMESTAMP DEFAULT now()
);

-- ============================================================
-- SECTION 2 — RICH BUSINESS DATA
-- ============================================================

-- Core AI-ready descriptions
CREATE TABLE IF NOT EXISTS business_details (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  elevator_pitch        TEXT,
  -- "Cosmo's is a waterfront seafood spot on Cotton Bayou..."
  vibe_description      TEXT,
  -- "lively beach bar, usually packed by noon on weekends"
  who_its_for           TEXT,
  -- "perfect for families, large groups, first-timers"
  what_to_expect        TEXT,
  -- "order at counter, seats inside and out, expect wait on weekends"
  signature_dish        TEXT,
  signature_drink       TEXT,
  must_try              TEXT[],
  avoid                 TEXT[],
  local_favorite        BOOL DEFAULT false,
  tourist_trap          BOOL DEFAULT false,
  award_winning         BOOL DEFAULT false,
  awards                TEXT[],
  years_in_business     INT,
  owner_name            TEXT,
  insider_tip           TEXT,
  best_kept_secret      TEXT,
  pro_tip               TEXT,
  best_time_of_day      TEXT,
  best_days             TEXT[],
  worst_days            TEXT[],
  avg_wait_time         TEXT,
  avg_visit_duration    TEXT,
  updated_at            TIMESTAMP DEFAULT now()
);

-- Parking, access, directions
CREATE TABLE IF NOT EXISTS business_logistics (
  site_id                   UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  parking_type              TEXT,
  -- 'free'|'paid'|'valet'|'street'|'none'
  parking_notes             TEXT,
  parking_lot_size          TEXT,
  -- 'small'|'medium'|'large'
  wheelchair_accessible     BOOL DEFAULT false,
  stroller_friendly         BOOL DEFAULT false,
  elevator                  BOOL DEFAULT false,
  waterfront_access         BOOL DEFAULT false,
  boat_accessible           BOOL DEFAULT false,
  dock_available            BOOL DEFAULT false,
  reservations              TEXT DEFAULT 'walk-in',
  -- 'required'|'recommended'|'walk-in-only'|'optional'
  reservation_url           TEXT,
  reservation_phone         TEXT,
  waitlist_app              TEXT,
  directions_note           TEXT,
  landmark                  TEXT,
  uber_friendly             BOOL DEFAULT true,
  golf_cart_parking         BOOL DEFAULT false,
  distance_from_beach       TEXT,
  distance_from_wharf       TEXT,
  updated_at                TIMESTAMP DEFAULT now()
);

-- Vibe, features, atmosphere
CREATE TABLE IF NOT EXISTS business_atmosphere (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  noise_level           TEXT,
  -- 'quiet'|'moderate'|'lively'|'loud'
  lighting              TEXT,
  seating_types         TEXT[],
  -- ['bar','booth','patio','rooftop','waterfront','picnic']
  dress_code            TEXT DEFAULT 'beach casual',
  avg_age_range         TEXT,
  live_music            BOOL DEFAULT false,
  live_music_schedule   TEXT,
  live_music_genre      TEXT,
  dance_floor           BOOL DEFAULT false,
  sports_tv             BOOL DEFAULT false,
  karaoke               BOOL DEFAULT false,
  trivia_night          TEXT,
  outdoor_seating       BOOL DEFAULT false,
  covered_outdoor       BOOL DEFAULT false,
  fire_pit              BOOL DEFAULT false,
  ocean_view            BOOL DEFAULT false,
  bay_view              BOOL DEFAULT false,
  sunset_view           BOOL DEFAULT false,
  wifi                  BOOL DEFAULT false,
  wifi_password         TEXT,
  charging_stations     BOOL DEFAULT false,
  pool_table            BOOL DEFAULT false,
  arcade_games          BOOL DEFAULT false,
  gift_shop             BOOL DEFAULT false,
  updated_at            TIMESTAMP DEFAULT now()
);

-- Food & drink specifics
CREATE TABLE IF NOT EXISTS menu_details (
  site_id                   UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  cuisine_types             TEXT[],
  cooking_styles            TEXT[],
  sourcing_note             TEXT,
  vegetarian_options        BOOL DEFAULT false,
  vegan_options             BOOL DEFAULT false,
  gluten_free_options       BOOL DEFAULT false,
  gluten_free_menu          BOOL DEFAULT false,
  dairy_free_options        BOOL DEFAULT false,
  nut_allergy_friendly      BOOL DEFAULT false,
  kids_menu                 BOOL DEFAULT false,
  kids_eat_free             TEXT,
  full_bar                  BOOL DEFAULT false,
  craft_beer                BOOL DEFAULT false,
  local_beer                BOOL DEFAULT false,
  wine_list                 BOOL DEFAULT false,
  signature_cocktails       BOOL DEFAULT false,
  byob                      BOOL DEFAULT false,
  corkage_fee               TEXT,
  happy_hour                BOOL DEFAULT false,
  happy_hour_schedule       TEXT,
  happy_hour_deals          TEXT,
  service_style             TEXT,
  -- 'table service'|'counter order'|'buffet'|'food truck'
  avg_check_per_person      TEXT,
  takeout                   BOOL DEFAULT false,
  delivery                  BOOL DEFAULT false,
  delivery_apps             TEXT[],
  catering                  BOOL DEFAULT false,
  updated_at                TIMESTAMP DEFAULT now()
);

-- Activities, tours, charters
CREATE TABLE IF NOT EXISTS activity_details (
  site_id                   UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  activity_type             TEXT,
  -- 'fishing-charter'|'boat-rental'|'dolphin-tour'|'kayak'|'parasail'|'jet-ski'
  difficulty                TEXT DEFAULT 'easy',
  physical_required         TEXT,
  min_age                   INT,
  max_age                   INT,
  min_weight_lbs            INT,
  max_weight_lbs            INT,
  swimming_required         BOOL DEFAULT false,
  experience_required       BOOL DEFAULT false,
  experience_note           TEXT,
  duration_hours            DECIMAL(4,1),
  departure_location        TEXT,
  departure_lat             DECIMAL(10,7),
  departure_lng             DECIMAL(10,7),
  what_to_bring             TEXT[],
  what_is_provided          TEXT[],
  fish_species              TEXT[],
  fishing_type              TEXT,
  -- 'inshore'|'offshore'|'deep-sea'|'bay'|'surf'
  trip_types                TEXT[],
  advance_booking_required  TEXT,
  cancellation_policy       TEXT,
  deposit_required          BOOL DEFAULT false,
  deposit_amount            DECIMAL(8,2),
  updated_at                TIMESTAMP DEFAULT now()
);

-- Hotels & accommodations
CREATE TABLE IF NOT EXISTS accommodation_details (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  star_rating           DECIMAL(2,1),
  total_rooms           INT,
  floors                INT,
  year_built            INT,
  year_renovated        INT,
  beachfront            BOOL DEFAULT false,
  beach_access          TEXT,
  beach_chairs_included BOOL DEFAULT false,
  pools                 INT DEFAULT 0,
  indoor_pool           BOOL DEFAULT false,
  heated_pool           BOOL DEFAULT false,
  lazy_river            BOOL DEFAULT false,
  waterslide            BOOL DEFAULT false,
  restaurant_on_site    BOOL DEFAULT false,
  bar_on_site           BOOL DEFAULT false,
  gym                   BOOL DEFAULT false,
  spa                   BOOL DEFAULT false,
  business_center       BOOL DEFAULT false,
  resort_fee            DECIMAL(8,2),
  resort_fee_includes   TEXT[],
  parking_fee           TEXT,
  pet_fee               TEXT,
  check_in_time         TEXT DEFAULT '4:00 PM',
  check_out_time        TEXT DEFAULT '11:00 AM',
  min_age_to_book       INT DEFAULT 21,
  pets_allowed          BOOL DEFAULT false,
  pet_size_limit        TEXT,
  smoking_policy        TEXT DEFAULT 'non-smoking',
  updated_at            TIMESTAMP DEFAULT now()
);

-- Packages (tours, charters, activities, hotels)
CREATE TABLE IF NOT EXISTS packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  price           DECIMAL(10,2),
  price_label     TEXT,
  -- 'per person'|'per boat'|'per night'|'flat rate'
  duration_minutes INT,
  whats_included  TEXT[],
  min_guests      INT DEFAULT 1,
  max_guests      INT,
  booking_url     TEXT,
  advance_hours   INT DEFAULT 24,
  -- how many hours ahead to book
  active          BOOL DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT now()
);

-- Room types for hotels
CREATE TABLE IF NOT EXISTS room_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- 'King Suite', 'Gulf Front Double', 'Studio'
  description     TEXT,
  price_per_night DECIMAL(10,2),
  price_weekend   DECIMAL(10,2),
  price_peak      DECIMAL(10,2),
  max_guests      INT,
  beds            TEXT,
  -- '1 King', '2 Queens', 'Bunk beds + Queen'
  sqft            INT,
  floor           TEXT,
  view            TEXT,
  -- 'gulf front'|'bay view'|'pool view'|'garden'
  amenities       TEXT[],
  image_url       TEXT,
  booking_url     TEXT,
  active          BOOL DEFAULT true,
  sort_order      INT DEFAULT 0
);

-- Business photos
CREATE TABLE IF NOT EXISTS photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  caption         TEXT,
  category        TEXT DEFAULT 'general',
  -- 'food'|'interior'|'exterior'|'menu'|'staff'|'event'|'view'
  featured        BOOL DEFAULT false,
  sort_order      INT DEFAULT 0,
  uploaded_by     TEXT DEFAULT 'admin',
  created_at      TIMESTAMP DEFAULT now()
);

-- Price guide for AI to quote
CREATE TABLE IF NOT EXISTS price_guide (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  price       DECIMAL(8,2),
  price_label TEXT,
  -- 'market price'|'seasonal'|'per person'
  category    TEXT,
  -- 'appetizer'|'entree'|'drink'|'dessert'|'activity'|'room'
  note        TEXT,
  active      BOOL DEFAULT true
);

-- Hours exceptions (holidays, closures, special hours)
CREATE TABLE IF NOT EXISTS hours_exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  closed      BOOL DEFAULT false,
  open_time   TIME,
  close_time  TIME,
  note        TEXT,
  -- "Closed Thanksgiving", "Holiday hours"
  created_at  TIMESTAMP DEFAULT now()
);

-- AI voice scripts per business
CREATE TABLE IF NOT EXISTS ai_voice_scripts (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  short_answer          TEXT,
  -- 1 sentence for quick voice response
  medium_answer         TEXT,
  -- 2-3 sentences
  full_answer           TEXT,
  -- complete description
  how_to_get_there      TEXT,
  -- spoken directions
  what_to_order         TEXT,
  -- "I'd recommend the grouper sandwich"
  reservation_script    TEXT,
  hours_script          TEXT,
  price_script          TEXT,
  -- "Expect to spend around $15-25 per person"
  kids_script           TEXT,
  -- specific note about kids/families
  pets_script           TEXT,
  updated_at            TIMESTAMP DEFAULT now()
);

-- Data completeness tracking
CREATE TABLE IF NOT EXISTS business_data_status (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  has_basic_info        BOOL DEFAULT false,
  has_photos            BOOL DEFAULT false,
  has_description       BOOL DEFAULT false,
  has_hours             BOOL DEFAULT false,
  has_contact           BOOL DEFAULT false,
  has_menu              BOOL DEFAULT false,
  has_packages          BOOL DEFAULT false,
  has_specials          BOOL DEFAULT false,
  has_events            BOOL DEFAULT false,
  has_reviews           BOOL DEFAULT false,
  has_ai_script         BOOL DEFAULT false,
  has_highlights        BOOL DEFAULT false,
  has_logistics         BOOL DEFAULT false,
  has_atmosphere        BOOL DEFAULT false,
  has_embeddings        BOOL DEFAULT false,
  completeness_score    INT DEFAULT 0,
  data_tier             TEXT DEFAULT 'stub',
  -- 'stub'|'basic'|'full'|'ai-ready'
  last_updated_by       TEXT,
  last_updated_at       TIMESTAMP DEFAULT now(),
  claimed_by_owner      BOOL DEFAULT false,
  needs_review          BOOL DEFAULT false,
  notes                 TEXT
);

-- ============================================================
-- SECTION 3 — MASTER FILTER TABLE (multi-criteria search)
-- ============================================================

CREATE TABLE IF NOT EXISTS business_filters (
  site_id                   UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,

  -- Food
  cuisine                   TEXT[],
  dietary_gluten_free       BOOL DEFAULT false,
  dietary_vegan             BOOL DEFAULT false,
  dietary_vegetarian        BOOL DEFAULT false,
  dietary_halal             BOOL DEFAULT false,
  kids_menu                 BOOL DEFAULT false,
  kids_eat_free             BOOL DEFAULT false,
  byob                      BOOL DEFAULT false,
  full_bar                  BOOL DEFAULT false,
  craft_beer                BOOL DEFAULT false,
  wine_list                 BOOL DEFAULT false,

  -- Happy hour
  has_happy_hour            BOOL DEFAULT false,
  happy_hour_days           TEXT[],
  happy_hour_start          TIME,
  happy_hour_end            TIME,
  happy_hour_deals          TEXT,

  -- Live music
  has_live_music            BOOL DEFAULT false,
  live_music_days           TEXT[],
  live_music_start          TIME,
  live_music_end            TIME,
  live_music_genre          TEXT[],

  -- Atmosphere
  outdoor_seating           BOOL DEFAULT false,
  waterfront                BOOL DEFAULT false,
  rooftop                   BOOL DEFAULT false,
  pet_friendly              BOOL DEFAULT false,
  kid_friendly              BOOL DEFAULT false,
  romantic                  BOOL DEFAULT false,
  group_friendly            BOOL DEFAULT false,
  sports_tv                 BOOL DEFAULT false,
  dance_floor               BOOL DEFAULT false,

  -- Logistics
  reservations_required     BOOL DEFAULT false,
  parking_free              BOOL DEFAULT false,
  wheelchair_accessible     BOOL DEFAULT false,
  boat_dock                 BOOL DEFAULT false,
  golf_cart_parking         BOOL DEFAULT false,

  -- Price
  price_range               TEXT,
  avg_check_min             DECIMAL(8,2),
  avg_check_max             DECIMAL(8,2),

  -- Hours (denormalized for fast query)
  open_monday               BOOL DEFAULT false,
  open_tuesday              BOOL DEFAULT false,
  open_wednesday            BOOL DEFAULT false,
  open_thursday             BOOL DEFAULT false,
  open_friday               BOOL DEFAULT false,
  open_saturday             BOOL DEFAULT false,
  open_sunday               BOOL DEFAULT false,
  open_time                 TIME,
  close_time                TIME,
  open_late                 BOOL DEFAULT false,
  open_early                BOOL DEFAULT false,

  -- Activities
  has_fishing               BOOL DEFAULT false,
  has_boat_rental           BOOL DEFAULT false,
  has_water_sports          BOOL DEFAULT false,
  has_tours                 BOOL DEFAULT false,
  has_golf                  BOOL DEFAULT false,
  has_arcade                BOOL DEFAULT false,

  updated_at                TIMESTAMP DEFAULT now()
);

-- ============================================================
-- SECTION 4 — AREA KNOWLEDGE
-- ============================================================

CREATE TABLE IF NOT EXISTS area_knowledge (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  -- 'Orange Beach'|'Gulf Shores'|'Fort Morgan'|'Perdido Key'
  description     TEXT,
  vibe            TEXT,
  best_for        TEXT[],
  avoid_if        TEXT[],
  distance_from_airport TEXT,
  insider_note    TEXT,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS neighborhoods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  area            TEXT,
  description     TEXT,
  walkable        BOOL DEFAULT false,
  best_for        TEXT[],
  parking_note    TEXT,
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7),
  radius_miles    DECIMAL(4,2)
);

CREATE TABLE IF NOT EXISTS beaches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  area            TEXT,
  crowd_level     TEXT,
  best_for        TEXT[],
  facilities      TEXT[],
  parking         TEXT,
  parking_fee     TEXT,
  dog_friendly    BOOL DEFAULT false,
  alcohol_allowed BOOL DEFAULT false,
  lifeguard       BOOL DEFAULT false,
  flag_system     BOOL DEFAULT true,
  insider_tip     TEXT,
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7)
);

CREATE TABLE IF NOT EXISTS local_tips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT,
  -- 'beach'|'food'|'parking'|'safety'|'money-saving'|'weather'|'traffic'
  tip         TEXT NOT NULL,
  source      TEXT DEFAULT 'local',
  area        TEXT,
  seasonal    BOOL DEFAULT false,
  season      TEXT,
  active      BOOL DEFAULT true,
  upvotes     INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hidden_gems (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  why_hidden          TEXT,
  how_to_find         TEXT,
  best_kept_secret    TEXT,
  verified_local      BOOL DEFAULT false,
  created_at          TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS money_saving_tips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area            TEXT,
  tip             TEXT NOT NULL,
  saves_amount    TEXT,
  valid_days      TEXT[],
  valid_times     TEXT,
  site_id         UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  active          BOOL DEFAULT true
);

CREATE TABLE IF NOT EXISTS comparisons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_a      UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  business_b      UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  category        TEXT,
  a_wins_at       TEXT[],
  b_wins_at       TEXT[],
  summary         TEXT,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transportation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT,
  -- 'uber'|'lyft'|'golf-cart-rental'|'trolley'|'bike-rental'|'water-taxi'
  name            TEXT,
  description     TEXT,
  coverage_area   TEXT,
  price_estimate  TEXT,
  contact         TEXT,
  website         TEXT,
  tip             TEXT,
  active          BOOL DEFAULT true
);

CREATE TABLE IF NOT EXISTS emergency_info (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        TEXT,
  -- 'hospital'|'urgent-care'|'pharmacy'|'police'|'coast-guard'|'vet'
  name            TEXT NOT NULL,
  address         TEXT,
  phone           TEXT,
  hours           TEXT,
  distance_note   TEXT,
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7)
);

CREATE TABLE IF NOT EXISTS grocery_and_supplies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT,
  -- 'grocery'|'liquor'|'bait'|'beach-supplies'|'pharmacy'|'convenience'
  area        TEXT,
  address     TEXT,
  hours       TEXT,
  note        TEXT,
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7)
);

CREATE TABLE IF NOT EXISTS seasonal_info (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  season          TEXT,
  -- 'spring-break'|'summer'|'fall'|'winter'|'snowbird'
  note            TEXT,
  best_months     TEXT[],
  crowd_level     TEXT,
  price_level     TEXT,
  -- 'peak'|'shoulder'|'off-season'
  special_hours   TEXT
);

CREATE TABLE IF NOT EXISTS live_conditions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area                TEXT NOT NULL,
  updated_at          TIMESTAMP DEFAULT now(),
  crowd_level         TEXT,
  traffic_note        TEXT,
  weather_advisory    TEXT,
  beach_flag          TEXT,
  -- 'green'|'yellow'|'red'|'double-red'
  water_temp_f        INT,
  wave_height         TEXT,
  jellyfish_warning   BOOL DEFAULT false,
  special_note        TEXT
);

-- ============================================================
-- SECTION 5 — TOURIST IDENTITY + FULL MEMORY
-- ============================================================

CREATE TABLE IF NOT EXISTS tourists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT UNIQUE,
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT,
  arrival_date    DATE,
  checkout_date   DATE,
  trip_active     BOOL DEFAULT true,
  hotel_name      TEXT,
  hotel_area      TEXT,
  hotel_site_id   UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  signup_source   TEXT DEFAULT 'sms',
  -- 'sms'|'qr-code'|'hotel-kiosk'|'referral'|'web'
  referral_business UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  agent_active    BOOL DEFAULT false,
  last_active_at  TIMESTAMP,
  total_conversations INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tourist_memory (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id            UUID REFERENCES tourists(id) ON DELETE CASCADE,

  -- Party
  party_size            INT,
  adults                INT,
  children              INT,
  children_ages         INT[],
  has_pets              BOOL DEFAULT false,
  pet_details           TEXT,

  -- Budget
  budget_level          TEXT,
  daily_spend_estimate  DECIMAL(8,2),

  -- Dietary (critical)
  dietary_restrictions  TEXT[],
  food_preferences      TEXT[],
  food_dislikes         TEXT[],
  drinks_alcohol        BOOL DEFAULT true,

  -- Interests
  primary_interests     TEXT[],
  activity_level        TEXT DEFAULT 'moderate',
  -- 'relaxed'|'moderate'|'active'|'adventurous'

  -- Mobility
  mobility_needs        TEXT,
  wheelchair            BOOL DEFAULT false,
  stroller              BOOL DEFAULT false,

  -- Learned preferences
  prefers_outdoor       BOOL,
  prefers_waterfront    BOOL,
  prefers_quiet         BOOL,
  prefers_lively        BOOL,
  loved_vibes           TEXT[],
  hated_vibes           TEXT[],

  -- Logistics
  has_car               BOOL DEFAULT true,
  car_count             INT DEFAULT 1,
  uses_rideshare        BOOL DEFAULT false,
  max_drive_minutes     INT DEFAULT 20,

  updated_at            TIMESTAMP DEFAULT now()
);

-- Every place they visited + reaction
CREATE TABLE IF NOT EXISTS tourist_visits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id          UUID REFERENCES tourists(id) ON DELETE CASCADE,
  site_id             UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  visit_date          DATE,
  meal_type           TEXT,
  -- 'breakfast'|'lunch'|'dinner'|'drinks'|'activity'|'shopping'
  rating              INT CHECK (rating BETWEEN 1 AND 5),
  liked               TEXT[],
  disliked            TEXT[],
  would_return        BOOL,
  recommend_to_others BOOL,
  tourist_quote       TEXT,
  -- exact words they said
  recommended_by      TEXT DEFAULT 'agent',
  created_at          TIMESTAMP DEFAULT now()
);

-- Every recommendation the agent made
CREATE TABLE IF NOT EXISTS agent_recommendations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id            UUID REFERENCES tourists(id) ON DELETE CASCADE,
  site_id               UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  recommendation_rank   INT DEFAULT 1,
  why_recommended       TEXT,
  query_text            TEXT,
  filters_used          JSONB,
  requested_for_time    TIME,
  requested_for_date    DATE,
  outcome               TEXT DEFAULT 'pending',
  -- 'visited'|'declined'|'saved'|'ignored'|'booked'|'pending'
  outcome_recorded_at   TIMESTAMP,
  tourist_feedback      TEXT,
  created_at            TIMESTAMP DEFAULT now()
);

-- Saved places / wishlist
CREATE TABLE IF NOT EXISTS tourist_saved_places (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id      UUID REFERENCES tourists(id) ON DELETE CASCADE,
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  saved_reason    TEXT,
  priority        TEXT DEFAULT 'want-to',
  -- 'must-do'|'want-to'|'maybe'
  planned_for_date DATE,
  planned_for_time TIME,
  notes           TEXT,
  visited         BOOL DEFAULT false,
  saved_at        TIMESTAMP DEFAULT now(),
  UNIQUE(tourist_id, site_id)
);

-- Agent search intent log
CREATE TABLE IF NOT EXISTS search_intents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id            UUID REFERENCES tourists(id) ON DELETE CASCADE,
  raw_query             TEXT,
  intent                TEXT,
  wants_happy_hour      BOOL,
  wants_live_music      BOOL,
  wants_gluten_free     BOOL,
  wants_vegan           BOOL,
  wants_outdoor         BOOL,
  wants_waterfront      BOOL,
  wants_pet_friendly    BOOL,
  wants_kid_friendly    BOOL,
  wants_open_now        BOOL,
  requested_time        TIME,
  requested_day         TEXT,
  resolved_day          TEXT,
  resolved_date         DATE,
  budget_level          TEXT,
  party_size            INT,
  cuisine_requested     TEXT,
  filters_extracted     JSONB,
  results_returned      INT,
  top_result_id         UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  tourist_chose         UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  created_at            TIMESTAMP DEFAULT now()
);

-- ============================================================
-- SECTION 6 — FULL TRIP ITINERARY
-- ============================================================

CREATE TABLE IF NOT EXISTS trip_itineraries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id        UUID REFERENCES tourists(id) ON DELETE CASCADE,
  title             TEXT,
  total_days        INT,
  est_total_spend   DECIMAL(10,2),
  agent_notes       TEXT,
  created_at        TIMESTAMP DEFAULT now(),
  updated_at        TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS itinerary_days (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id    UUID REFERENCES trip_itineraries(id) ON DELETE CASCADE,
  tourist_id      UUID REFERENCES tourists(id) ON DELETE CASCADE,
  day_number      INT,
  date            DATE,
  theme           TEXT,
  weather_note    TEXT,
  est_spend       DECIMAL(8,2)
);

CREATE TABLE IF NOT EXISTS itinerary_stops (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id                UUID REFERENCES itinerary_days(id) ON DELETE CASCADE,
  tourist_id            UUID REFERENCES tourists(id) ON DELETE CASCADE,
  site_id               UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  stop_order            INT,
  stop_type             TEXT,
  -- 'breakfast'|'activity'|'lunch'|'beach'|'dinner'|'drinks'|'shopping'
  start_time            TIME,
  end_time              TIME,
  duration_minutes      INT,
  est_cost_per_person   DECIMAL(8,2),
  agent_note            TEXT,
  booking_required      BOOL DEFAULT false,
  booking_url           TEXT,
  booking_confirmed     BOOL DEFAULT false,
  confirmation_code     TEXT,
  status                TEXT DEFAULT 'planned',
  -- 'planned'|'confirmed'|'visited'|'skipped'|'replaced'
  replaced_with         UUID REFERENCES businesses(site_id) ON DELETE SET NULL
);

-- ============================================================
-- SECTION 7 — AGENT STATE (persistent memory per tourist)
-- ============================================================

CREATE TABLE IF NOT EXISTS tourist_agent_state (
  tourist_id            UUID PRIMARY KEY REFERENCES tourists(id) ON DELETE CASCADE,

  -- Running summary (AI rewrites this after each conversation)
  profile_summary       TEXT,

  -- Onboarding completion
  confirmed_dietary     BOOL DEFAULT false,
  confirmed_budget      BOOL DEFAULT false,
  confirmed_party       BOOL DEFAULT false,
  confirmed_interests   BOOL DEFAULT false,
  onboarding_complete   BOOL DEFAULT false,

  -- Live context
  last_topic            TEXT,
  last_businesses       UUID[],
  pending_question      TEXT,

  -- Trip progress
  days_in               INT DEFAULT 0,
  places_visited        INT DEFAULT 0,
  places_saved          INT DEFAULT 0,
  conversations_total   INT DEFAULT 0,
  last_conversation_at  TIMESTAMP,

  -- Proactive messaging
  send_morning_brief      BOOL DEFAULT false,
  send_evening_suggestions BOOL DEFAULT false,
  morning_brief_time      TIME DEFAULT '08:00',
  opted_out_proactive     BOOL DEFAULT false,

  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- SECTION 8 — COMPLETENESS VIEW
-- ============================================================

CREATE OR REPLACE VIEW business_completeness AS
SELECT
  b.name,
  b.type,
  b.subdomain,
  COALESCE(s.data_tier, 'stub')           AS data_tier,
  COALESCE(s.completeness_score, 0)       AS score,
  COALESCE(s.has_basic_info,   false)     AS basic_info,
  COALESCE(s.has_photos,       false)     AS photos,
  COALESCE(s.has_menu,         false)     AS menu,
  COALESCE(s.has_ai_script,    false)     AS ai_script,
  COALESCE(s.has_embeddings,   false)     AS embeddings,
  COALESCE(s.has_logistics,    false)     AS logistics,
  s.last_updated_at,
  s.notes
FROM businesses b
LEFT JOIN business_data_status s ON s.site_id = b.site_id
ORDER BY COALESCE(s.completeness_score, 0) DESC;

-- ============================================================
-- SECTION 9 — INDEXES FOR FAST SEARCH
-- ============================================================

CREATE INDEX IF NOT EXISTS bf_happy_hour_idx   ON business_filters(has_happy_hour);
CREATE INDEX IF NOT EXISTS bf_live_music_idx   ON business_filters(has_live_music);
CREATE INDEX IF NOT EXISTS bf_gluten_free_idx  ON business_filters(dietary_gluten_free);
CREATE INDEX IF NOT EXISTS bf_pet_friendly_idx ON business_filters(pet_friendly);
CREATE INDEX IF NOT EXISTS bf_kid_friendly_idx ON business_filters(kid_friendly);
CREATE INDEX IF NOT EXISTS bf_waterfront_idx   ON business_filters(waterfront);
CREATE INDEX IF NOT EXISTS bf_outdoor_idx      ON business_filters(outdoor_seating);
CREATE INDEX IF NOT EXISTS bf_open_time_idx    ON business_filters(open_time, close_time);

CREATE INDEX IF NOT EXISTS tv_tourist_idx      ON tourist_visits(tourist_id);
CREATE INDEX IF NOT EXISTS tv_site_idx         ON tourist_visits(site_id);
CREATE INDEX IF NOT EXISTS tsp_tourist_idx     ON tourist_saved_places(tourist_id);
CREATE INDEX IF NOT EXISTS si_tourist_idx      ON search_intents(tourist_id);
CREATE INDEX IF NOT EXISTS ar_tourist_idx      ON agent_recommendations(tourist_id);

-- ============================================================
-- DONE
-- ============================================================
-- Tables created:
-- ai_chunks, qa_pairs
-- business_details, business_logistics, business_atmosphere
-- menu_details, activity_details, accommodation_details
-- packages, room_types, photos, price_guide
-- hours_exceptions, ai_voice_scripts, business_data_status
-- business_filters
-- area_knowledge, neighborhoods, beaches
-- local_tips, hidden_gems, money_saving_tips
-- comparisons, transportation, emergency_info
-- grocery_and_supplies, seasonal_info, live_conditions
-- tourists, tourist_memory, tourist_visits
-- agent_recommendations, tourist_saved_places
-- search_intents, trip_itineraries, itinerary_days
-- itinerary_stops, tourist_agent_state
-- VIEW: business_completeness
-- ============================================================
