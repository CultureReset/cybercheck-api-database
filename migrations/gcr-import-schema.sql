-- ============================================================
-- GCR Import Schema Migration
-- Run this in the GCR Supabase SQL editor
-- URL: adpnhipmdefutkzzltbs.supabase.co
-- ============================================================

-- ============================================================
-- STEP 1: Add missing columns to existing entity table
-- ============================================================
ALTER TABLE entity ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS price_range text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS booking_url text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS reservation_url text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS order_url text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS hh_days text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS hh_start text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS hh_end text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS hh_description text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS social_instagram text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS social_facebook text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS social_tiktok text;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS email text;

-- ============================================================
-- STEP 2: New supporting tables
-- ============================================================

-- Hours per day of week
CREATE TABLE IF NOT EXISTS entity_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  day_of_week text NOT NULL,
  open_time text,
  close_time text,
  is_closed boolean DEFAULT false,
  UNIQUE(entity_id, day_of_week)
);

-- About section feature bullets (icon + text)
CREATE TABLE IF NOT EXISTS entity_about_bullets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  icon text,
  text text NOT NULL,
  sort_order int DEFAULT 0
);

-- Photos / gallery
CREATE TABLE IF NOT EXISTS entity_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order int DEFAULT 0,
  is_cover boolean DEFAULT false
);

-- ============================================================
-- STEP 3: Menu tables
-- ============================================================

CREATE TABLE IF NOT EXISTS menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  icon text,
  section_description text,
  section_note text,
  image_url text,
  available_days text,
  available_start text,
  available_end text,
  show_on_links_page boolean DEFAULT true,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_sub_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  menu_section_id uuid REFERENCES menu_sections(id) ON DELETE CASCADE,
  sub_section_name text NOT NULL,
  section_note text,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  menu_section_id uuid REFERENCES menu_sections(id) ON DELETE CASCADE,
  menu_sub_section_id uuid REFERENCES menu_sub_sections(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  description text,
  price numeric,
  price_text text,
  allergens text,
  is_available boolean DEFAULT true,
  image_url text,
  sort_order int DEFAULT 0
);

-- ============================================================
-- STEP 4: Drink tables
-- ============================================================

CREATE TABLE IF NOT EXISTS drink_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  section_note text,
  image_url text,
  available_days text,
  available_start text,
  available_end text,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS drink_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  drink_section_id uuid REFERENCES drink_sections(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  description text,
  price numeric,
  price_text text,
  item_style text,
  abv text,
  ibu text,
  brewery text,
  is_available boolean DEFAULT true,
  image_url text,
  sort_order int DEFAULT 0
);

-- ============================================================
-- STEP 5: Happy hour tables
-- ============================================================

CREATE TABLE IF NOT EXISTS happy_hour_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS happy_hour_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  hh_section_id uuid REFERENCES happy_hour_sections(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  description text,
  regular_price numeric,
  hh_price numeric,
  price_text text,
  image_url text,
  sort_order int DEFAULT 0
);

-- ============================================================
-- STEP 6: Events table (new — entity_id based)
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_type text,
  description text,
  artist_name text,
  artist_about text,
  music_style text,
  venue_location text,
  day_of_week text,
  event_date date,
  start_time text,
  end_time text,
  recurring boolean DEFAULT false,
  recurring_start_date date,
  recurring_end_date date,
  cover_charge text,
  image_url text,
  is_active boolean DEFAULT true
);

-- ============================================================
-- STEP 7: Specials table (new — entity_id based)
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_specials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  special_name text NOT NULL,
  description text,
  special_type text,
  days text,
  start_time text,
  end_time text,
  discount_text text,
  image_url text,
  is_active boolean DEFAULT true
);

-- ============================================================
-- STEP 8: Things To Do tables
-- ============================================================

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  activity_name text NOT NULL,
  activity_type text,
  description text,
  duration text,
  min_age int,
  max_capacity int,
  image_url text,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pricing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  package_name text NOT NULL,
  description text,
  price numeric,
  price_text text,
  price_unit text,
  time_slot_start text,
  time_slot_end text,
  available_days text,
  min_people int,
  max_people int,
  duration text,
  image_url text,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS booking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  slot_name text NOT NULL,
  start_time text,
  end_time text,
  available_days text,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fleet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  description text,
  capacity int,
  weight text,
  dimensions text,
  max_capacity_text text,
  image_url text,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  addon_name text NOT NULL,
  description text,
  price numeric,
  price_min numeric,
  price_max numeric,
  price_type text DEFAULT 'add_on',
  dimensions text,
  capacity_text text,
  image_url text,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS whats_included (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  description text,
  image_url text,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  requirement_text text NOT NULL,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  policy_type text,
  policy_text text NOT NULL,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS meeting_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  location_name text,
  address text,
  parking_info text,
  checkin_instructions text,
  what_to_bring text,
  image_url text,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entity_qna (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  section_label text,
  question text NOT NULL,
  answer text,
  sort_order int DEFAULT 0
);

-- ============================================================
-- STEP 9: Shopping tables
-- ============================================================

CREATE TABLE IF NOT EXISTS product_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  section_name text NOT NULL,
  available_days text,
  available_start text,
  available_end text,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_sub_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  product_section_id uuid REFERENCES product_sections(id) ON DELETE CASCADE,
  sub_section_name text NOT NULL,
  sort_order int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  product_section_id uuid REFERENCES product_sections(id) ON DELETE CASCADE,
  product_sub_section_id uuid REFERENCES product_sub_sections(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  description text,
  price numeric,
  price_max numeric,
  image_url text,
  is_available boolean DEFAULT true,
  sort_order int DEFAULT 0
);
