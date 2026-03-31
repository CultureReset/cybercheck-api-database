-- Add sponsored flag and sort_order to entity table
-- Run this in Supabase SQL Editor

ALTER TABLE entity ADD COLUMN IF NOT EXISTS is_sponsored boolean DEFAULT false;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 999;

-- Sponsored entities always sort first, then by sort_order, then by name
COMMENT ON COLUMN entity.is_sponsored IS 'Sponsored businesses appear first in all listings';
COMMENT ON COLUMN entity.sort_order IS 'Lower numbers appear first (after sponsored)';
