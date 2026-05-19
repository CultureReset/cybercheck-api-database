-- ============================================================================
-- TRIP SWIPE ADMIN SETUP - FIXED VERSION
-- Creates admin tables WITHOUT foreign key constraints
-- (Run in Supabase SQL Editor)
-- ============================================================================

-- 1. TRIP SWIPE BUSINESS SETTINGS
CREATE TABLE IF NOT EXISTS tripswipe_business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT,
  slug TEXT UNIQUE,
  enabled BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  hero_image TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tripswipe_settings_slug ON tripswipe_business_settings(slug);

-- 2. TRIP SWIPE SPONSORED CARDS
CREATE TABLE IF NOT EXISTS tripswipe_sponsored (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT,
  priority INT DEFAULT 0,
  badge_text TEXT DEFAULT '⭐ Featured',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tripswipe_sponsored_priority ON tripswipe_sponsored(priority);

-- 3. TRIP SWIPE PROMO CARDS
CREATE TABLE IF NOT EXISTS tripswipe_promo_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  badge_text TEXT DEFAULT '🚨 Limited Time',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tripswipe_promo_expires ON tripswipe_promo_cards(expires_at);

-- 4. SMS BLASTS HISTORY
CREATE TABLE IF NOT EXISTS sms_blasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  audience TEXT,
  sent_to INT DEFAULT 0,
  sent_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_blasts_sent_at ON sms_blasts(sent_at);

-- 5. BUSINESS LEADS
CREATE TABLE IF NOT EXISTS business_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  category TEXT,
  status TEXT DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_leads_status ON business_leads(status);

-- 6. PLATFORM SETTINGS
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);

-- 7. TOURIST PROFILES
CREATE TABLE IF NOT EXISTS tourist_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  name TEXT,
  destination TEXT,
  travel_dates_from DATE,
  travel_dates_to DATE,
  setup_complete BOOLEAN DEFAULT false,
  sms_opt_in BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tourist_profiles_email ON tourist_profiles(email);

-- 8. TOURIST PREFERENCES
CREATE TABLE IF NOT EXISTS tourist_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES tourist_profiles(id) ON DELETE CASCADE,
  category TEXT,
  score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tourist_preferences_user ON tourist_preferences(user_id);

-- 9. TOURIST SAVES
CREATE TABLE IF NOT EXISTS tourist_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES tourist_profiles(id) ON DELETE CASCADE,
  entity_id TEXT,
  is_super_like BOOLEAN DEFAULT false,
  saved_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tourist_saves_user ON tourist_saves(user_id);

-- 10. TOURIST PHOTOS
CREATE TABLE IF NOT EXISTS tourist_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES tourist_profiles(id) ON DELETE CASCADE,
  entity_slug TEXT,
  image_url TEXT NOT NULL,
  caption TEXT,
  uploader_name TEXT,
  category TEXT,
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMP DEFAULT now(),
  reviewed_at TIMESTAMP,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_tourist_photos_entity ON tourist_photos(entity_slug);
CREATE INDEX IF NOT EXISTS idx_tourist_photos_status ON tourist_photos(status);

-- 11. ITEM SWIPES (tracking user swipes on items)
CREATE TABLE IF NOT EXISTS item_swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  section_item_id TEXT,
  entity_id TEXT,
  action TEXT CHECK (action IN ('right', 'left', 'save')),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_item_swipes_user ON item_swipes(user_id);
CREATE INDEX IF NOT EXISTS idx_item_swipes_entity ON item_swipes(entity_id);

-- Done! All tables created without foreign key issues.
