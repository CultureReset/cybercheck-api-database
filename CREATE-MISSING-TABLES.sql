-- ============================================
-- MISSING TABLES — Run in Supabase SQL Editor
-- Project: xbptmkpbiqzvxptjkfoi
-- ============================================

-- ============================================
-- MENUS
-- ============================================

CREATE TABLE IF NOT EXISTS menu_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  section_name VARCHAR(255),
  icon VARCHAR(100),
  section_description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_sub_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE CASCADE,
  menu_section_id UUID NOT NULL REFERENCES menu_sections(id) ON DELETE CASCADE,
  subsection_name VARCHAR(255),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DRINK MENU
-- ============================================

CREATE TABLE IF NOT EXISTS drink_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  section_name VARCHAR(255),
  section_note TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drink_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  drink_section_id UUID REFERENCES drink_sections(id) ON DELETE SET NULL,
  item_name VARCHAR(255),
  description TEXT,
  price DECIMAL(10,2),
  price_text VARCHAR(100),
  brewery VARCHAR(255),
  item_style VARCHAR(100),
  available BOOLEAN DEFAULT true,
  image_url TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HAPPY HOUR
-- ============================================

CREATE TABLE IF NOT EXISTS happy_hour_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  section_name VARCHAR(255),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS happy_hour_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE CASCADE,
  hh_section_id UUID NOT NULL REFERENCES happy_hour_sections(id) ON DELETE CASCADE,
  item_name VARCHAR(255),
  description TEXT,
  regular_price DECIMAL(10,2),
  hh_price DECIMAL(10,2),
  price_text VARCHAR(100),
  image_url TEXT,
  category VARCHAR(100),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR ADS
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE SET NULL,
  advertiser_name VARCHAR(255),
  tagline TEXT,
  image_url TEXT,
  logo_url TEXT,
  cta_text VARCHAR(100) DEFAULT 'Learn More',
  cta_url TEXT,
  badge_text VARCHAR(100),
  weight INT DEFAULT 1,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE SET NULL,
  page_path TEXT,
  page_title TEXT,
  referrer TEXT,
  session_id VARCHAR(255),
  visitor_id VARCHAR(255),
  utm_source VARCHAR(255),
  utm_medium VARCHAR(255),
  device_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gcr_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE SET NULL,
  conversion_type VARCHAR(100),
  source VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR REVIEWS
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE SET NULL,
  author_name VARCHAR(255),
  rating DECIMAL(3,1),
  review_text TEXT,
  source VARCHAR(100),
  is_approved BOOLEAN DEFAULT false,
  reply_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR CUSTOMERS
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE SET NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  total_visits INT DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  last_visit TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR COUPONS
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE SET NULL,
  code VARCHAR(100),
  title VARCHAR(255),
  description TEXT,
  discount_type VARCHAR(50),
  discount_value DECIMAL(10,2),
  min_purchase DECIMAL(10,2),
  max_uses INT,
  uses_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR SEO SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_seo_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID UNIQUE REFERENCES entity(id) ON DELETE CASCADE,
  seo_title VARCHAR(255),
  seo_description TEXT,
  seo_keywords TEXT,
  ga4_id VARCHAR(100),
  facebook_pixel_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR MESSAGING SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_messaging_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID UNIQUE REFERENCES entity(id) ON DELETE CASCADE,
  sms_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT false,
  phone VARCHAR(50),
  email VARCHAR(255),
  auto_reply_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR SITE CONFIG (global platform settings)
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name VARCHAR(255),
  site_tagline TEXT,
  logo_url TEXT,
  hero_image_url TEXT,
  primary_color VARCHAR(50),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  social_instagram TEXT,
  social_facebook TEXT,
  footer_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR SETTINGS (key/value store)
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR FAQS (per entity)
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  question TEXT,
  answer TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR SOCIAL ACCOUNTS
-- ============================================

CREATE TABLE IF NOT EXISTS gcr_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE CASCADE,
  platform VARCHAR(100),
  account_name VARCHAR(255),
  account_url TEXT,
  is_connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GCR CLAIMS (business claim requests)
-- ============================================

-- NOTE: gcr_claims already exists in live DB — skipping

-- ============================================
-- UPDATE LINKS (daily menu/specials update links)
-- ============================================

CREATE TABLE IF NOT EXISTS update_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  link_type VARCHAR(50) DEFAULT 'full',
  link_date DATE,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TOURIST / TRIP SWIPE
-- ============================================

CREATE TABLE IF NOT EXISTS tourist_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email VARCHAR(255),
  name VARCHAR(255),
  avatar_url TEXT,
  home_city VARCHAR(100),
  travel_style VARCHAR(100),
  setup_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tourist_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  tourist_profile_id UUID REFERENCES tourist_profiles(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entity(id) ON DELETE CASCADE,
  entity_slug VARCHAR(255),
  business_name VARCHAR(255),
  category VARCHAR(100),
  price_range VARCHAR(20),
  saved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tourist_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_profile_id UUID REFERENCES tourist_profiles(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entity(id) ON DELETE SET NULL,
  photo_url TEXT,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tripswipe_business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID UNIQUE REFERENCES entity(id) ON DELETE CASCADE,
  is_featured BOOLEAN DEFAULT false,
  sponsored BOOLEAN DEFAULT false,
  concierge_enabled BOOLEAN DEFAULT true,
  booking_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (for performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_menu_sections_entity ON menu_sections(entity_id);
CREATE INDEX IF NOT EXISTS idx_drink_sections_entity ON drink_sections(entity_id);
CREATE INDEX IF NOT EXISTS idx_drink_items_entity ON drink_items(entity_id);
CREATE INDEX IF NOT EXISTS idx_drink_items_section ON drink_items(drink_section_id);
CREATE INDEX IF NOT EXISTS idx_hh_sections_entity ON happy_hour_sections(entity_id);
CREATE INDEX IF NOT EXISTS idx_hh_items_section ON happy_hour_items(hh_section_id);
CREATE INDEX IF NOT EXISTS idx_gcr_page_views_entity ON gcr_page_views(entity_id);
CREATE INDEX IF NOT EXISTS idx_gcr_page_views_created ON gcr_page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_gcr_reviews_entity ON gcr_reviews(entity_id);
CREATE INDEX IF NOT EXISTS idx_gcr_customers_entity ON gcr_customers(entity_id);
CREATE INDEX IF NOT EXISTS idx_tourist_saves_user ON tourist_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_tourist_saves_entity ON tourist_saves(entity_id);
CREATE INDEX IF NOT EXISTS idx_update_links_token ON update_links(token);
CREATE INDEX IF NOT EXISTS idx_update_links_entity ON update_links(entity_id);
