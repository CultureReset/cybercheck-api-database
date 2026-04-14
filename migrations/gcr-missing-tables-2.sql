-- ============================================================
-- GCR Missing Tables — Part 2
-- Run in GCR Supabase SQL Editor (adpnhipmdefutkzzltbs)
-- Uses entity_id instead of site_id
-- ============================================================

-- ai_chunks
CREATE TABLE IF NOT EXISTS ai_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  chunk_type text, content text, metadata jsonb DEFAULT '{}',
  source text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- attribution_data
CREATE TABLE IF NOT EXISTS attribution_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  referral_source text, referral_details text,
  utm_source text, utm_medium text, utm_campaign text,
  first_touch_source text, first_touch_date timestamptz,
  last_touch_source text, last_touch_date timestamptz,
  total_sessions integer DEFAULT 0, created_at timestamptz DEFAULT now()
);

-- business_completeness
CREATE TABLE IF NOT EXISTS business_completeness (
  entity_id uuid PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  data_tier text, score integer DEFAULT 0,
  basic_info boolean DEFAULT false, photos boolean DEFAULT false,
  menu boolean DEFAULT false, ai_script boolean DEFAULT false,
  embeddings boolean DEFAULT false, logistics boolean DEFAULT false,
  last_updated_at timestamptz, notes text
);

-- business_data_status
CREATE TABLE IF NOT EXISTS business_data_status (
  entity_id uuid PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  has_basic_info boolean DEFAULT false, has_photos boolean DEFAULT false,
  has_description boolean DEFAULT false, has_hours boolean DEFAULT false,
  has_contact boolean DEFAULT false, has_menu boolean DEFAULT false,
  has_packages boolean DEFAULT false, has_specials boolean DEFAULT false,
  has_events boolean DEFAULT false, has_reviews boolean DEFAULT false,
  has_ai_script boolean DEFAULT false, has_highlights boolean DEFAULT false,
  has_logistics boolean DEFAULT false, has_atmosphere boolean DEFAULT false,
  has_embeddings boolean DEFAULT false, completeness_score integer DEFAULT 0,
  data_tier text, last_updated_by text, last_updated_at timestamptz,
  claimed_by_owner boolean DEFAULT false, needs_review boolean DEFAULT false, notes text
);

-- comparisons
CREATE TABLE IF NOT EXISTS comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a uuid REFERENCES entity(id) ON DELETE CASCADE,
  entity_b uuid REFERENCES entity(id) ON DELETE CASCADE,
  category text, a_wins_at text[], b_wins_at text[],
  summary text, created_at timestamptz DEFAULT now()
);

-- connections
CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  provider text NOT NULL, access_token text, refresh_token text,
  token_expires_at timestamptz, account_id text, account_name text,
  status text DEFAULT 'connected', metadata jsonb DEFAULT '{}',
  connected_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_entity_provider ON connections(entity_id, provider);

-- conversions (analytics)
CREATE TABLE IF NOT EXISTS conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  conversion_type text, conversion_value numeric, revenue numeric,
  customer_email text, customer_name text,
  utm_source text, utm_medium text, utm_campaign text,
  referrer text, session_id text, metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- coupons
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  code text NOT NULL, type text, amount numeric,
  min_order numeric DEFAULT 0, max_uses integer,
  uses_count integer DEFAULT 0, expires_at timestamptz,
  description text, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  name text, phone text, email text, notes text,
  tier text DEFAULT 'standard', total_orders integer DEFAULT 0,
  total_bookings integer DEFAULT 0, total_spent numeric DEFAULT 0,
  last_visit timestamptz, tags jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- emergency_info
CREATE TABLE IF NOT EXISTS emergency_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text, name text, address text, phone text,
  hours text, distance_note text, lat numeric, lng numeric
);

-- faq_items
CREATE TABLE IF NOT EXISTS faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  question text, answer text, sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- gcr_claims
CREATE TABLE IF NOT EXISTS gcr_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  business_name text, claimant_name text, claimant_email text,
  claimant_phone text, business_role text, notes text,
  claim_type text, status text DEFAULT 'pending',
  admin_notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- gcr_directory
CREATE TABLE IF NOT EXISTS gcr_directory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, type text, category text, subcategory jsonb DEFAULT '{}',
  tags jsonb DEFAULT '[]', rating numeric, user_ratings_total integer,
  price_level smallint, description text, image text,
  website text, phone text, hours text,
  specials jsonb DEFAULT '{}', events jsonb DEFAULT '{}',
  happy_hour jsonb DEFAULT '{}', menu jsonb DEFAULT '{}',
  address text, city text, state text, lat numeric, lng numeric,
  about_text text, social_links jsonb DEFAULT '{}', gallery jsonb DEFAULT '[]'
);

-- gcr_feed_posts
CREATE TABLE IF NOT EXISTS gcr_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  type text, text text, image_url text, link_url text,
  link_text text, emoji text, pinned boolean DEFAULT false,
  active boolean DEFAULT true, expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  business_name text, business_logo text
);

-- gcr_menu_items
CREATE TABLE IF NOT EXISTS gcr_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  menu_type text, section text, section_order integer DEFAULT 0,
  name text NOT NULL, description text, price text,
  price_variants jsonb DEFAULT '{}', available_days text[],
  available_start time, available_end time,
  tags text[], sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- grocery_and_supplies
CREATE TABLE IF NOT EXISTS grocery_and_supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, type text, area text, address text,
  hours text, note text, lat numeric, lng numeric
);

-- hidden_gems
CREATE TABLE IF NOT EXISTS hidden_gems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  why_hidden text, how_to_find text, best_kept_secret text,
  verified_local boolean DEFAULT false, created_at timestamptz DEFAULT now()
);

-- hours_exceptions
CREATE TABLE IF NOT EXISTS hours_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  date date, closed boolean DEFAULT false,
  open_time time, close_time time, note text,
  created_at timestamptz DEFAULT now()
);

-- tourists
CREATE TABLE IF NOT EXISTS tourists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text, first_name text, last_name text, email text,
  arrival_date date, checkout_date date, trip_active boolean DEFAULT true,
  hotel_name text, hotel_area text,
  hotel_entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  signup_source text, agent_active boolean DEFAULT true,
  last_active_at timestamptz, total_conversations integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tourists_phone ON tourists(phone);

-- tourist_sessions
CREATE TABLE IF NOT EXISTS tourist_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  name text, phone text, interests text[], visitor_type text,
  checkin date, checkout date, session_id uuid UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- tourist_conversations
CREATE TABLE IF NOT EXISTS tourist_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES tourist_sessions(id) ON DELETE CASCADE,
  tourist_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  role text, content text, created_at timestamptz DEFAULT now()
);

-- tourist_memory
CREATE TABLE IF NOT EXISTS tourist_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid UNIQUE REFERENCES tourists(id) ON DELETE CASCADE,
  party_size integer, adults integer, children integer,
  children_ages integer[], has_pets boolean DEFAULT false,
  pet_details text, budget_level text, daily_spend_estimate numeric,
  dietary_restrictions text[], food_preferences text[], food_dislikes text[],
  drinks_alcohol boolean DEFAULT true, primary_interests text[],
  activity_level text, mobility_needs text, wheelchair boolean DEFAULT false,
  stroller boolean DEFAULT false, prefers_outdoor boolean DEFAULT false,
  prefers_waterfront boolean DEFAULT false, prefers_quiet boolean DEFAULT false,
  prefers_lively boolean DEFAULT false, loved_vibes text[], hated_vibes text[],
  has_car boolean DEFAULT true, car_count integer DEFAULT 1,
  uses_rideshare boolean DEFAULT false, max_drive_minutes integer DEFAULT 20,
  updated_at timestamptz DEFAULT now()
);

-- tourist_preferences
CREATE TABLE IF NOT EXISTS tourist_preferences (
  tourist_id uuid PRIMARY KEY REFERENCES tourists(id) ON DELETE CASCADE,
  dietary text[], budget text, party_size integer,
  has_kids boolean DEFAULT false, kids_ages integer[],
  has_pets boolean DEFAULT false, interests text[],
  max_drive_minutes integer DEFAULT 20,
  wants_outdoor boolean DEFAULT false, wants_waterfront boolean DEFAULT false,
  wants_live_music boolean DEFAULT false, wants_quiet boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- tourist_agent_state
CREATE TABLE IF NOT EXISTS tourist_agent_state (
  tourist_id uuid PRIMARY KEY REFERENCES tourists(id) ON DELETE CASCADE,
  profile_summary text, confirmed_dietary boolean DEFAULT false,
  confirmed_budget boolean DEFAULT false, confirmed_party boolean DEFAULT false,
  confirmed_interests boolean DEFAULT false, onboarding_complete boolean DEFAULT false,
  last_topic text, last_businesses text[], pending_question text,
  days_in integer DEFAULT 0, places_visited integer DEFAULT 0,
  places_saved integer DEFAULT 0, conversations_total integer DEFAULT 0,
  last_conversation_at timestamptz, send_morning_brief boolean DEFAULT false,
  send_evening_suggestions boolean DEFAULT false,
  morning_brief_time time, opted_out_proactive boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- tourist_saved_places
CREATE TABLE IF NOT EXISTS tourist_saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  saved_reason text, priority text DEFAULT 'normal',
  planned_for_date date, planned_for_time time,
  notes text, visited boolean DEFAULT false,
  saved_at timestamptz DEFAULT now()
);

-- tourist_visits
CREATE TABLE IF NOT EXISTS tourist_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  visit_date date, meal_type text, rating integer,
  liked text[], disliked text[], would_return boolean,
  recommend_to_others boolean, tourist_quote text,
  recommended_by text, created_at timestamptz DEFAULT now()
);

-- trip_itineraries
CREATE TABLE IF NOT EXISTS trip_itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES tourists(id) ON DELETE CASCADE,
  title text, total_days integer, est_total_spend numeric,
  agent_notes text, created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- itineraries
CREATE TABLE IF NOT EXISTS itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text, description text, duration_hours integer,
  tags text[], best_for text[], season text[],
  est_cost_min numeric, est_cost_max numeric,
  created_by text, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- itinerary_days
CREATE TABLE IF NOT EXISTS itinerary_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid REFERENCES itineraries(id) ON DELETE CASCADE,
  tourist_id uuid REFERENCES tourists(id) ON DELETE SET NULL,
  day_number integer, date date, theme text,
  weather_note text, est_spend numeric
);

-- itinerary_items
CREATE TABLE IF NOT EXISTS itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid REFERENCES itineraries(id) ON DELETE CASCADE,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  stop_order integer, stop_type text, suggested_time text,
  duration_minutes integer, est_cost_per_person numeric,
  why_included text, tip text, optional boolean DEFAULT false
);

-- itinerary_stops
CREATE TABLE IF NOT EXISTS itinerary_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid REFERENCES itinerary_days(id) ON DELETE CASCADE,
  tourist_id uuid REFERENCES tourists(id) ON DELETE SET NULL,
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  stop_order integer, stop_type text,
  start_time time, end_time time, duration_minutes integer,
  est_cost_per_person numeric, agent_note text,
  booking_required boolean DEFAULT false, booking_url text,
  booking_confirmed boolean DEFAULT false, confirmation_code text,
  status text DEFAULT 'planned'
);

-- leads
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, business_name text, email text, phone text,
  business_type text, interest text, source text,
  status text DEFAULT 'new', notes text,
  created_at timestamptz DEFAULT now()
);

-- live_conditions
CREATE TABLE IF NOT EXISTS live_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text, updated_at timestamptz DEFAULT now(),
  crowd_level text, traffic_note text, weather_advisory text,
  beach_flag text, water_temp_f integer, wave_height text,
  jellyfish_warning boolean DEFAULT false, special_note text
);

-- local_tips
CREATE TABLE IF NOT EXISTS local_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text, tip text, source text, area text,
  seasonal boolean DEFAULT false, season text,
  active boolean DEFAULT true, upvotes integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- locations
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text, address text, city text, state text, zip text,
  lat numeric, lng numeric, phone text, notes text,
  is_primary boolean DEFAULT false, active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- loyalty_signups
CREATE TABLE IF NOT EXISTS loyalty_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, email text, phone text, visitor_type text,
  interests text[], checkin date, checkout date,
  source text, sms_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- media_library
CREATE TABLE IF NOT EXISTS media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  url text, caption text, type text, sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- menu_categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text NOT NULL, description text,
  time_start time, time_end time, image_url text,
  sort_order integer DEFAULT 0, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- menu_details
CREATE TABLE IF NOT EXISTS menu_details (
  entity_id uuid PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  cuisine_types text[], cooking_styles text[], sourcing_note text,
  vegetarian_options boolean DEFAULT false, vegan_options boolean DEFAULT false,
  gluten_free_options boolean DEFAULT false, gluten_free_menu boolean DEFAULT false,
  dairy_free_options boolean DEFAULT false, nut_allergy_friendly boolean DEFAULT false,
  kids_menu boolean DEFAULT false, kids_eat_free text,
  full_bar boolean DEFAULT false, craft_beer boolean DEFAULT false,
  local_beer boolean DEFAULT false, wine_list boolean DEFAULT false,
  signature_cocktails boolean DEFAULT false, byob boolean DEFAULT false,
  corkage_fee text, happy_hour boolean DEFAULT false,
  happy_hour_schedule text, happy_hour_deals text,
  service_style text, avg_check_per_person text,
  takeout boolean DEFAULT false, delivery boolean DEFAULT false,
  delivery_apps text[], catering boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- menu_subcategories
CREATE TABLE IF NOT EXISTS menu_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  category_id uuid REFERENCES menu_categories(id) ON DELETE CASCADE,
  name text NOT NULL, description text, sort_order integer DEFAULT 0,
  active boolean DEFAULT true, created_at timestamptz DEFAULT now()
);

-- messaging_settings
CREATE TABLE IF NOT EXISTS messaging_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid UNIQUE REFERENCES entity(id) ON DELETE CASCADE,
  owner_phone text, customer_phone text, notification_phone text,
  customer_booking_template text, owner_booking_template text,
  photo_gallery_enabled boolean DEFAULT false, photo_gallery_section text,
  voice_ai_enabled boolean DEFAULT false, voice_greeting text,
  notify_customer_on_booking boolean DEFAULT true,
  notify_owner_on_booking boolean DEFAULT true,
  notify_customer_on_cancel boolean DEFAULT true,
  notify_owner_on_cancel boolean DEFAULT true,
  notification_email text, updated_at timestamptz DEFAULT now()
);

-- money_saving_tips
CREATE TABLE IF NOT EXISTS money_saving_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  area text, tip text, saves_amount text,
  valid_days text[], valid_times text, active boolean DEFAULT true
);

-- neighborhoods
CREATE TABLE IF NOT EXISTS neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text, area text, description text,
  walkable boolean DEFAULT false, best_for text[],
  parking_note text, lat numeric, lng numeric, radius_miles numeric
);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  type text, title text, body text,
  metadata jsonb DEFAULT '{}', read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  items jsonb DEFAULT '[]', subtotal numeric, tax numeric, total numeric,
  status text DEFAULT 'pending', payment_id text, payment_provider text,
  pickup_time timestamptz, order_type text, notes text,
  customer_name text, customer_phone text, customer_email text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- packages
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text NOT NULL, description text, price numeric,
  price_label text, duration_minutes integer,
  whats_included text[], min_guests integer, max_guests integer,
  booking_url text, advance_hours integer DEFAULT 0,
  active boolean DEFAULT true, sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- page_views
CREATE TABLE IF NOT EXISTS page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  page_path text, page_title text, referrer text,
  utm_source text, utm_medium text, utm_campaign text,
  device_type text, browser text, os text,
  country text, city text, region text,
  session_id text, duration_seconds integer,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_page_views_entity ON page_views(entity_id);
CREATE INDEX IF NOT EXISTS idx_page_views_date ON page_views(created_at);

-- photos
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  url text, caption text, category text,
  featured boolean DEFAULT false, sort_order integer DEFAULT 0,
  uploaded_by text, created_at timestamptz DEFAULT now()
);

-- platform_settings
CREATE TABLE IF NOT EXISTS platform_settings (
  key text PRIMARY KEY,
  value jsonb DEFAULT '{}', updated_at timestamptz DEFAULT now()
);

-- price_guide
CREATE TABLE IF NOT EXISTS price_guide (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  item_name text, price numeric, price_label text,
  category text, note text, active boolean DEFAULT true
);

-- qa_pairs
CREATE TABLE IF NOT EXISTS qa_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  question text, answer text, category text,
  confidence numeric DEFAULT 1.0, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- review_questions
CREATE TABLE IF NOT EXISTS review_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  question_text text NOT NULL, question_type text DEFAULT 'stars',
  display_order integer DEFAULT 0, enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- review_answers
CREATE TABLE IF NOT EXISTS review_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES gcr_reviews(id) ON DELETE CASCADE,
  question_id uuid REFERENCES review_questions(id) ON DELETE CASCADE,
  answer text, created_at timestamptz DEFAULT now()
);

-- room_types
CREATE TABLE IF NOT EXISTS room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text NOT NULL, description text,
  price_per_night numeric, price_weekend numeric, price_peak numeric,
  max_guests integer, beds text, sqft integer,
  floor text, view text, amenities text[],
  image_url text, booking_url text,
  active boolean DEFAULT true, sort_order integer DEFAULT 0
);

-- search_intents
CREATE TABLE IF NOT EXISTS search_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id uuid REFERENCES tourists(id) ON DELETE SET NULL,
  raw_query text, intent text,
  wants_happy_hour boolean DEFAULT false, wants_live_music boolean DEFAULT false,
  wants_gluten_free boolean DEFAULT false, wants_vegan boolean DEFAULT false,
  wants_outdoor boolean DEFAULT false, wants_waterfront boolean DEFAULT false,
  wants_pet_friendly boolean DEFAULT false, wants_kid_friendly boolean DEFAULT false,
  wants_open_now boolean DEFAULT false, requested_time time,
  requested_day text, resolved_day text, resolved_date date,
  budget_level text, party_size integer, cuisine_requested text,
  filters_extracted jsonb DEFAULT '{}', results_returned integer DEFAULT 0,
  top_result_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  tourist_chose uuid REFERENCES entity(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- seasonal_info
CREATE TABLE IF NOT EXISTS seasonal_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  season text, note text, best_months text[],
  crowd_level text, price_level text, special_hours text
);

-- seo_keywords
CREATE TABLE IF NOT EXISTS seo_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  keyword text, search_volume integer, difficulty_score integer,
  current_ranking integer, target_url text,
  tracked_since timestamptz, last_checked_at timestamptz,
  ranking_history jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- seo_meta_tags
CREATE TABLE IF NOT EXISTS seo_meta_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  page_slug text, page_title text, meta_description text,
  meta_keywords text, og_title text, og_description text,
  og_image text, og_type text, twitter_card text,
  twitter_title text, twitter_description text, twitter_image text,
  canonical_url text, robots text, schema_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- session_events
CREATE TABLE IF NOT EXISTS session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  session_id text, event_type text, event_label text,
  metadata jsonb DEFAULT '{}', page_path text,
  duration_ms integer, device_type text,
  created_at timestamptz DEFAULT now()
);

-- site_pages
CREATE TABLE IF NOT EXISTS site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  slug text, title text, html_content text,
  page_type text, visible boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- sms_campaigns
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  audience text, message text, coupon_code text,
  recipient_count integer DEFAULT 0, sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0, status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now()
);

-- sms_log
CREATE TABLE IF NOT EXISTS sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  to_phone text, message text, type text,
  status text DEFAULT 'sent', related_id uuid,
  metadata jsonb DEFAULT '{}', created_at timestamptz DEFAULT now()
);

-- sms_opt_outs
CREATE TABLE IF NOT EXISTS sms_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL, entity_id uuid REFERENCES entity(id) ON DELETE SET NULL,
  opted_out_at timestamptz DEFAULT now()
);

-- social_media_accounts
CREATE TABLE IF NOT EXISTS social_media_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  platform text NOT NULL, account_name text, account_id text,
  account_url text, access_token text, refresh_token text,
  token_expires_at timestamptz, page_id text, page_access_token text,
  is_connected boolean DEFAULT false, last_sync_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_entity_platform ON social_media_accounts(entity_id, platform);

-- social_media_analytics
CREATE TABLE IF NOT EXISTS social_media_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  platform text, date date, followers integer,
  posts_count integer, likes integer, comments integer,
  shares integer, reach integer, impressions integer,
  engagement_rate numeric, clicks integer,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- social_media_posts
CREATE TABLE IF NOT EXISTS social_media_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  post_text text, media_urls text[], platforms text[],
  status text DEFAULT 'draft', scheduled_for timestamptz,
  published_at timestamptz, post_ids jsonb DEFAULT '{}',
  error_message text, engagement_stats jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- song_requests
CREATE TABLE IF NOT EXISTS song_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid REFERENCES artists(id) ON DELETE CASCADE,
  show_id uuid REFERENCES artist_shows(id) ON DELETE SET NULL,
  song_name text, requester_name text,
  tip_amount numeric DEFAULT 0, tip_method text, tip_handle text,
  position integer DEFAULT 0, status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- staff
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  name text NOT NULL, role text, bio text, photo_url text,
  phone text, email text, active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- transportation
CREATE TABLE IF NOT EXISTS transportation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text, name text, description text,
  coverage_area text, price_estimate text,
  contact text, website text, tip text, active boolean DEFAULT true
);

-- waitlist
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES entity(id) ON DELETE CASCADE,
  customer_name text, customer_email text, customer_phone text,
  preferred_date date, preferred_slot text,
  party_size integer DEFAULT 1, status text DEFAULT 'waiting',
  notified_at timestamptz, notes text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);

-- waitlist_settings
CREATE TABLE IF NOT EXISTS waitlist_settings (
  entity_id uuid PRIMARY KEY REFERENCES entity(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false, max_size integer DEFAULT 50,
  auto_notify boolean DEFAULT true, sms_message text,
  updated_at timestamptz DEFAULT now()
);
