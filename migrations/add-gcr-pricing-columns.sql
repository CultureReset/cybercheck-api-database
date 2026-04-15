-- ============================================================
-- GCR: Add pricing columns to entity table
-- Run this in the GCR Supabase SQL Editor
-- ============================================================

-- Starting price (for Things To Do, Public Spots, Services, etc.)
-- Examples: price_from=45 price_unit='person' → "From $45/person"
--           price_from=0                      → "Free"
--           price_from=5  price_unit='day'    → "From $5/day"
ALTER TABLE entity ADD COLUMN IF NOT EXISTS price_from NUMERIC(10,2);
ALTER TABLE entity ADD COLUMN IF NOT EXISTS price_to   NUMERIC(10,2);   -- optional max (for ranges like $45–$120)
ALTER TABLE entity ADD COLUMN IF NOT EXISTS price_unit VARCHAR(50);     -- person | hour | boat | group | day | vehicle | entry

-- Index for filtering by price (e.g. budget activities)
CREATE INDEX IF NOT EXISTS idx_entity_price_from ON entity(price_from) WHERE price_from IS NOT NULL;
