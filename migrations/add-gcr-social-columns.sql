-- ============================================
-- Add GCR social + metadata columns to businesses
-- Run this in Supabase SQL Editor
-- ============================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS instagram    TEXT,
  ADD COLUMN IF NOT EXISTS facebook     TEXT,
  ADD COLUMN IF NOT EXISTS tiktok       TEXT,
  ADD COLUMN IF NOT EXISTS gcr_listed   BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS featured     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rating       NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS price_range  TEXT,
  ADD COLUMN IF NOT EXISTS tags         TEXT[];
