-- photographer-booking — schema
-- Lifted out of the routes.js header comment so the module ships its own
-- migration. Run against the main CyberCheck database.

CREATE TABLE IF NOT EXISTS photo_sessions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id          text NOT NULL,
  name             text NOT NULL,
  description      text,
  duration_minutes int DEFAULT 60,
  price            numeric NOT NULL,
  deposit_percent  int DEFAULT 50,
  max_subjects     int,
  image_url        text,
  active           boolean DEFAULT true,
  sort_order       int DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS photo_availability (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id      text NOT NULL,
  day_of_week  int[],        -- 0=Sun…6=Sat, null = specific date only
  specific_date date,
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  active       boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS photo_blocks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id    text NOT NULL,
  block_date date NOT NULL,
  reason     text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS photo_bookings (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id                   text NOT NULL,
  session_id                uuid,
  session_name              text,
  session_date              date NOT NULL,
  session_time              time NOT NULL,
  duration_minutes          int,
  customer_name             text NOT NULL,
  customer_email            text,
  customer_phone            text,
  subjects                  int DEFAULT 1,
  location                  text,
  notes                     text,
  total_price               numeric,
  deposit_amount            numeric,
  deposit_paid              boolean DEFAULT false,
  balance_amount            numeric,
  balance_paid              boolean DEFAULT false,
  stripe_deposit_intent_id  text,
  model_release_signed      boolean DEFAULT false,
  model_release_signature   text,
  gallery_url               text,
  gallery_delivered_at      timestamptz,
  status                    text DEFAULT 'pending',
  created_at                timestamptz DEFAULT now()
);
