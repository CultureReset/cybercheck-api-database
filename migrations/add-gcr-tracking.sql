-- Platform-wide analytics (GCR public site + TripSwipe, not per-business)
-- Renamed from gcr_page_views to platform_page_views to avoid collision
-- with the existing gcr_page_views table in gcrDb (different schema/project)
CREATE TABLE IF NOT EXISTS platform_page_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_path     TEXT,
  page_title    TEXT,
  referrer      TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_term      TEXT,
  utm_content   TEXT,
  device_type   TEXT,
  session_id    TEXT,
  ip_address    TEXT,
  duration_secs INT,
  source        TEXT DEFAULT 'gcr', -- 'gcr' | 'tripswipe'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ppv_created_idx ON platform_page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS ppv_path_idx    ON platform_page_views(page_path);
CREATE INDEX IF NOT EXISTS ppv_utm_idx     ON platform_page_views(utm_source, utm_medium, utm_campaign);
CREATE INDEX IF NOT EXISTS ppv_session_idx ON platform_page_views(session_id);
