-- Add metadata JSONB column to businesses table
-- Used for qr_theme storage and other per-business config
-- Run in Supabase SQL Editor (CyberCheck project: mhafixflyffflwjhcgfn)

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
