-- Run this in your GCR Supabase SQL editor
-- Creates the gcr_ads table and adds is_free_tier to entity

-- 1. Ad network table
CREATE TABLE IF NOT EXISTS gcr_ads (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name      text NOT NULL,
  tagline              text,
  image_url            text,
  logo_url             text,
  badge_text           text,
  cta_text             text DEFAULT 'Learn More',
  cta_url              text,
  is_active            boolean DEFAULT true,
  weight               integer DEFAULT 1,  -- higher = shows more often
  impressions          integer DEFAULT 0,
  clicks               integer DEFAULT 0,
  created_at           timestamptz DEFAULT now()
);

-- 2. Free-tier flag on entity (default true = all existing entities start on free tier)
ALTER TABLE entity ADD COLUMN IF NOT EXISTS is_free_tier boolean DEFAULT true;

-- 3. Index for active ad queries
CREATE INDEX IF NOT EXISTS gcr_ads_active_idx ON gcr_ads (is_active, weight DESC);

-- 4. Optional: mark any existing sponsored/paid entities as not free tier
-- UPDATE entity SET is_free_tier = false WHERE is_sponsored = true;
