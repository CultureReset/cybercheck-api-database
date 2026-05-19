-- ============================================
-- TRACKING TABLES — Run in Supabase SQL Editor
-- Project: xbptmkpbiqzvxptjkfoi
-- ============================================

-- Every swipe a tourist makes (like / nope / super)
CREATE TABLE IF NOT EXISTS tourist_swipe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_slug TEXT NOT NULL,
  business_name TEXT,
  category TEXT,
  direction TEXT NOT NULL, -- 'like' | 'nope' | 'super'
  swiped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tse_user ON tourist_swipe_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tse_slug ON tourist_swipe_events(entity_slug);
CREATE INDEX IF NOT EXISTS idx_tse_dir ON tourist_swipe_events(direction);
CREATE INDEX IF NOT EXISTS idx_tse_swiped_at ON tourist_swipe_events(swiped_at);

-- ============================================
-- Per-tourist preference scores per tag
-- Score: like=+3, super=+10, nope=-2
-- Clamped between -50 and 200
-- ============================================

CREATE TABLE IF NOT EXISTS user_preference_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id UUID NOT NULL,
  tag TEXT NOT NULL,
  score INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tourist_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_ups_tourist ON user_preference_scores(tourist_id);
CREATE INDEX IF NOT EXISTS idx_ups_score ON user_preference_scores(score DESC);

-- ============================================
-- RPC used by the API to upsert scores atomically
-- ============================================

CREATE OR REPLACE FUNCTION upsert_preference_score(
  p_tourist_id UUID,
  p_tag TEXT,
  p_delta INT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_preference_scores (tourist_id, tag, score, updated_at)
  VALUES (p_tourist_id, p_tag, GREATEST(-50, LEAST(200, p_delta)), NOW())
  ON CONFLICT (tourist_id, tag)
  DO UPDATE SET
    score = GREATEST(-50, LEAST(200, user_preference_scores.score + p_delta)),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Also make sure tourist_profiles has phone column
-- (for cross-platform tracking via phone login)
-- ============================================

ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS sms_opted_in_at TIMESTAMPTZ;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS otp_code TEXT;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMPTZ;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS arrival DATE;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS departure DATE;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS trip_days INT;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS group_type TEXT;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS budget TEXT;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS hotel_name TEXT;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS interests TEXT[];
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS stay_status TEXT;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS answers JSONB;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ;
ALTER TABLE tourist_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_tourist_profiles_phone ON tourist_profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tourist_profiles_user_id ON tourist_profiles(user_id);

-- ============================================
-- Make sure tourist_saves has all columns
-- ============================================

ALTER TABLE tourist_saves ADD COLUMN IF NOT EXISTS hero_image_url TEXT;
ALTER TABLE tourist_saves ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE tourist_saves ADD COLUMN IF NOT EXISTS rating DECIMAL(3,1);
ALTER TABLE tourist_saves ADD COLUMN IF NOT EXISTS is_super_like BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tourist_saves_user_slug ON tourist_saves(user_id, entity_slug);
CREATE INDEX IF NOT EXISTS idx_tourist_saves_slug ON tourist_saves(entity_slug);
