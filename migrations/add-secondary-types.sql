-- ============================================================
-- GCR: Add secondary_types to entity — allows a business to
-- appear on multiple listing pages (e.g. restaurants + things-to-do)
-- Comma-separated page slugs: "restaurants,things-to-do"
-- Run this in the GCR Supabase SQL Editor
-- ============================================================

ALTER TABLE entity ADD COLUMN IF NOT EXISTS secondary_types TEXT;
