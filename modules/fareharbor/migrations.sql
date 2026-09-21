-- fareharbor — schema
-- Lifted out of the routes.js header comment so the module ships its own
-- migration. Run against the main CyberCheck database.

CREATE TABLE IF NOT EXISTS integrations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id         text NOT NULL,
  provider        text NOT NULL,
  status          text DEFAULT 'connected',
  fh_shortname    text,
  fh_api_app_key  text,
  fh_api_user_key text,
  access_token    text,
  webhook_secret  text,
  last_sync_at    timestamptz,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  UNIQUE(site_id, provider)
);
CREATE TABLE IF NOT EXISTS integration_items (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id         text NOT NULL,
  integration_id  uuid,
  provider        text DEFAULT 'fareharbor',
  external_id     text NOT NULL,
  name            text,
  description     text,
  category        text,
  min_capacity    int,
  max_capacity    int,
  duration_minutes int,
  image_url       text,
  booking_url     text,
  active          boolean DEFAULT true,
  raw_data        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  UNIQUE(site_id, provider, external_id)
);
CREATE TABLE IF NOT EXISTS availability_slots (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id             text NOT NULL,
  integration_id      uuid,
  provider            text DEFAULT 'fareharbor',
  external_id         text NOT NULL,
  item_id             text,
  item_name           text,
  slot_date           date NOT NULL,
  start_time          time,
  end_time            time,
  capacity            int,
  available_capacity  int,
  price_min           numeric,
  price_max           numeric,
  status              text DEFAULT 'available',
  booking_url         text,
  raw_data            jsonb DEFAULT '{}',
  synced_at           timestamptz DEFAULT now(),
  UNIQUE(site_id, provider, external_id)
);
CREATE INDEX IF NOT EXISTS availability_slots_date_idx ON availability_slots(slot_date);
CREATE INDEX IF NOT EXISTS availability_slots_site_idx ON availability_slots(site_id);
