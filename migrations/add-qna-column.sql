-- Add Q&A/FAQ column to site_content table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS qna JSONB DEFAULT '[]'::jsonb;
