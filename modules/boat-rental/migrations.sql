-- boat-rental — schema
-- Lifted out of the routes.js header comment so the module ships its own
-- migration. Run against the main CyberCheck database.

CREATE TABLE IF NOT EXISTS boat_listings (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id       text NOT NULL,
  name          text NOT NULL,
  description   text,
  year          int,
  make          text,
  model         text,
  length_ft     int,
  max_passengers int DEFAULT 8,
  hourly_rate   numeric,
  halfday_rate  numeric,
  fullday_rate  numeric,
  daily_rate    numeric,
  deposit_percent int DEFAULT 50,
  image_url     text,
  features      text[],   -- ['GPS','Live well','Bluetooth','Bimini top']
  active        boolean DEFAULT true,
  sort_order    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS boat_blocks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id    text NOT NULL,
  block_date date NOT NULL,
  boat_id    uuid,
  reason     text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS boat_rentals (
  id                       uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id                  text NOT NULL,
  boat_id                  uuid,
  boat_name                text,
  rental_type              text NOT NULL,   -- hourly|halfday|fullday|multiday
  rental_date              date NOT NULL,
  rental_date_end          date,
  start_time               time,
  end_time                 time,
  package                  text,            -- morning|afternoon
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
  license_number           text,
  addons                   text[],
  notes                    text,
  waiver_signed            boolean DEFAULT false,
  waiver_signature         text,
  status                   text DEFAULT 'pending',
  created_at               timestamptz DEFAULT now()
);
