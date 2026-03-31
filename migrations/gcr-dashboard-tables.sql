--- =============================================
-- GCR Dashboard Tables
-- Run in GCR Supabase SQL Editor
-- These are NEW tables — does NOT touch CyberCheck main DB
-- =============================================

-- Sponsored + sort for entities (if not already added)
ALTER TABLE entity ADD COLUMN IF NOT EXISTS is_sponsored boolean DEFAULT false;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 999;

-- ── Analytics ──────────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  page_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  device_type text DEFAULT 'unknown',
  session_id text,
  visitor_id text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_pv_entity ON gcr_page_views(entity_id);
CREATE INDEX IF NOT EXISTS idx_gcr_pv_date ON gcr_page_views(created_at);

CREATE TABLE IF NOT EXISTS gcr_conversions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  conversion_type text DEFAULT 'click', -- click, call, directions, booking, website
  value numeric DEFAULT 0,
  source text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_conv_entity ON gcr_conversions(entity_id);

-- ── Reviews ────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  customer_name text,
  customer_email text,
  customer_phone text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  review_method text DEFAULT 'text', -- text, voice
  photos jsonb DEFAULT '[]',
  guest_feedback jsonb DEFAULT '[]',
  status text DEFAULT 'pending', -- pending, approved, published
  source text DEFAULT 'gcr', -- gcr, google, yelp, tripadvisor
  token text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_reviews_entity ON gcr_reviews(entity_id);
CREATE INDEX IF NOT EXISTS idx_gcr_reviews_status ON gcr_reviews(status);

CREATE TABLE IF NOT EXISTS gcr_review_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text DEFAULT 'stars', -- stars, yesno, text
  display_order integer DEFAULT 0,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── Customers / CRM ───────────────────────────
CREATE TABLE IF NOT EXISTS gcr_customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  status text DEFAULT 'customer', -- lead, customer, vip, inactive
  tier text DEFAULT 'standard',
  total_visits integer DEFAULT 0,
  total_spent numeric DEFAULT 0,
  last_visit timestamptz,
  notes text,
  tags jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_cust_entity ON gcr_customers(entity_id);
CREATE INDEX IF NOT EXISTS idx_gcr_cust_email ON gcr_customers(email);

-- ── Staff / Team ──────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_staff (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  bio text,
  photo_url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Media Library ─────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  url text NOT NULL,
  filename text,
  alt_text text,
  file_size integer,
  file_type text,
  folder text DEFAULT 'general', -- general, gallery, reviews, menu
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_media_entity ON gcr_media(entity_id);

-- ── FAQs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_faqs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ── Social Media Connections ──────────────────
CREATE TABLE IF NOT EXISTS gcr_social_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  platform text NOT NULL, -- facebook, instagram, tiktok, twitter, youtube, google_business
  account_name text,
  account_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  is_connected boolean DEFAULT false,
  connected_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gcr_social_unique ON gcr_social_accounts(entity_id, platform);

CREATE TABLE IF NOT EXISTS gcr_social_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  platform text NOT NULL,
  content text,
  image_url text,
  status text DEFAULT 'draft', -- draft, scheduled, published, failed
  scheduled_at timestamptz,
  published_at timestamptz,
  engagement jsonb DEFAULT '{}', -- likes, shares, comments
  created_at timestamptz DEFAULT now()
);

-- ── OAuth Connections (Stripe, Google, etc.) ──
CREATE TABLE IF NOT EXISTS gcr_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  provider text NOT NULL, -- stripe, square, paypal, google_business, google_analytics
  account_name text,
  account_id text,
  credentials jsonb DEFAULT '{}',
  status text DEFAULT 'connected',
  connected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gcr_conn_unique ON gcr_connections(entity_id, provider);

-- ── SMS / Messaging ───────────────────────────
CREATE TABLE IF NOT EXISTS gcr_messaging_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE UNIQUE,
  owner_phone text,
  customer_phone text,
  notification_email text,
  booking_sms_template text,
  review_sms_template text,
  notify_on_booking boolean DEFAULT true,
  notify_on_review boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gcr_sms_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  to_number text,
  from_number text,
  message text,
  direction text DEFAULT 'outbound', -- outbound, inbound
  status text DEFAULT 'sent',
  twilio_sid text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_sms_entity ON gcr_sms_log(entity_id);

-- ── Coupons / Promo Codes ─────────────────────
CREATE TABLE IF NOT EXISTS gcr_coupons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  code text NOT NULL,
  type text DEFAULT 'percentage', -- percentage, fixed
  amount numeric NOT NULL,
  min_order numeric DEFAULT 0,
  max_uses integer,
  uses_count integer DEFAULT 0,
  description text,
  active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ── Waitlist ──────────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  customer_name text,
  customer_email text,
  customer_phone text,
  preferred_date date,
  party_size integer DEFAULT 1,
  notes text,
  status text DEFAULT 'waiting', -- waiting, notified, booked, removed
  notified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ── SEO Settings ──────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_seo_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE UNIQUE,
  seo_title text,
  seo_description text,
  seo_keywords text,
  og_image text,
  ga4_id text,
  facebook_pixel_id text,
  canonical_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── Activity Log ──────────────────────────────
CREATE TABLE IF NOT EXISTS gcr_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  action text NOT NULL, -- created, updated, deleted, published, sponsored
  entity_type text, -- entity, review, event, special, section
  description text,
  user_id text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gcr_activity_date ON gcr_activity_log(created_at);

-- ── RLS Policies (allow service role full access) ──
-- These tables use service_role key from the API, so no RLS restrictions needed.
-- If you want public read access for some tables, add policies later.
