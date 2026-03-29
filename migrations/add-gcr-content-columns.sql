-- ============================================
-- GCR: Add missing columns + business_media table
-- Run this in Supabase SQL Editor
-- ============================================

-- site_content: GCR-specific columns
ALTER TABLE site_content
  ADD COLUMN IF NOT EXISTS google_maps      TEXT,
  ADD COLUMN IF NOT EXISTS book_a_bay       JSONB,
  ADD COLUMN IF NOT EXISTS league           JSONB,
  ADD COLUMN IF NOT EXISTS games            JSONB,
  ADD COLUMN IF NOT EXISTS packages         JSONB,
  ADD COLUMN IF NOT EXISTS faq              JSONB,
  ADD COLUMN IF NOT EXISTS custom_sections  JSONB;
  -- custom_sections format:
  -- [{ id, label, icon, render: "list|cards|text|gallery", data: [...] }]

-- menu_items: food vs drink type
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS item_type  TEXT DEFAULT 'food';

-- events: time field
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_time  TEXT;

-- reviews: active flag
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS active  BOOLEAN DEFAULT TRUE;

-- business_media table (photos/gallery for GCR businesses)
CREATE TABLE IF NOT EXISTS business_media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  caption     TEXT DEFAULT '',
  section     TEXT DEFAULT 'gallery',   -- 'cover', 'gallery', 'menu', etc.
  sort_order  INTEGER DEFAULT 0,
  linked_id   UUID,                     -- optional: link to fleet/event/etc
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_media_site_id ON business_media(site_id);
