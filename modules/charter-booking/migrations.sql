-- charter-booking — schema
-- Lifted out of the routes.js header comment so the module ships its own
-- migration. Run against the main CyberCheck database.

CREATE TABLE IF NOT EXISTS charter_listings (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id           text NOT NULL,
  name              text NOT NULL,
  description       text,
  boat_name         text,
  boat_length       int,
  max_passengers    int DEFAULT 6,
  base_price        numeric NOT NULL,
  image_url         text,
  trip_types        text[],   -- ['Inshore','Offshore','Deep Sea']
  durations         jsonb,    -- [{label,hours,price}]
  active            boolean DEFAULT true,
  sort_order        int DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS charter_schedule (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id       text NOT NULL,
  day_of_week   int[],
  specific_date date,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS charter_blocks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id    text NOT NULL,
  block_date date NOT NULL,
  reason     text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS charter_departure_times (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id    text NOT NULL,
  time_slot  time NOT NULL,
  label      text,
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS charter_bookings (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id                  text NOT NULL,
  charter_id               uuid,
  charter_name             text,
  trip_date                date NOT NULL,
  departure_time           time NOT NULL,
  duration_hours           numeric,
  duration_label           text,
  party_size               int DEFAULT 1,
  total_price              numeric,
  deposit_amount           numeric,
  deposit_paid             boolean DEFAULT false,
  balance_amount           numeric,
  balance_paid             boolean DEFAULT false,
  stripe_deposit_intent_id text,
  customer_name            text NOT NULL,
  customer_phone           text,
  customer_email           text,
  experience               text,
  addons                   text[],
  notes                    text,
  waiver_signed            boolean DEFAULT false,
  waiver_skipped           boolean DEFAULT false,
  waiver_signature         text,
  gallery_url              text,
  gallery_delivered_at     timestamptz,
  status                   text DEFAULT 'pending',
  created_at               timestamptz DEFAULT now()
);
