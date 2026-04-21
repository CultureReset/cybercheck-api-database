-- ============================================
-- QR Code Tracking System
-- Run this in the CyberCheck Supabase SQL editor
-- ============================================

CREATE TABLE IF NOT EXISTS qr_codes (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code           VARCHAR(16) UNIQUE NOT NULL,
  seq_number     INTEGER UNIQUE,            -- printed number on sticker roll (1, 2, 3…)
  type           VARCHAR(50) DEFAULT 'general', -- card, table, menu, ad, condo, beach_chair, boat, door, event, location
  site_id        UUID,                      -- owning business (nullable = unassigned)
  label          TEXT NOT NULL,             -- human name: "Table 5", "My Card", "Hwy 59 Billboard"
  destination_url TEXT,                     -- redirect target; null = show CyberCheck landing page
  scan_url       TEXT,                      -- always https://cybercheck-links.vercel.app/q.html?c=CODE
  location       TEXT,                      -- physical location note: "Fridge door, unit 3B"
  placement      VARCHAR(20) DEFAULT 'fixed', -- fixed | portable
  notes          TEXT,                      -- internal admin notes
  metadata       JSONB DEFAULT '{}',        -- flexible: contact card fields, table_number, gcr_slug, etc.
  scan_count     INTEGER DEFAULT 0,
  active         BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS qr_scans (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_code_id     UUID REFERENCES qr_codes(id) ON DELETE CASCADE,
  scanned_at     TIMESTAMPTZ DEFAULT now(),
  scanner_phone  TEXT,                      -- captured if they enter it (hot lead)
  scanner_name   TEXT,
  device_type    VARCHAR(20),               -- mobile | desktop
  ip_address     TEXT,
  user_agent     TEXT,
  metadata       JSONB DEFAULT '{}'
);

-- Fast lookups
CREATE INDEX IF NOT EXISTS idx_qr_codes_code     ON qr_codes(code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_site_id  ON qr_codes(site_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_seq      ON qr_codes(seq_number);
CREATE INDEX IF NOT EXISTS idx_qr_scans_code_id  ON qr_scans(qr_code_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_phone    ON qr_scans(scanner_phone) WHERE scanner_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_scans_time     ON qr_scans(scanned_at DESC);

-- Auto-increment seq_number via sequence
CREATE SEQUENCE IF NOT EXISTS qr_seq_number_seq START 1;

-- Optional: seed yourself as the first customer in the loyalty/customer table
-- (run after confirming your site_id)
-- INSERT INTO customers (site_id, phone, name, source)
-- VALUES ('YOUR-SITE-ID', '8505551234', 'Your Name', 'admin')
-- ON CONFLICT DO NOTHING;
