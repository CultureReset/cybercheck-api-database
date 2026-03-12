-- ============================================================
-- Migration 12: Add GCR display fields to businesses table
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS emoji          VARCHAR(10)  DEFAULT '🏪',
  ADD COLUMN IF NOT EXISTS tagline        TEXT,
  ADD COLUMN IF NOT EXISTS featured       BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags           TEXT[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS price_range    VARCHAR(5),     -- $, $$, $$$, $$$$
  ADD COLUMN IF NOT EXISTS rating         DECIMAL(3,1),
  ADD COLUMN IF NOT EXISTS review_count   INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS happy_hour     TEXT,           -- e.g. "Daily 3–5pm"
  ADD COLUMN IF NOT EXISTS kids_friendly  BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS pet_friendly   BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_music     BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS outdoor        BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS reservations   BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS alcohol        BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_required BOOLEAN    DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery       BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS takeout        BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order     INTEGER      DEFAULT 0;

-- Index for GCR queries
CREATE INDEX IF NOT EXISTS idx_businesses_gcr ON businesses(gcr_listed, featured, type);
CREATE INDEX IF NOT EXISTS idx_businesses_featured ON businesses(featured) WHERE featured = true;
