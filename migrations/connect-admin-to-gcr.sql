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
