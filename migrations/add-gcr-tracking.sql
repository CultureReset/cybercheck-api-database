-- GCR platform-wide analytics (not per-business)
CREATE TABLE IF NOT EXISTS gcr_page_views (
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
CREATE INDEX IF NOT EXISTS gcr_pv_created_idx ON gcr_page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS gcr_pv_path_idx    ON gcr_page_views(page_path);
CREATE INDEX IF NOT EXISTS gcr_pv_utm_idx     ON gcr_page_views(utm_source, utm_medium, utm_campaign);
CREATE INDEX IF NOT EXISTS gcr_pv_session_idx ON gcr_page_views(session_id);
