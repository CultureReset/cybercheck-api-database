-- ============================================
-- Analytics, SEO, and Social Media Tables
-- ============================================

-- Page Views & Traffic Tracking
CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  device_type TEXT, -- 'mobile', 'desktop', 'tablet'
  browser TEXT,
  os TEXT,
  ip_address INET,
  country TEXT,
  city TEXT,
  region TEXT,
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_page_views_site_id ON page_views(site_id);
CREATE INDEX idx_page_views_created_at ON page_views(created_at);
CREATE INDEX idx_page_views_session_id ON page_views(session_id);
CREATE INDEX idx_page_views_utm_source ON page_views(utm_source);

-- Conversion Tracking
CREATE TABLE IF NOT EXISTS conversions (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  conversion_type TEXT NOT NULL, -- 'booking', 'contact', 'signup', 'purchase', 'custom'
  conversion_value DECIMAL(10,2) DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  customer_id UUID,
  customer_email TEXT,
  customer_name TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,
  session_id TEXT,
  booking_id UUID,
  metadata JSONB, -- Additional conversion data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversions_site_id ON conversions(site_id);
CREATE INDEX idx_conversions_created_at ON conversions(created_at);
CREATE INDEX idx_conversions_type ON conversions(conversion_type);
CREATE INDEX idx_conversions_session_id ON conversions(session_id);

-- Traffic Sources Summary (aggregated daily)
CREATE TABLE IF NOT EXISTS traffic_sources (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT NOT NULL, -- 'google', 'facebook', 'direct', 'referral', etc.
  medium TEXT, -- 'organic', 'cpc', 'social', 'email', etc.
  campaign TEXT,
  visitors INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  avg_session_duration INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, date, source, medium, campaign)
);

CREATE INDEX idx_traffic_sources_site_date ON traffic_sources(site_id, date);

-- SEO Meta Tags (per page)
CREATE TABLE IF NOT EXISTS seo_meta_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  page_slug TEXT NOT NULL, -- '/', '/about', '/contact', etc.
  page_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  og_type TEXT DEFAULT 'website',
  twitter_card TEXT DEFAULT 'summary_large_image',
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image TEXT,
  canonical_url TEXT,
  robots TEXT DEFAULT 'index, follow',
  schema_json JSONB, -- Schema.org structured data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, page_slug)
);

CREATE INDEX idx_seo_meta_site_id ON seo_meta_tags(site_id);

-- Sitemap Configuration
CREATE TABLE IF NOT EXISTS sitemap_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE UNIQUE,
  auto_generate BOOLEAN DEFAULT true,
  include_pages BOOLEAN DEFAULT true,
  include_blog BOOLEAN DEFAULT false,
  custom_urls JSONB, -- Array of custom URLs to include
  excluded_urls JSONB, -- Array of URLs to exclude
  change_frequency TEXT DEFAULT 'weekly', -- 'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'
  priority DECIMAL(2,1) DEFAULT 0.5,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social Media Accounts
CREATE TABLE IF NOT EXISTS social_media_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'facebook', 'instagram', 'twitter', 'tiktok', 'youtube'
  account_name TEXT,
  account_id TEXT,
  account_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  page_id TEXT, -- For Facebook pages
  page_access_token TEXT, -- For Facebook pages
  is_connected BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  metadata JSONB, -- Platform-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, platform)
);

CREATE INDEX idx_social_accounts_site_id ON social_media_accounts(site_id);

-- Social Media Posts
CREATE TABLE IF NOT EXISTS social_media_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  post_text TEXT NOT NULL,
  media_urls TEXT[], -- Array of image/video URLs
  platforms TEXT[] NOT NULL, -- ['facebook', 'instagram', 'twitter']
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  post_ids JSONB, -- Platform-specific post IDs after publishing
  error_message TEXT,
  engagement_stats JSONB, -- Likes, shares, comments per platform
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_posts_site_id ON social_media_posts(site_id);
CREATE INDEX idx_social_posts_status ON social_media_posts(status);
CREATE INDEX idx_social_posts_scheduled ON social_media_posts(scheduled_for);

-- Social Media Analytics (daily aggregates)
CREATE TABLE IF NOT EXISTS social_media_analytics (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  followers INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, platform, date)
);

CREATE INDEX idx_social_analytics_site_date ON social_media_analytics(site_id, date);

-- Attribution Tracking (how customers found you)
CREATE TABLE IF NOT EXISTS attribution_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID,
  referral_source TEXT, -- 'google', 'facebook', 'instagram', 'friend', 'repeat', 'other'
  referral_details TEXT, -- Additional details about referral
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  first_touch_source TEXT, -- First time they visited
  first_touch_date TIMESTAMPTZ,
  last_touch_source TEXT, -- Right before conversion
  last_touch_date TIMESTAMPTZ,
  total_sessions INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attribution_site_id ON attribution_data(site_id);
CREATE INDEX idx_attribution_booking_id ON attribution_data(booking_id);

-- SEO Keywords Tracking
CREATE TABLE IF NOT EXISTS seo_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  search_volume INTEGER DEFAULT 0,
  difficulty_score INTEGER, -- 1-100
  current_ranking INTEGER, -- Google position
  target_url TEXT,
  tracked_since TIMESTAMPTZ DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  ranking_history JSONB, -- Historical ranking data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, keyword)
);

CREATE INDEX idx_seo_keywords_site_id ON seo_keywords(site_id);

-- Robots.txt Configuration
CREATE TABLE IF NOT EXISTS robots_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE UNIQUE,
  robots_txt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies

-- Page Views (business owners can only see their own)
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own site page_views"
  ON page_views FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Conversions
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own site conversions"
  ON conversions FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own site conversions"
  ON conversions FOR INSERT
  WITH CHECK (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Traffic Sources
ALTER TABLE traffic_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own traffic_sources"
  ON traffic_sources FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- SEO Meta Tags
ALTER TABLE seo_meta_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own site SEO"
  ON seo_meta_tags FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Sitemap Config
ALTER TABLE sitemap_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sitemap"
  ON sitemap_config FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Social Media Accounts
ALTER TABLE social_media_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own social accounts"
  ON social_media_accounts FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Social Media Posts
ALTER TABLE social_media_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own social posts"
  ON social_media_posts FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Social Media Analytics
ALTER TABLE social_media_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own social analytics"
  ON social_media_analytics FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Attribution Data
ALTER TABLE attribution_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attribution data"
  ON attribution_data FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- SEO Keywords
ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own SEO keywords"
  ON seo_keywords FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Robots Config
ALTER TABLE robots_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own robots.txt"
  ON robots_config FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Functions for Analytics Aggregation

-- Daily aggregation function for traffic sources
CREATE OR REPLACE FUNCTION aggregate_traffic_sources()
RETURNS void AS $$
BEGIN
  INSERT INTO traffic_sources (
    site_id, date, source, medium, campaign,
    visitors, sessions, pageviews, conversions, revenue
  )
  SELECT
    pv.site_id,
    DATE(pv.created_at) as date,
    COALESCE(pv.utm_source, 'direct') as source,
    COALESCE(pv.utm_medium, 'none') as medium,
    COALESCE(pv.utm_campaign, '') as campaign,
    COUNT(DISTINCT pv.ip_address) as visitors,
    COUNT(DISTINCT pv.session_id) as sessions,
    COUNT(*) as pageviews,
    0 as conversions,
    0 as revenue
  FROM page_views pv
  WHERE DATE(pv.created_at) = CURRENT_DATE - INTERVAL '1 day'
  GROUP BY pv.site_id, DATE(pv.created_at), source, medium, campaign
  ON CONFLICT (site_id, date, source, medium, campaign)
  DO UPDATE SET
    visitors = EXCLUDED.visitors,
    sessions = EXCLUDED.sessions,
    pageviews = EXCLUDED.pageviews,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversion counts in traffic_sources
CREATE OR REPLACE FUNCTION update_traffic_source_conversions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE traffic_sources SET
    conversions = conversions + 1,
    revenue = revenue + COALESCE(NEW.revenue, 0),
    updated_at = NOW()
  WHERE
    site_id = NEW.site_id
    AND date = DATE(NEW.created_at)
    AND source = COALESCE(NEW.utm_source, 'direct')
    AND medium = COALESCE(NEW.utm_medium, 'none')
    AND campaign = COALESCE(NEW.utm_campaign, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversion_traffic_source_update
  AFTER INSERT ON conversions
  FOR EACH ROW
  EXECUTE FUNCTION update_traffic_source_conversions();

-- Generate XML sitemap
CREATE OR REPLACE FUNCTION generate_sitemap(p_site_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_sitemap TEXT;
  v_base_url TEXT;
BEGIN
  -- Get base URL from businesses table
  SELECT COALESCE(domain, 'https://' || subdomain || '.cybercheck.com')
  INTO v_base_url
  FROM businesses
  WHERE site_id = p_site_id;

  -- Build XML sitemap
  v_sitemap := '<?xml version="1.0" encoding="UTF-8"?>' || CHR(10);
  v_sitemap := v_sitemap || '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' || CHR(10);

  -- Add pages from site_pages table
  SELECT v_sitemap || string_agg(
    '  <url>' || CHR(10) ||
    '    <loc>' || v_base_url || slug || '</loc>' || CHR(10) ||
    '    <lastmod>' || TO_CHAR(updated_at, 'YYYY-MM-DD') || '</lastmod>' || CHR(10) ||
    '    <changefreq>weekly</changefreq>' || CHR(10) ||
    '    <priority>0.8</priority>' || CHR(10) ||
    '  </url>' || CHR(10),
    ''
  )
  INTO v_sitemap
  FROM site_pages
  WHERE site_id = p_site_id AND published = true;

  v_sitemap := v_sitemap || '</urlset>';

  RETURN v_sitemap;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE page_views IS 'Tracks every page view with UTM parameters and device info';
COMMENT ON TABLE conversions IS 'Tracks conversion events (bookings, signups, purchases)';
COMMENT ON TABLE traffic_sources IS 'Daily aggregated traffic data by source/medium/campaign';
COMMENT ON TABLE seo_meta_tags IS 'SEO meta tags configuration per page';
COMMENT ON TABLE social_media_accounts IS 'Connected social media accounts with OAuth tokens';
COMMENT ON TABLE social_media_posts IS 'Scheduled and published social media posts';
COMMENT ON TABLE attribution_data IS 'Customer attribution tracking (how they found you)';
