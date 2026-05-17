a-- ============================================================
-- GCR COMPLETE SCHEMA: Listings + Admin Editing + All AI
-- Run in GCR Supabase SQL Editor (adpnhipmdefutkzzltbs)
-- Safe to re-run — uses CREATE TABLE IF NOT EXISTS throughout
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ====== CORE GCR ENTITY TABLES ======
-- ============================================================
-- GCR Entity Schema — Gulf Coast Radar
-- Separate Supabase project: adpnhipmdefutkzzltbs.supabase.co
-- Run this in the GCR Supabase SQL Editor
-- ============================================================

-- ============================================
-- ENTITY (one row per GCR business)
-- ============================================
CREATE TABLE IF NOT EXISTS entity (
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
CREATE TABLE IF NOT EXISTS entity_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INT DEFAULT 0
);

CREATE INDEX idx_entity_features_entity ON entity_features(entity_id);

-- ============================================
-- ENTITY PERFECT FOR (perfect_for chips)
-- ============================================
CREATE TABLE IF NOT EXISTS entity_perfect_for (
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
CREATE TABLE IF NOT EXISTS entity_sections (
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
CREATE TABLE IF NOT EXISTS section_rich_text (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE,
    body_text TEXT,
    UNIQUE(section_id)
);

-- ============================================
-- SECTION: BULLETS (highlights, guest info, restrictions)
-- One row per bullet
-- ============================================
CREATE TABLE IF NOT EXISTS section_bullets (
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
CREATE TABLE IF NOT EXISTS section_groups (
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
CREATE TABLE IF NOT EXISTS section_items (
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
CREATE TABLE IF NOT EXISTS section_cards (
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
CREATE TABLE IF NOT EXISTS section_photos (
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
CREATE TABLE IF NOT EXISTS section_reviews (
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
CREATE TABLE IF NOT EXISTS section_hours (
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
CREATE TABLE IF NOT EXISTS section_location (
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
CREATE TABLE IF NOT EXISTS entity_tags (
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

-- ====== GCR DASHBOARD EDIT TABLES (reviews, analytics, customers, staff, media, seo, sms, social) ======
--- =============================================
-- GCR Dashboard Tables
-- Run in GCR Supabase SQL Editor
-- These are NEW tables — does NOT touch CyberCheck main DB
-- =============================================

-- Sponsored + sort for entities (if not already added)
ALTER TABLE entity ADD COLUMN IF NOT EXISTS is_sponsored boolean DEFAULT false;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 999;

-- ── Analytics ──────────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  page_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  device_type text DEFAULT 'unknown',
  session_id text,
  visitor_id text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_pv_entity ON gcr_page_views(entity_id);
CREATE INDEX IF NOT EXISTS idx_gcr_pv_date ON gcr_page_views(created_at);

CREATE TABLE IF NOT EXISTS gcr_conversions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  conversion_type text DEFAULT 'click', -- click, call, directions, booking, website
  value numeric DEFAULT 0,
  source text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_conv_entity ON gcr_conversions(entity_id);

-- ── Reviews ────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  customer_name text,
  customer_email text,
  customer_phone text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  review_method text DEFAULT 'text', -- text, voice
  photos jsonb DEFAULT '[]',
  guest_feedback jsonb DEFAULT '[]',
  status text DEFAULT 'pending', -- pending, approved, published
  source text DEFAULT 'gcr', -- gcr, google, yelp, tripadvisor
  token text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_reviews_entity ON gcr_reviews(entity_id);
CREATE INDEX IF NOT EXISTS idx_gcr_reviews_status ON gcr_reviews(status);

CREATE TABLE IF NOT EXISTS gcr_review_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text DEFAULT 'stars', -- stars, yesno, text
  display_order integer DEFAULT 0,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── Customers / CRM ───────────────────────────
CREATE TABLE IF NOT EXISTS gcr_customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  status text DEFAULT 'customer', -- lead, customer, vip, inactive
  tier text DEFAULT 'standard',
  total_visits integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  last_visit timestamptz,
  notes text,
  tags jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_cust_entity ON gcr_customers(entity_id);
CREATE INDEX IF NOT EXISTS idx_gcr_cust_email ON gcr_customers(email);

-- ── Staff / Team ──────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_staff (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  bio text,
  photo_url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Media Library ─────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  url text NOT NULL,
  filename text,
  alt_text text,
  file_size integer,
  file_type text,
  folder text DEFAULT 'general', -- general, gallery, reviews, menu
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_media_entity ON gcr_media(entity_id);

-- ── FAQs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_faqs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Social Media Connections ──────────────────
CREATE TABLE IF NOT EXISTS gcr_social_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  platform text NOT NULL, -- facebook, instagram, tiktok, twitter, youtube, google_business
  account_name text,
  account_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_connected boolean DEFAULT false,
  connected_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gcr_social_unique ON gcr_social_accounts(entity_id, platform);

CREATE TABLE IF NOT EXISTS gcr_social_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  platform text NOT NULL,
  content text,
  image_url text,
  status text DEFAULT 'draft', -- draft, scheduled, published, failed
  scheduled_at timestamptz,
  published_at timestamptz,
  engagement jsonb DEFAULT '{}', -- likes, shares, comments
  created_at timestamptz DEFAULT now()
);

-- ── OAuth Connections (Stripe, Google, etc.) ──
CREATE TABLE IF NOT EXISTS gcr_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  provider text NOT NULL, -- stripe, square, paypal, google_business, google_analytics
  account_name text,
  account_id text,
  credentials jsonb DEFAULT '{}',
  status text DEFAULT 'connected',
  connected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gcr_conn_unique ON gcr_connections(entity_id, provider);

-- ── SMS / Messaging ───────────────────────────
CREATE TABLE IF NOT EXISTS gcr_messaging_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE UNIQUE,
  owner_phone text,
  customer_phone text,
  notification_email text,
  booking_sms_template text,
  review_sms_template text,
  notify_on_booking boolean DEFAULT true,
  notify_on_review boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gcr_sms_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  to_number text,
  from_number text,
  message text,
  direction text DEFAULT 'outbound', -- outbound, inbound
  status text DEFAULT 'sent',
  twilio_sid text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_sms_entity ON gcr_sms_log(entity_id);

-- ── Coupons / Promo Codes ─────────────────────
CREATE TABLE IF NOT EXISTS gcr_coupons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  code text NOT NULL,
  type text DEFAULT 'percentage', -- percentage, fixed
  amount numeric NOT NULL,
  min_order numeric DEFAULT 0,
  max_uses integer,
  uses_count integer DEFAULT 0,
  description text,
  active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ── Waitlist ──────────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  customer_name text,
  customer_email text,
  customer_phone text,
  preferred_date date,
  party_size integer DEFAULT 1,
  notes text,
  status text DEFAULT 'waiting', -- waiting, notified, booked, removed
  notified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ── SEO Settings ──────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_seo_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE UNIQUE,
  seo_title text,
  seo_description text,
  seo_keywords text,
  og_image text,
  ga4_id text,
  facebook_pixel_id text,
  canonical_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── Activity Log ──────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  action text NOT NULL, -- created, updated, deleted, published, sponsored
  entity_type text, -- entity, review, event, special, section
  description text,
  user_id text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_activity_date ON gcr_activity_log(created_at);

-- ── RLS Policies (allow service role full access) ──
-- These tables use service_role key from the API, so no RLS restrictions needed.
-- If you want public read access for some tables, add policies later.

-- ====== ADMIN → ENTITY CONNECTION (entity_owners, bookings, availability) ======
-- =========================================================
-- Connect Admin Dashboard → GCR DB (single source of truth)
-- Run this in the GCR Supabase SQL editor (adpnhipmdefutkzzltbs).
-- Safe to re-run — every statement uses IF NOT EXISTS.
-- =========================================================

-- 1) OWNER → ENTITY LINK
-- When an owner logs in, their auth.users.id is mapped to one entity they can edit.
CREATE TABLE IF NOT EXISTS entity_owners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  role        text DEFAULT 'owner',
  created_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_owners_user_entity
  ON entity_owners(user_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_owners_entity ON entity_owners(entity_id);

-- Bridge column for existing login users whose token still carries a site_id.
ALTER TABLE entity ADD COLUMN IF NOT EXISTS legacy_site_id uuid;
CREATE INDEX IF NOT EXISTS idx_entity_legacy_site_id ON entity(legacy_site_id);

-- 2) TAGS / MODIFIERS on menu + drink + happy_hour item tables
-- The admin dashboard stores these per item. JSONB for flexibility.
ALTER TABLE menu_items         ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE menu_items         ADD COLUMN IF NOT EXISTS modifiers jsonb DEFAULT '[]'::jsonb;
ALTER TABLE drink_items        ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE drink_items        ADD COLUMN IF NOT EXISTS modifiers jsonb DEFAULT '[]'::jsonb;
ALTER TABLE happy_hour_items   ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE happy_hour_items   ADD COLUMN IF NOT EXISTS modifiers jsonb DEFAULT '[]'::jsonb;

-- 3) BUSINESS-DATA TABLES missing from GCR DB
-- (Everything else — specials, events, coupons, customers, staff, media,
--  faqs, reviews, messaging, social, seo, connections, waitlist, addons,
--  packages, products, pages, daily rotation — already exists.)

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id        uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  customer_name    text,
  customer_email   text,
  customer_phone   text,
  booking_date     date,
  start_time       text,
  end_time         text,
  party_size       integer DEFAULT 1,
  items            jsonb DEFAULT '[]',
  total_amount     numeric,
  deposit_amount   numeric,
  payment_status   text DEFAULT 'unpaid',
  payment_id       text,
  status           text DEFAULT 'pending',
  token            text UNIQUE,
  notes            text,
  metadata         jsonb DEFAULT '{}',
  review_sent_at   timestamptz,
  reminder_sent_at timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_entity ON bookings(entity_id);
CREATE INDEX IF NOT EXISTS idx_bookings_date   ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Per-item per-date availability
CREATE TABLE IF NOT EXISTS availability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  item_id     uuid,
  date        date NOT NULL,
  status      text DEFAULT 'available',
  booking_id  uuid REFERENCES bookings(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(entity_id, item_id, date)
);
CREATE INDEX IF NOT EXISTS idx_availability_entity_date ON availability(entity_id, date);

-- Whole-day blackouts
CREATE TABLE IF NOT EXISTS blackout_dates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  label       text,
  date_from   date NOT NULL,
  date_to     date NOT NULL,
  reason      text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blackout_entity ON blackout_dates(entity_id);
CREATE INDEX IF NOT EXISTS idx_blackout_dates  ON blackout_dates(date_from, date_to);

-- Waivers (templates + signed)
CREATE TABLE IF NOT EXISTS waiver_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id   uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  name        text NOT NULL,
  body_html   text,
  is_default  boolean DEFAULT false,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_waiver_templates_entity ON waiver_templates(entity_id);

CREATE TABLE IF NOT EXISTS waivers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id           uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  waiver_template_id  uuid REFERENCES waiver_templates(id) ON DELETE SET NULL,
  booking_id          uuid REFERENCES bookings(id) ON DELETE SET NULL,
  customer_name       text,
  customer_email      text,
  customer_phone      text,
  signature_data      text,
  ip_address          text,
  signed_at           timestamptz,
  metadata            jsonb DEFAULT '{}',
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_waivers_entity ON waivers(entity_id);

-- Inventory (fleet_types is the parent of fleet_items, which already exists)
CREATE TABLE IF NOT EXISTS fleet_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id    uuid NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  image_url    text,
  specs        jsonb DEFAULT '{}',
  sort_order   int DEFAULT 0,
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fleet_types_entity ON fleet_types(entity_id);

ALTER TABLE fleet_items ADD COLUMN IF NOT EXISTS fleet_type_id uuid REFERENCES fleet_types(id) ON DELETE CASCADE;
ALTER TABLE fleet_items ADD COLUMN IF NOT EXISTS condition    text DEFAULT 'available';
CREATE INDEX IF NOT EXISTS idx_fleet_items_fleet_type ON fleet_items(fleet_type_id);

-- ====== AI + MISSING GCR TABLES ======
-- ============================================================
-- GCR Missing Tables — Part 2
-- Run in GCR Supabase SQL Editor (adpnhipmdefutkzzltbs)
-- Uses entity_id instead of site_id
-- ============================================================

-- ai_chunks
CREATE TABLE IF NOT EXISTS ai_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  chunk_type text, content text, metadata jsonb DEFAULT '{}',
  source text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- attribution_data
CREATE TABLE IF NOT EXISTS attribution_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  referral_source text, referral_details text,
  utm_source text, utm_medium text, utm_campaign text,
  first_touch_source text, first_touch_date timestamptz,
  last_touch_source text, last_touch_date timestamptz,
  total_sessions integer DEFAULT 0, created_at timestamptz DEFAULT now()
);

-- business_completeness
CREATE TABLE IF NOT EXISTS business_completeness (
  entity_id uuid PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  data_tier text, score integer DEFAULT 0,
  basic_info boolean DEFAULT false, photos boolean DEFAULT false,
  menu boolean DEFAULT false, ai_script boolean DEFAULT false,
  embeddings boolean DEFAULT false, logistics boolean DEFAULT false,
  last_updated_at timestamptz, notes text
);

-- business_data_status
CREATE TABLE IF NOT EXISTS business_data_status (
  entity_id uuid PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  has_basic_info boolean DEFAULT false, has_photos boolean DEFAULT false,
  has_description boolean DEFAULT false, has_hours boolean DEFAULT false,
  has_contact boolean DEFAULT false, has_menu boolean DEFAULT false,
  has_packages boolean DEFAULT false, has_specials boolean DEFAULT false,
  has_events boolean DEFAULT false, has_reviews boolean DEFAULT false,
  has_ai_script boolean DEFAULT false, has_highlights boolean DEFAULT false,
  has_logistics boolean DEFAULT false, has_atmosphere boolean DEFAULT false,
  has_embeddings boolean DEFAULT false, completeness_score integer DEFAULT 0,
  data_tier text, last_updated_by text, last_updated_at timestamptz,
  claimed_by_owner boolean DEFAULT false, needs_review boolean DEFAULT false, notes text
);

-- comparisons
CREATE TABLE IF NOT EXISTS comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a uuid REFERENCES entity(id) ON DELETE CASCADE,
  entity_b uuid REFERENCES entity(id) ON DELETE CASCADE,
  category text, a_wins_at text[], b_wins_at text[],
  summary text, created_at timestamptz DEFAULT now()
);

-- connections
CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  provider text NOT NULL, access_token text, refresh_token text,
  token_expires_at timestamptz, account_id text, account_name text,
  status text DEFAULT 'connected', metadata jsonb DEFAULT '{}',
  connected_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_entity_provider ON connections(entity_id, provider);

-- conversions (analytics)
CREATE TABLE IF NOT EXISTS conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  conversion_type text, conversion_value numeric, revenue numeric,
  customer_email text, customer_name text,
  utm_source text, utm_medium text, utm_campaign text,
  referrer text, session_id text, metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- coupons
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  code text NOT NULL, type text, amount numeric,
  min_order numeric DEFAULT 0, max_uses integer,
  uses_count integer DEFAULT 0, expires_at timestamptz,
  description text, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  name text, phone text, email text, notes text,
  tier text DEFAULT 'standard', total_orders integer DEFAULT 0,
  total_bookings integer DEFAULT 0, total_spent numeric DEFAULT 0,
  last_visit timestamptz, tags jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- emergency_info
CREATE TABLE IF NOT EXISTS emergency_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text, name text, address text, phone text,
  hours text, distance_note text, lat numeric, lng numeric
);

-- faq_items
CREATE TABLE IF NOT EXISTS faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  question text, answer text, sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- gcr_claims
CREATE TABLE IF NOT EXISTS gcr_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  business_name text, claimant_name text, claimant_email text,
  claimant_phone text, business_role text, notes text,
  claim_type text, status text DEFAULT 'pending',
  admin_notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- gcr_directory
CREATE TABLE IF NOT EXISTS gcr_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, type text, category text, subcategory jsonb DEFAULT '{}',
  tags jsonb DEFAULT '[]', rating numeric, user_ratings_total integer,
  price_level smallint, description text, image text,
  website text, phone text, hours text,
  specials jsonb DEFAULT '{}', events jsonb DEFAULT '{}',
  happy_hour jsonb DEFAULT '{}', menu jsonb DEFAULT '{}',
  address text, city text, state text, lat numeric, lng numeric,
  about_text text, social_links jsonb DEFAULT '{}', gallery jsonb DEFAULT '[]'
);

-- gcr_feed_posts
CREATE TABLE IF NOT EXISTS gcr_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  type text, text text, image_url text, link_url text,
  link_text text, emoji text, pinned boolean DEFAULT false,
  active boolean DEFAULT true, expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  business_name text, business_logo text
);

-- gcr_menu_items
CREATE TABLE IF NOT EXISTS gcr_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  menu_type text, section text, section_order integer DEFAULT 0,
  name text NOT NULL, description text, price text,
  price_variants jsonb DEFAULT '{}', available_days text[],
  available_start time, available_end time,
  tags text[], sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- grocery_and_supplies
CREATE TABLE IF NOT EXISTS grocery_and_supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, type text, area text, address text,
  hours text, note text, lat numeric, lng numeric
);

-- hidden_gems
CREATE TABLE IF NOT EXISTS hidden_gems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  why_hidden text, how_to_find text, best_kept_secret text,
  verified_local boolean DEFAULT false, created_at timestamptz DEFAULT now()
);

-- hours_exceptions
CREATE TABLE IF NOT EXISTS hours_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  date date, closed boolean DEFAULT false,
  open_time time, close_time time, note text,
  created_at timestamptz DEFAULT now()
);

-- tourists
CREATE TABLE IF NOT EXISTS tourists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text, first_name text, last_name text, email text,
  arrival_date date, checkout_date date, trip_active boolean DEFAULT true,
  hotel_name text, hotel_area text,
  hotel_entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  signup_source text, agent_active boolean DEFAULT true,
  last_active_at timestamptz, total_conversations integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tourists_phone ON tourists(phone);

-- tourist_sessions
CREATE TABLE IF NOT EXISTS tourist_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  name text, phone text, interests text[], visitor_type text,
  checkin date, checkout date, session_id uuid UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- tourist_conversations
CREATE TABLE IF NOT EXISTS tourist_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES tourist_sessions(id) ON DELETE CASCADE,
  tourist_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  role text, content text, created_at timestamptz DEFAULT now()
);

-- tourist_memory
CREATE TABLE IF NOT EXISTS tourist_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid UNIQUE REFERENCES tourists(id) ON DELETE CASCADE,
  party_size integer, adults integer, children integer,
  children_ages integer[], has_pets boolean DEFAULT false,
  pet_details text, budget_level text, daily_spend_estimate numeric,
  dietary_restrictions text[], food_preferences text[], food_dislikes text[],
  drinks_alcohol boolean DEFAULT true, primary_interests text[],
  activity_level text, mobility_needs text, wheelchair boolean DEFAULT false,
  stroller boolean DEFAULT false, prefers_outdoor boolean DEFAULT false,
  prefers_waterfront boolean DEFAULT false, prefers_quiet boolean DEFAULT false,
  prefers_lively boolean DEFAULT false, loved_vibes text[], hated_vibes text[],
  has_car boolean DEFAULT true, car_count integer DEFAULT 1,
  uses_rideshare boolean DEFAULT false, max_drive_minutes integer DEFAULT 20,
  updated_at timestamptz DEFAULT now()
);

-- tourist_preferences
CREATE TABLE IF NOT EXISTS tourist_preferences (
  tourist_id uuid PRIMARY KEY REFERENCES tourists(id) ON DELETE CASCADE,
  dietary text[], budget text, party_size integer,
  has_kids boolean DEFAULT false, kids_ages integer[],
  has_pets boolean DEFAULT false, interests text[],
  max_drive_minutes integer DEFAULT 20,
  wants_outdoor boolean DEFAULT false, wants_waterfront boolean DEFAULT false,
  wants_live_music boolean DEFAULT false, wants_quiet boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- tourist_agent_state
CREATE TABLE IF NOT EXISTS tourist_agent_state (
  tourist_id uuid PRIMARY KEY REFERENCES tourists(id) ON DELETE CASCADE,
  profile_summary text, confirmed_dietary boolean DEFAULT false,
  confirmed_budget boolean DEFAULT false, confirmed_party boolean DEFAULT false,
  confirmed_interests boolean DEFAULT false, onboarding_complete boolean DEFAULT false,
  last_topic text, last_businesses text[], pending_question text,
  days_in integer DEFAULT 0, places_visited integer DEFAULT 0,
  places_saved integer DEFAULT 0, conversations_total integer DEFAULT 0,
  last_conversation_at timestamptz, send_morning_brief boolean DEFAULT false,
  send_evening_suggestions boolean DEFAULT false,
  morning_brief_time time, opted_out_proactive boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- tourist_saved_places
CREATE TABLE IF NOT EXISTS tourist_saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  saved_reason text, priority text DEFAULT 'normal',
  planned_for_date date, planned_for_time time,
  notes text, visited boolean DEFAULT false,
  saved_at timestamptz DEFAULT now()
);

-- tourist_visits
CREATE TABLE IF NOT EXISTS tourist_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  visit_date date, meal_type text, rating integer,
  liked text[], disliked text[], would_return boolean,
  recommend_to_others boolean, tourist_quote text,
  recommended_by text, created_at timestamptz DEFAULT now()
);

-- trip_itineraries
CREATE TABLE IF NOT EXISTS trip_itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  title text, total_days integer, est_total_spend numeric,
  agent_notes text, created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- itineraries
CREATE TABLE IF NOT EXISTS itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text, description text, duration_hours integer,
  tags text[], best_for text[], season text[],
  est_cost_min numeric, est_cost_max numeric,
  created_by text, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- itinerary_days
CREATE TABLE IF NOT EXISTS itinerary_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid REFERENCES itineraries(id) ON DELETE CASCADE,
  tourist_id uuid REFERENCES tourists(id) ON DELETE SET NULL,
  day_number integer, date date, theme text,
  weather_note text, est_spend numeric
);

-- itinerary_items
CREATE TABLE IF NOT EXISTS itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid REFERENCES itineraries(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  stop_order integer, stop_type text, suggested_time text,
  duration_minutes integer, est_cost_per_person numeric,
  why_included text, tip text, optional boolean DEFAULT false
);

-- itinerary_stops
CREATE TABLE IF NOT EXISTS itinerary_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid REFERENCES itinerary_days(id) ON DELETE CASCADE,
  tourist_id uuid REFERENCES tourists(id) ON DELETE SET NULL,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  stop_order integer, stop_type text,
  start_time time, end_time time, duration_minutes integer,
  est_cost_per_person numeric, agent_note text,
  booking_required boolean DEFAULT false, booking_url text,
  booking_confirmed boolean DEFAULT false, confirmation_code text,
  status text DEFAULT 'planned'
);

-- leads
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, business_name text, email text, phone text,
  business_type text, interest text, source text,
  status text DEFAULT 'new', notes text,
  created_at timestamptz DEFAULT now()
);

-- live_conditions
CREATE TABLE IF NOT EXISTS live_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text, updated_at timestamptz DEFAULT now(),
  crowd_level text, traffic_note text, weather_advisory text,
  beach_flag text, water_temp_f integer, wave_height text,
  jellyfish_warning boolean DEFAULT false, special_note text
);

-- local_tips
CREATE TABLE IF NOT EXISTS local_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text, tip text, source text, area text,
  seasonal boolean DEFAULT false, season text,
  active boolean DEFAULT true, upvotes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- locations
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text, address text, city text, state text, zip text,
  lat numeric, lng numeric, phone text, notes text,
  is_primary boolean DEFAULT false, active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- loyalty_signups
CREATE TABLE IF NOT EXISTS loyalty_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, email text, phone text, visitor_type text,
  interests text[], checkin date, checkout date,
  source text, sms_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- media_library
CREATE TABLE IF NOT EXISTS media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  url text, caption text, type text, sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- menu_categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text NOT NULL, description text,
  time_start time, time_end time, image_url text,
  sort_order integer DEFAULT 0, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- menu_details
CREATE TABLE IF NOT EXISTS menu_details (
  entity_id uuid PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  cuisine_types text[], cooking_styles text[], sourcing_note text,
  vegetarian_options boolean DEFAULT false, vegan_options boolean DEFAULT false,
  gluten_free_options boolean DEFAULT false, gluten_free_menu boolean DEFAULT false,
  dairy_free_options boolean DEFAULT false, nut_allergy_friendly boolean DEFAULT false,
  kids_menu boolean DEFAULT false, kids_eat_free text,
  full_bar boolean DEFAULT false, craft_beer boolean DEFAULT false,
  local_beer boolean DEFAULT false, wine_list boolean DEFAULT false,
  signature_cocktails boolean DEFAULT false, byob boolean DEFAULT false,
  corkage_fee text, happy_hour boolean DEFAULT false,
  happy_hour_schedule text, happy_hour_deals text,
  service_style text, avg_check_per_person text,
  takeout boolean DEFAULT false, delivery boolean DEFAULT false,
  delivery_apps text[], catering boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- menu_subcategories
CREATE TABLE IF NOT EXISTS menu_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  category_id uuid REFERENCES menu_categories(id) ON DELETE CASCADE,
  name text NOT NULL, description text, sort_order integer DEFAULT 0,
  active boolean DEFAULT true, created_at timestamptz DEFAULT now()
);

-- messaging_settings
CREATE TABLE IF NOT EXISTS messaging_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid UNIQUE REFERENCES entity(id) ON DELETE CASCADE,
  owner_phone text, customer_phone text, notification_phone text,
  customer_booking_template text, owner_booking_template text,
  photo_gallery_enabled boolean DEFAULT false, photo_gallery_section text,
  voice_ai_enabled boolean DEFAULT false, voice_greeting text,
  notify_customer_on_booking boolean DEFAULT true,
  notify_owner_on_booking boolean DEFAULT true,
  notify_customer_on_cancel boolean DEFAULT true,
  notify_owner_on_cancel boolean DEFAULT true,
  notification_email text, updated_at timestamptz DEFAULT now()
);

-- money_saving_tips
CREATE TABLE IF NOT EXISTS money_saving_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  area text, tip text, saves_amount text,
  valid_days text[], valid_times text, active boolean DEFAULT true
);

-- neighborhoods
CREATE TABLE IF NOT EXISTS neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, area text, description text,
  walkable boolean DEFAULT false, best_for text[],
  parking_note text, lat numeric, lng numeric, radius_miles numeric
);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  type text, title text, body text,
  metadata jsonb DEFAULT '{}', read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  items jsonb DEFAULT '[]', subtotal numeric, tax numeric, total numeric,
  status text DEFAULT 'pending', payment_id text, payment_provider text,
  pickup_time timestamptz, order_type text, notes text,
  customer_name text, customer_phone text, customer_email text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- packages
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text NOT NULL, description text, price numeric,
  price_label text, duration_minutes integer,
  whats_included text[], min_guests integer, max_guests integer,
  booking_url text, advance_hours integer DEFAULT 0,
  active boolean DEFAULT true, sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- page_views
CREATE TABLE IF NOT EXISTS page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  page_path text, page_title text, referrer text,
  utm_source text, utm_medium text, utm_campaign text,
  device_type text, browser text, os text,
  country text, city text, region text,
  session_id text, duration_seconds integer,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_views_entity ON page_views(entity_id);
CREATE INDEX IF NOT EXISTS idx_page_views_date ON page_views(created_at);

-- photos
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  url text, caption text, category text,
  featured boolean DEFAULT false, sort_order integer DEFAULT 0,
  uploaded_by text, created_at timestamptz DEFAULT now()
);

-- platform_settings
CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb DEFAULT '{}', updated_at timestamptz DEFAULT now()
);

-- price_guide
CREATE TABLE IF NOT EXISTS price_guide (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  item_name text, price numeric, price_label text,
  category text, note text, active boolean DEFAULT true
);

-- qa_pairs
CREATE TABLE IF NOT EXISTS qa_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  question text, answer text, category text,
  confidence numeric DEFAULT 1.0, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- review_questions
CREATE TABLE IF NOT EXISTS review_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  question_text text NOT NULL, question_type text DEFAULT 'stars',
  display_order integer DEFAULT 0, enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- review_answers
CREATE TABLE IF NOT EXISTS review_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES gcr_reviews(id) ON DELETE CASCADE,
  question_id uuid REFERENCES review_questions(id) ON DELETE CASCADE,
  answer text, created_at timestamptz DEFAULT now()
);

-- room_types
CREATE TABLE IF NOT EXISTS room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text NOT NULL, description text,
  price_per_night numeric, price_weekend numeric, price_peak numeric,
  max_guests integer, beds text, sqft integer,
  floor text, view text, amenities text[],
  image_url text, booking_url text,
  active boolean DEFAULT true, sort_order integer DEFAULT 0
);

-- search_intents
CREATE TABLE IF NOT EXISTS search_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES tourists(id) ON DELETE SET NULL,
  raw_query text, intent text,
  wants_happy_hour boolean DEFAULT false, wants_live_music boolean DEFAULT false,
  wants_gluten_free boolean DEFAULT false, wants_vegan boolean DEFAULT false,
  wants_outdoor boolean DEFAULT false, wants_waterfront boolean DEFAULT false,
  wants_pet_friendly boolean DEFAULT false, wants_kid_friendly boolean DEFAULT false,
  wants_open_now boolean DEFAULT false, requested_time time,
  requested_day text, resolved_day text, resolved_date date,
  budget_level text, party_size integer, cuisine_requested text,
  filters_extracted jsonb DEFAULT '{}', results_returned integer DEFAULT 0,
  top_result_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  tourist_chose uuid REFERENCES entity(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- seasonal_info
CREATE TABLE IF NOT EXISTS seasonal_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  season text, note text, best_months text[],
  crowd_level text, price_level text, special_hours text
);

-- seo_keywords
CREATE TABLE IF NOT EXISTS seo_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  keyword text, search_volume integer, difficulty_score integer,
  current_ranking integer, target_url text,
  tracked_since timestamptz, last_checked_at timestamptz,
  ranking_history jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- seo_meta_tags
CREATE TABLE IF NOT EXISTS seo_meta_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  page_slug text, page_title text, meta_description text,
  meta_keywords text, og_title text, og_description text,
  og_image text, og_type text, twitter_card text,
  twitter_title text, twitter_description text, twitter_image text,
  canonical_url text, robots text, schema_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- session_events
CREATE TABLE IF NOT EXISTS session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  session_id text, event_type text, event_label text,
  metadata jsonb DEFAULT '{}', page_path text,
  duration_ms integer, device_type text,
  created_at timestamptz DEFAULT now()
);

-- site_pages
CREATE TABLE IF NOT EXISTS site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  slug text, title text, html_content text,
  page_type text, visible boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- sms_campaigns
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  audience text, message text, coupon_code text,
  recipient_count integer DEFAULT 0, sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0, status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- sms_log
CREATE TABLE IF NOT EXISTS sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  to_phone text, message text, type text,
  status text DEFAULT 'sent', related_id uuid,
  metadata jsonb DEFAULT '{}', created_at timestamptz DEFAULT now()
);

-- sms_opt_outs
CREATE TABLE IF NOT EXISTS sms_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL, entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  opted_out_at timestamptz DEFAULT now()
);

-- social_media_accounts
CREATE TABLE IF NOT EXISTS social_media_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  platform text NOT NULL, account_name text, account_id text,
  account_url text, access_token text, refresh_token text,
  token_expires_at timestamptz, page_id text, page_access_token text,
  is_connected boolean DEFAULT false, last_sync_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_entity_platform ON social_media_accounts(entity_id, platform);

-- social_media_analytics
CREATE TABLE IF NOT EXISTS social_media_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  platform text, date date, followers integer,
  posts_count integer, likes integer, comments integer,
  shares integer, reach integer, impressions integer,
  engagement_rate numeric, clicks integer,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- social_media_posts
CREATE TABLE IF NOT EXISTS social_media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  post_text text, media_urls text[], platforms text[],
  status text DEFAULT 'draft', scheduled_for timestamptz,
  published_at timestamptz, post_ids jsonb DEFAULT '{}',
  error_message text, engagement_stats jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- song_requests
CREATE TABLE IF NOT EXISTS song_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid REFERENCES artists(id) ON DELETE CASCADE,
  show_id uuid REFERENCES artist_shows(id) ON DELETE SET NULL,
  song_name text, requester_name text,
  tip_amount numeric DEFAULT 0, tip_method text, tip_handle text,
  position integer DEFAULT 0, status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- staff
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text NOT NULL, role text, bio text, photo_url text,
  phone text, email text, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- transportation
CREATE TABLE IF NOT EXISTS transportation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text, name text, description text,
  coverage_area text, price_estimate text,
  contact text, website text, tip text, active boolean DEFAULT true
);

-- waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  customer_name text, customer_email text, customer_phone text,
  preferred_date date, preferred_slot text,
  party_size integer DEFAULT 1, status text DEFAULT 'waiting',
  notified_at timestamptz, notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- waitlist_settings
CREATE TABLE IF NOT EXISTS waitlist_settings (
  entity_id uuid PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false, max_size integer DEFAULT 50,
  auto_notify boolean DEFAULT true, sms_message text,
  updated_at timestamptz DEFAULT now()
);

-- ====== ARTISTS + FEED + TOURIST + LOYALTY ======
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

-- ====== AI CONCIERGE TABLES ======
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

-- ====== ADDITIONAL SCHEMA FIELDS ======
-- ============================================
-- ADDITIONAL TABLES (run in Supabase SQL Editor)
-- These tables are needed by the API routes
-- ============================================

-- Add password_hash and reset fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;

-- ============================================
-- REVIEWS
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    text TEXT,
    photos JSONB DEFAULT '[]',
    booking_id UUID REFERENCES bookings(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, published, rejected
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_site ON reviews(site_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(site_id, status);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON reviews FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "public_read" ON reviews FOR SELECT USING (status = 'published');
CREATE POLICY "public_insert" ON reviews FOR INSERT WITH CHECK (true);

-- ============================================
-- FAQS
-- ============================================
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_site ON faqs(site_id);
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON faqs FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "public_read" ON faqs FOR SELECT USING (true);

-- ============================================
-- COUPONS
-- ============================================
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- percentage, fixed
    amount DECIMAL(10,2) NOT NULL,
    min_order DECIMAL(10,2) DEFAULT 0,
    max_uses INT,
    uses_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_site ON coupons(site_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(site_id, code);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON coupons FOR ALL USING (site_id = auth.site_id());

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- booking, payment, review, message, system, contact_form, sms_received
    title VARCHAR(255) NOT NULL,
    body TEXT,
    metadata JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_site ON notifications(site_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(site_id, read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON notifications FOR ALL USING (site_id = auth.site_id());

-- ============================================
-- ACTIVITY LOG (per business)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- booking.created, review.submitted, profile.updated, etc.
    entity_type VARCHAR(50), -- booking, review, customer, service, etc.
    entity_id UUID,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_site ON activity_log(site_id);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON activity_log FOR ALL USING (site_id = auth.site_id());

-- ============================================
-- AUDIT LOG (admin actions — platform-wide)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- impersonate, suspend, create_business, etc.
    target_type VARCHAR(50), -- business, user, app, template
    target_id TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(admin_id);

-- ============================================
-- TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(50), -- general, restaurant, salon, service, rental, retail
    description TEXT,
    thumbnail_url TEXT,
    html_content TEXT,
    css_content TEXT,
    js_content TEXT,
    price DECIMAL(10,2) DEFAULT 0, -- 0 = free
    status VARCHAR(20) DEFAULT 'active', -- active, draft, disabled
    usage_count INT DEFAULT 0,
    template_type VARCHAR(20) DEFAULT 'website', -- website, linktree
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUPPORT TICKETS
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high
    status VARCHAR(20) DEFAULT 'open', -- open, in_progress, resolved, closed
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_site ON support_tickets(site_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON support_tickets FOR ALL USING (site_id = auth.site_id());

-- ============================================
-- HELPER FUNCTION: Increment customer bookings
-- ============================================
CREATE OR REPLACE FUNCTION increment_customer_bookings(customer_uuid UUID, amount DECIMAL)
RETURNS void AS $$
BEGIN
    UPDATE customers
    SET total_bookings = total_bookings + 1,
        total_spent = total_spent + amount,
        last_visit = NOW(),
        updated_at = NOW()
    WHERE id = customer_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Increment customer orders
-- ============================================
CREATE OR REPLACE FUNCTION increment_customer_orders(customer_uuid UUID, amount DECIMAL)
RETURNS void AS $$
BEGIN
    UPDATE customers
    SET total_orders = total_orders + 1,
        total_spent = total_spent + amount,
        last_visit = NOW(),
        updated_at = NOW()
    WHERE id = customer_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SMS & MESSAGING (run in Supabase SQL Editor)
-- ============================================

-- Messaging settings per business (templates, toggles)
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS messaging_settings JSONB DEFAULT '{}';

-- SMS opt-out tracking (TCPA compliance)
CREATE TABLE IF NOT EXISTS sms_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    site_id UUID REFERENCES businesses(site_id),
    opted_out_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phone, site_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_phone ON sms_opt_outs(phone);

-- SMS campaigns
CREATE TABLE IF NOT EXISTS sms_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    audience VARCHAR(50),
    message TEXT NOT NULL,
    coupon_code VARCHAR(50),
    recipient_count INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_site ON sms_campaigns(site_id);

-- Add metadata column to sms_log if not present
ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================
-- BOOKING HOLDS (temporary reservation during checkout)
-- ============================================

CREATE TABLE IF NOT EXISTS booking_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID NOT NULL,
    time_slot_id UUID NOT NULL,
    booking_date DATE NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    session_id VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_holds_lookup
    ON booking_holds(site_id, fleet_type_id, time_slot_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_booking_holds_expiry ON booking_holds(expires_at);

-- ============================================
-- ATOMIC BOOKING FUNCTION (prevents overbooking)
-- Checks availability + inserts in a single transaction with row locking
-- ============================================
CREATE OR REPLACE FUNCTION create_booking_if_available(
    p_site_id UUID,
    p_fleet_type_id UUID,
    p_time_slot_id UUID,
    p_booking_date DATE,
    p_qty INT,
    p_service_id UUID DEFAULT NULL,
    p_booking_time TEXT DEFAULT NULL,
    p_party_size INT DEFAULT 1,
    p_addons JSONB DEFAULT '[]',
    p_subtotal DECIMAL DEFAULT 0,
    p_tax DECIMAL DEFAULT 0,
    p_total DECIMAL DEFAULT 0,
    p_customer_id UUID DEFAULT NULL,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_customer_email TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_hold_session_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total_inventory INT;
    v_booked INT;
    v_held INT;
    v_available INT;
    v_booking_id UUID;
    v_result JSONB;
BEGIN
    -- Count total inventory (good-condition fleet items) with advisory lock
    SELECT COUNT(*) INTO v_total_inventory
    FROM fleet_items
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND condition = 'good';

    -- Aggregate booked qty for this slot
    SELECT COALESCE(SUM(qty), 0) INTO v_booked
    FROM bookings
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND status IN ('pending', 'confirmed', 'checked_in');

    -- Count active holds (exclude this session's hold if converting)
    SELECT COALESCE(SUM(qty), 0) INTO v_held
    FROM booking_holds
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND expires_at > NOW()
      AND (p_hold_session_id IS NULL OR session_id != p_hold_session_id);

    v_available := v_total_inventory - v_booked - v_held;

    -- Check if enough inventory
    IF v_available < p_qty THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not enough availability. Only ' || v_available || ' unit(s) remaining.',
            'available', v_available,
            'requested', p_qty
        );
    END IF;

    -- Insert the booking
    INSERT INTO bookings (
        site_id, fleet_type_id, service_id, time_slot_id, booking_date,
        booking_time, qty, party_size, addons, subtotal, tax, total,
        customer_id, customer_name, customer_phone, customer_email,
        notes, status, payment_status
    ) VALUES (
        p_site_id, p_fleet_type_id, p_service_id, p_time_slot_id, p_booking_date,
        p_booking_time, p_qty, p_party_size, p_addons, p_subtotal, p_tax, p_total,
        p_customer_id, p_customer_name, p_customer_phone, p_customer_email,
        p_notes, 'pending', 'unpaid'
    )
    RETURNING id INTO v_booking_id;

    -- Delete the hold if converting from a hold
    IF p_hold_session_id IS NOT NULL THEN
        DELETE FROM booking_holds
        WHERE session_id = p_hold_session_id
          AND site_id = p_site_id;
    END IF;

    -- Return success with the booking id
    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'available_after', v_available - p_qty
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HOLD CREATION FUNCTION (reserves slot during checkout)
-- ============================================
CREATE OR REPLACE FUNCTION create_booking_hold(
    p_site_id UUID,
    p_fleet_type_id UUID,
    p_time_slot_id UUID,
    p_booking_date DATE,
    p_qty INT,
    p_session_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_total_inventory INT;
    v_booked INT;
    v_held INT;
    v_available INT;
    v_hold_id UUID;
BEGIN
    -- Clean up expired holds first
    DELETE FROM booking_holds WHERE expires_at < NOW();

    -- Count total inventory
    SELECT COUNT(*) INTO v_total_inventory
    FROM fleet_items
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND condition = 'good';

    -- Aggregate booked qty for this slot
    SELECT COALESCE(SUM(qty), 0) INTO v_booked
    FROM bookings
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND status IN ('pending', 'confirmed', 'checked_in');

    -- Count existing holds (exclude this session to allow re-hold)
    SELECT COALESCE(SUM(qty), 0) INTO v_held
    FROM booking_holds
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND expires_at > NOW()
      AND session_id != p_session_id;

    v_available := v_total_inventory - v_booked - v_held;

    IF v_available < p_qty THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not enough availability. Only ' || v_available || ' unit(s) remaining.',
            'available', v_available
        );
    END IF;

    -- Remove any existing hold for this session
    DELETE FROM booking_holds
    WHERE session_id = p_session_id AND site_id = p_site_id;

    -- Create the hold
    INSERT INTO booking_holds (site_id, fleet_type_id, time_slot_id, booking_date, qty, session_id)
    VALUES (p_site_id, p_fleet_type_id, p_time_slot_id, p_booking_date, p_qty, p_session_id)
    RETURNING id INTO v_hold_id;

    RETURN jsonb_build_object(
        'success', true,
        'hold_id', v_hold_id,
        'expires_in_seconds', 600,
        'available_after', v_available - p_qty
    );
END;
$$ LANGUAGE plpgsql;
