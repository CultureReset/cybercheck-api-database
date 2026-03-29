-- Session Events: every user interaction
CREATE TABLE IF NOT EXISTS session_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id       uuid NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
  session_id    text,
  event_type    text NOT NULL,  -- 'scroll','click','section_view','addon_select','gallery_view','phone_click','map_click'
  event_label   text,           -- e.g. 'book_now', 'single_seater', '75%', 'section:rentals'
  metadata      jsonb,          -- any extra data
  page_path     text,
  duration_ms   int,            -- time since page load when event fired
  ip_address    text,
  device_type   text,
  created_at    timestamptz DEFAULT now()
);

-- Booking Funnel: every step in the booking flow
CREATE TABLE IF NOT EXISTS booking_funnel (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id        uuid NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
  session_id     text,
  booking_ref    text,          -- links funnel events for one booking attempt
  step           int,           -- 1=Date, 2=Boat&Time, 3=Extras, 4=Checkout
  step_name      text,          -- 'opened','date_selected','boat_selected','slot_selected','addon_added','checkout_reached','payment_attempted','completed','abandoned'
  metadata       jsonb,         -- selected values at this step
  time_on_step_ms int,          -- how long they spent on this step
  ip_address     text,
  device_type    text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_events_site_id ON session_events(site_id);
CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_event_type ON session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_booking_funnel_site_id ON booking_funnel(site_id);
CREATE INDEX IF NOT EXISTS idx_booking_funnel_booking_ref ON booking_funnel(booking_ref);
