-- CONSOLIDATED DATABASE SCHEMA
-- Generated: 2026-05-15T03:34:30.501Z
-- Tables: 89
-- Source: GCR + Profiles + CultureReset


CREATE TABLE IF NOT EXISTS activities (
  _source VARCHAR(255) NOT NULL,
  business_id VARCHAR(255) NOT NULL,
  contact_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  description VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  lead_id VARCHAR(255) NOT NULL,
  metadata JSONB NOT NULL,
  task_id TEXT NOT NULL,
  type VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  voice_note_id TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_activities_created ON activities(created_at);
COMMENT ON TABLE activities IS '2 records';

CREATE TABLE IF NOT EXISTS addons (
  _source VARCHAR(255) NOT NULL,
  addon_name VARCHAR(255) NOT NULL,
  capacity_text TEXT NOT NULL,
  description VARCHAR(255) NOT NULL,
  dimensions TEXT NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  price INTEGER NOT NULL,
  price_max TEXT NOT NULL,
  price_min TEXT NOT NULL,
  price_type VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_addons_created ON addons(created_at);
COMMENT ON TABLE addons IS '5 records';

CREATE TABLE IF NOT EXISTS ai_settings (
  _source VARCHAR(255) NOT NULL,
  api_key_anthropic TEXT NOT NULL,
  api_key_grok TEXT NOT NULL,
  api_key_openai TEXT NOT NULL,
  chat_api_key TEXT NOT NULL,
  chat_model VARCHAR(255) NOT NULL,
  chat_provider VARCHAR(255) NOT NULL,
  embed_api_key TEXT NOT NULL,
  embed_dimensions INTEGER NOT NULL,
  embed_model VARCHAR(255) NOT NULL,
  embed_provider VARCHAR(255) NOT NULL,
  id INTEGER NOT NULL,
  rag_enabled BOOLEAN NOT NULL,
  system_prompt VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  voice_enabled BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_ai_settings_created ON ai_settings(created_at);
COMMENT ON TABLE ai_settings IS '1 records';

CREATE TABLE IF NOT EXISTS app_settings (
  _source VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  value VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_app_settings_created ON app_settings(created_at);
COMMENT ON TABLE app_settings IS '2 records';

CREATE TABLE IF NOT EXISTS apps (
  _source VARCHAR(255) NOT NULL,
  app_id VARCHAR(255) NOT NULL,
  business_types JSONB NOT NULL,
  category VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  icon VARCHAR(255) NOT NULL,
  monthly_price NUMERIC NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_apps_created ON apps(created_at);
COMMENT ON TABLE apps IS '19 records';

CREATE TABLE IF NOT EXISTS availability_blocks (
  _source VARCHAR(255) NOT NULL,
  block_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL,
  end_time TEXT NOT NULL,
  fleet_type_id TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  start_time TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_availability_blocks_created ON availability_blocks(created_at);
COMMENT ON TABLE availability_blocks IS '1 records';

CREATE TABLE IF NOT EXISTS blackout_dates (
  _source VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  date_from TIMESTAMP NOT NULL,
  date_to TIMESTAMP NOT NULL,
  id VARCHAR(255) NOT NULL,
  label TEXT NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_blackout_dates_created ON blackout_dates(created_at);
COMMENT ON TABLE blackout_dates IS '1 records';

CREATE TABLE IF NOT EXISTS bookings (
  _source VARCHAR(255) NOT NULL,
  addons JSONB NOT NULL,
  booking_date TIMESTAMP NOT NULL,
  booking_time TEXT NOT NULL,
  booking_token TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_id VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone INTEGER NOT NULL,
  deposit INTEGER NOT NULL,
  duration_minutes TEXT NOT NULL,
  end_time TEXT NOT NULL,
  fleet_type_id TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  notes VARCHAR(255) NOT NULL,
  party_size INTEGER NOT NULL,
  payment_id VARCHAR(255) NOT NULL,
  payment_provider VARCHAR(255) NOT NULL,
  payment_status VARCHAR(255) NOT NULL,
  qty INTEGER NOT NULL,
  receipt_number VARCHAR(255) NOT NULL,
  receipt_url VARCHAR(255) NOT NULL,
  reminder_sent TIMESTAMP NOT NULL,
  review_requested BOOLEAN NOT NULL,
  service_id TEXT NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  sms_consent BOOLEAN NOT NULL,
  sms_consent_at TIMESTAMP NOT NULL,
  sms_consent_ip VARCHAR(255) NOT NULL,
  sms_consent_text VARCHAR(255) NOT NULL,
  sms_delivered BOOLEAN NOT NULL,
  status VARCHAR(255) NOT NULL,
  subtotal INTEGER NOT NULL,
  tax NUMERIC NOT NULL,
  time_slot_id TEXT NOT NULL,
  total NUMERIC NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  waiver_signed BOOLEAN NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_bookings_created ON bookings(created_at);
COMMENT ON TABLE bookings IS '28 records';

CREATE TABLE IF NOT EXISTS business_completeness (
  _source VARCHAR(255) NOT NULL,
  ai_script BOOLEAN NOT NULL,
  basic_info BOOLEAN NOT NULL,
  data_tier VARCHAR(255) NOT NULL,
  embeddings BOOLEAN NOT NULL,
  last_updated_at TEXT NOT NULL,
  logistics BOOLEAN NOT NULL,
  menu BOOLEAN NOT NULL,
  name VARCHAR(255) NOT NULL,
  notes TEXT NOT NULL,
  photos BOOLEAN NOT NULL,
  score INTEGER NOT NULL,
  subdomain VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_business_completeness_created ON business_completeness(created_at);
COMMENT ON TABLE business_completeness IS '207 records';

CREATE TABLE IF NOT EXISTS business_highlights (
  _source VARCHAR(255) NOT NULL,
  avoid_tip TEXT NOT NULL,
  best_time VARCHAR(255) NOT NULL,
  bullets JSONB NOT NULL,
  deal_alert TEXT NOT NULL,
  fun_fact TEXT NOT NULL,
  headline TEXT NOT NULL,
  local_tip TEXT NOT NULL,
  signature_item TEXT NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_business_highlights_created ON business_highlights(created_at);
COMMENT ON TABLE business_highlights IS '129 records';

CREATE TABLE IF NOT EXISTS business_media (
  _source VARCHAR(255) NOT NULL,
  caption VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  id VARCHAR(255) NOT NULL,
  linked_id TEXT NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  section VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  url VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_business_media_created ON business_media(created_at);
COMMENT ON TABLE business_media IS '351 records';

CREATE TABLE IF NOT EXISTS businesses (
  _source VARCHAR(255) NOT NULL,
  about TEXT,
  account_type VARCHAR(255),
  address TEXT,
  address2 TEXT,
  ai_cleaned_tags TEXT,
  ai_generated_bio TEXT,
  ai_models JSONB,
  ai_processed BOOLEAN,
  ai_provider VARCHAR(255),
  ai_summary TEXT,
  ai_tags TEXT,
  alcohol BOOLEAN,
  alternate_names TEXT,
  ambiance TEXT,
  area VARCHAR(255),
  area_zone TEXT,
  atmosphere TEXT,
  banner_image TEXT,
  beach_access TEXT,
  beachfront BOOLEAN,
  booking_required BOOLEAN,
  booking_url TEXT,
  business_id TEXT,
  business_name VARCHAR(255),
  business_status VARCHAR(255),
  business_type VARCHAR(255),
  can_message BOOLEAN,
  category TEXT,
  city TEXT,
  cleaned_at TEXT,
  cleaned_by_ai BOOLEAN,
  country VARCHAR(255),
  cover_image_url TEXT,
  cover_photo TEXT,
  cover_url VARCHAR(255),
  created_at TIMESTAMP NOT NULL,
  cross_street TEXT,
  cuisines TEXT,
  daily_specials TEXT,
  data_quality_score TEXT,
  delivery BOOLEAN,
  description TEXT,
  distance_to_beach_feet TEXT,
  dockside BOOLEAN,
  dog_friendly BOOLEAN,
  domain VARCHAR(255),
  dress_code TEXT,
  email TEXT,
  emoji VARCHAR(255),
  facebook VARCHAR(255),
  facebook_url TEXT,
  family_friendly BOOLEAN,
  featured BOOLEAN,
  featured_image TEXT,
  first_scraped_at TEXT,
  formatted_address TEXT,
  foursquare_best_photo TEXT,
  foursquare_categories TEXT,
  foursquare_checkins_count TEXT,
  foursquare_delivery TEXT,
  foursquare_features TEXT,
  foursquare_hours TEXT,
  foursquare_id TEXT,
  foursquare_likes_count TEXT,
  foursquare_menu_mobile_url TEXT,
  foursquare_menu_url TEXT,
  foursquare_outdoor_seating TEXT,
  foursquare_parking TEXT,
  foursquare_payment_options TEXT,
  foursquare_photos TEXT,
  foursquare_popular_hours TEXT,
  foursquare_price_message TEXT,
  foursquare_price_tier TEXT,
  foursquare_rating TEXT,
  foursquare_rating_count TEXT,
  foursquare_raw_data TEXT,
  foursquare_reservations TEXT,
  foursquare_takeout TEXT,
  foursquare_taste_tags TEXT,
  foursquare_tips_count TEXT,
  foursquare_url TEXT,
  foursquare_users_count TEXT,
  foursquare_verified BOOLEAN,
  foursquare_wifi TEXT,
  gallery_images TEXT,
  gcr_category VARCHAR(255),
  gcr_description VARCHAR(255),
  gcr_events JSONB,
  gcr_happy_hour JSONB,
  gcr_hours VARCHAR(255),
  gcr_image VARCHAR(255),
  gcr_listed BOOLEAN,
  gcr_menu JSONB,
  gcr_phone VARCHAR(255),
  gcr_price_level INTEGER,
  gcr_rating NUMERIC,
  gcr_review_count INTEGER,
  gcr_specials JSONB,
  gcr_subcategory JSONB,
  gcr_tags JSONB,
  gcr_verified BOOLEAN,
  gcr_website VARCHAR(255),
  gluten_free BOOLEAN,
  google_accepts_cash_only TEXT,
  google_accepts_credit_cards TEXT,
  google_accepts_debit_cards TEXT,
  google_accepts_nfc TEXT,
  google_accessibility_options TEXT,
  google_address_descriptor TEXT,
  google_adr_format_address TEXT,
  google_allows_dogs BOOLEAN,
  google_business_status TEXT,
  google_casual BOOLEAN,
  google_containing_places TEXT,
  google_cozy BOOLEAN,
  google_curbside_pickup BOOLEAN,
  google_current_opening_hours TEXT,
  google_current_secondary_opening_hours TEXT,
  google_delivery TEXT,
  google_dine_in TEXT,
  google_display_name TEXT,
  google_dogs_allowed BOOLEAN,
  google_editorial_summary TEXT,
  google_ev_charge_options TEXT,
  google_formatted_address TEXT,
  google_free_parking TEXT,
  google_free_wifi TEXT,
  google_fuel_options TEXT,
  google_gender_neutral_restroom BOOLEAN,
  google_generative_summary TEXT,
  google_good_for_children TEXT,
  google_good_for_groups TEXT,
  google_good_for_watching_sports BOOLEAN,
  google_hours TEXT,
  google_icon_background_color TEXT,
  google_icon_mask_base_uri TEXT,
  google_international_phone TEXT,
  google_live_music TEXT,
  google_maps_links TEXT,
  google_maps_url TEXT,
  google_menu_for_children BOOLEAN,
  google_national_phone TEXT,
  google_neighborhood_summary TEXT,
  google_opening_hours TEXT,
  google_outdoor_seating TEXT,
  google_paid_parking TEXT,
  google_paid_wifi TEXT,
  google_parking TEXT,
  google_parking_options TEXT,
  google_payment_options TEXT,
  google_permanently_closed BOOLEAN,
  google_phone TEXT,
  google_photos TEXT,
  google_photos_count TEXT,
  google_place_id TEXT,
  google_plus_code TEXT,
  google_plus_code_compound TEXT,
  google_plus_code_global TEXT,
  google_postal_address TEXT,
  google_price_level TEXT,
  google_price_range TEXT,
  google_primary_type TEXT,
  google_primary_type_display_name TEXT,
  google_pure_service_area_business BOOLEAN,
  google_rating TEXT,
  google_raw_data TEXT,
  google_regular_opening_hours TEXT,
  google_regular_secondary_opening_hours TEXT,
  google_reservable TEXT,
  google_restroom TEXT,
  google_review_count INTEGER,
  google_review_summary TEXT,
  google_reviews TEXT,
  google_reviews_count TEXT,
  google_romantic BOOLEAN,
  google_routing_summaries TEXT,
  google_serves_beer TEXT,
  google_serves_breakfast TEXT,
  google_serves_brunch TEXT,
  google_serves_cocktails TEXT,
  google_serves_coffee BOOLEAN,
  google_serves_dessert BOOLEAN,
  google_serves_dinner TEXT,
  google_serves_lunch TEXT,
  google_serves_vegetarian TEXT,
  google_serves_vegetarian_food BOOLEAN,
  google_serves_wine TEXT,
  google_short_formatted_address TEXT,
  google_street_parking TEXT,
  google_sub_destinations TEXT,
  google_takeout TEXT,
  google_trendy BOOLEAN,
  google_types TEXT,
  google_upscale BOOLEAN,
  google_url TEXT,
  google_user_rating_count TEXT,
  google_user_ratings_total TEXT,
  google_utc_offset_minutes TEXT,
  google_valet_parking TEXT,
  google_viewport TEXT,
  google_website TEXT,
  google_website_url TEXT,
  google_wheelchair_accessible TEXT,
  google_wifi BOOLEAN,
  groups_friendly BOOLEAN,
  happy_hour BOOLEAN NOT NULL,
  happy_hour_specials TEXT,
  happy_hour_times TEXT,
  has_menu BOOLEAN,
  hero_image TEXT,
  hidden_gem BOOLEAN,
  id VARCHAR(255),
  instagram VARCHAR(255),
  instagram_handle TEXT,
  instagram_url TEXT,
  international_phone TEXT,
  is_active BOOLEAN,
  is_beachfront BOOLEAN,
  is_chain TEXT,
  is_closed BOOLEAN,
  is_featured BOOLEAN,
  is_local TEXT,
  is_open_now TEXT,
  is_tourist_friendly TEXT,
  is_waterfront BOOLEAN,
  keywords TEXT,
  kids_friendly BOOLEAN,
  known_for TEXT,
  last_dispatch_at TEXT,
  last_scraped_at TEXT,
  latitude TEXT,
  live_music BOOLEAN NOT NULL,
  local_favorite BOOLEAN,
  logo_image TEXT,
  logo_url VARCHAR(255) NOT NULL,
  long_description TEXT,
  longitude TEXT,
  main_image TEXT,
  meal_services TEXT,
  menu_images TEXT,
  menu_items TEXT,
  menu_url TEXT,
  messaging_url TEXT,
  music_type TEXT,
  name VARCHAR(255) NOT NULL,
  neighborhood TEXT,
  noise_level TEXT,
  offer_rides BOOLEAN,
  opentable_url TEXT,
  outdoor BOOLEAN,
  outdoor_seating BOOLEAN,
  owner_description TEXT,
  page_category TEXT,
  parking_available BOOLEAN,
  password_hash TEXT,
  pet_friendly BOOLEAN NOT NULL,
  phone TEXT,
  phone_international TEXT,
  place_id VARCHAR(255),
  plan VARCHAR(255),
  plan_type VARCHAR(255),
  price_level TEXT,
  price_range VARCHAR(255) NOT NULL,
  price_range_max TEXT,
  price_range_min TEXT,
  privacy_settings JSONB,
  profile_pic TEXT,
  rating NUMERIC,
  reservation_url TEXT,
  reservations BOOLEAN,
  resy_url TEXT,
  review_count INTEGER,
  romantic BOOLEAN,
  scrape_error TEXT,
  scrape_status TEXT,
  scraped_from TEXT,
  search_tags TEXT,
  serves_breakfast BOOLEAN,
  serves_brunch BOOLEAN,
  serves_dinner BOOLEAN,
  serves_late_night BOOLEAN,
  serves_lunch BOOLEAN,
  short_description TEXT,
  signature_dishes TEXT,
  signature_drinks TEXT,
  signature_items TEXT,
  slug TEXT,
  sort_order INTEGER,
  specialties TEXT,
  state VARCHAR(255),
  status VARCHAR(255),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subcategories TEXT,
  subcategory VARCHAR(255),
  subdomain VARCHAR(255),
  subscription_status VARCHAR(255),
  supports_delivery BOOLEAN,
  supports_dine_in BOOLEAN,
  supports_pickup BOOLEAN,
  supports_reservations BOOLEAN,
  supports_takeout BOOLEAN,
  tagline VARCHAR(255) NOT NULL,
  tags JSONB,
  takeout BOOLEAN,
  tiktok TEXT,
  tiktok_handle TEXT,
  timezone VARCHAR(255),
  tripadvisor_about TEXT,
  tripadvisor_accepts_credit_cards BOOLEAN,
  tripadvisor_address_obj TEXT,
  tripadvisor_amenities TEXT,
  tripadvisor_atmosphere_rating TEXT,
  tripadvisor_average_count TEXT,
  tripadvisor_awards TEXT,
  tripadvisor_bookable BOOLEAN,
  tripadvisor_booking_url TEXT,
  tripadvisor_categories TEXT,
  tripadvisor_certificate_of_excellence BOOLEAN,
  tripadvisor_cuisine TEXT,
  tripadvisor_cuisines TEXT,
  tripadvisor_description TEXT,
  tripadvisor_dietary_restrictions TEXT,
  tripadvisor_distance_string TEXT,
  tripadvisor_duration TEXT,
  tripadvisor_email TEXT,
  tripadvisor_establishment_types TEXT,
  tripadvisor_excellent_count TEXT,
  tripadvisor_features TEXT,
  tripadvisor_food_rating TEXT,
  tripadvisor_free_wifi BOOLEAN,
  tripadvisor_full_bar BOOLEAN,
  tripadvisor_good_for TEXT,
  tripadvisor_highchairs BOOLEAN,
  tripadvisor_hours TEXT,
  tripadvisor_live_music BOOLEAN,
  tripadvisor_location_id TEXT,
  tripadvisor_meals TEXT,
  tripadvisor_menu_url TEXT,
  tripadvisor_name TEXT,
  tripadvisor_neighborhood TEXT,
  tripadvisor_num_reviews TEXT,
  tripadvisor_outdoor_seating BOOLEAN,
  tripadvisor_parking BOOLEAN,
  tripadvisor_phone TEXT,
  tripadvisor_photo_count TEXT,
  tripadvisor_photos TEXT,
  tripadvisor_poor_count TEXT,
  tripadvisor_price_level TEXT,
  tripadvisor_ranking TEXT,
  tripadvisor_ranking_category TEXT,
  tripadvisor_ranking_geo TEXT,
  tripadvisor_ranking_string TEXT,
  tripadvisor_rating TEXT,
  tripadvisor_rating_image_url TEXT,
  tripadvisor_raw_data TEXT,
  tripadvisor_reservations BOOLEAN,
  tripadvisor_reserve_url TEXT,
  tripadvisor_review_count TEXT,
  tripadvisor_reviews TEXT,
  tripadvisor_reviews_count TEXT,
  tripadvisor_seating BOOLEAN,
  tripadvisor_serves_alcohol BOOLEAN,
  tripadvisor_service_rating TEXT,
  tripadvisor_special_diets TEXT,
  tripadvisor_subcategories TEXT,
  tripadvisor_suggested_duration TEXT,
  tripadvisor_table_service BOOLEAN,
  tripadvisor_tagline TEXT,
  tripadvisor_tags TEXT,
  tripadvisor_terrible_count TEXT,
  tripadvisor_travelers_choice BOOLEAN,
  tripadvisor_trip_types TEXT,
  tripadvisor_tv BOOLEAN,
  tripadvisor_url TEXT,
  tripadvisor_value_rating TEXT,
  tripadvisor_very_good_count TEXT,
  tripadvisor_website TEXT,
  tripadvisor_wheelchair_accessible BOOLEAN,
  twilio_phone_number TEXT,
  twilio_phone_sid TEXT,
  twitter_handle TEXT,
  twitter_url TEXT,
  type VARCHAR(255),
  updated_at TIMESTAMP NOT NULL,
  vegan BOOLEAN,
  vegetarian BOOLEAN,
  vicinity TEXT,
  waterfront BOOLEAN,
  waterfront_type TEXT,
  website_url TEXT,
  weekly_specials TEXT,
  wheelchair_accessible BOOLEAN,
  wifi_available BOOLEAN,
  yelp_alias TEXT,
  yelp_attributes TEXT,
  yelp_categories TEXT,
  yelp_display_phone TEXT,
  yelp_distance TEXT,
  yelp_hot_and_new BOOLEAN,
  yelp_hours TEXT,
  yelp_id TEXT,
  yelp_is_claimed TEXT,
  yelp_is_closed BOOLEAN,
  yelp_menu_url TEXT,
  yelp_messaging TEXT,
  yelp_phone TEXT,
  yelp_photos TEXT,
  yelp_price TEXT,
  yelp_rating TEXT,
  yelp_raw_data TEXT,
  yelp_reservation_url TEXT,
  yelp_review_count INTEGER,
  yelp_transactions TEXT,
  yelp_url TEXT,
  zip TEXT,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_businesses_created ON businesses(created_at);
COMMENT ON TABLE businesses IS '210 records';

CREATE TABLE IF NOT EXISTS connections (
  _source VARCHAR(255) NOT NULL,
  access_token VARCHAR(255) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  connected_at TIMESTAMP NOT NULL,
  id VARCHAR(255) NOT NULL,
  metadata JSONB NOT NULL,
  provider VARCHAR(255) NOT NULL,
  refresh_token VARCHAR(255) NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  status VARCHAR(255) NOT NULL,
  token_expires_at TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_connections_created ON connections(created_at);
COMMENT ON TABLE connections IS '9 records';

CREATE TABLE IF NOT EXISTS conversions (
  _source VARCHAR(255) NOT NULL,
  booking_id TEXT NOT NULL,
  conversion_type VARCHAR(255) NOT NULL,
  conversion_value INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  id INTEGER NOT NULL,
  metadata TEXT NOT NULL,
  referrer TEXT NOT NULL,
  revenue INTEGER NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_medium TEXT NOT NULL,
  utm_source TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_conversions_created ON conversions(created_at);
COMMENT ON TABLE conversions IS '1 records';

CREATE TABLE IF NOT EXISTS coupons (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  amount INTEGER NOT NULL,
  code VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  description VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  id VARCHAR(255) NOT NULL,
  max_uses TEXT NOT NULL,
  min_order INTEGER NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  uses_count INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_coupons_created ON coupons(created_at);
COMMENT ON TABLE coupons IS '1 records';

CREATE TABLE IF NOT EXISTS customers (
  _source VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  email VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  last_visit TIMESTAMP NOT NULL,
  loyalty_number TEXT,
  loyalty_points INTEGER,
  name VARCHAR(255) NOT NULL,
  notes TEXT NOT NULL,
  phone INTEGER NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  site_id TEXT,
  tags JSONB NOT NULL,
  tier VARCHAR(255) NOT NULL,
  total_bookings INTEGER NOT NULL,
  total_orders INTEGER NOT NULL,
  total_spent NUMERIC NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_customers_created ON customers(created_at);
COMMENT ON TABLE customers IS '56 records';

CREATE TABLE IF NOT EXISTS drink_items (
  _source VARCHAR(255) NOT NULL,
  abv TEXT NOT NULL,
  brewery TEXT NOT NULL,
  description VARCHAR(255) NOT NULL,
  drink_section_id VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  ibu TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  is_available BOOLEAN NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  item_style TEXT NOT NULL,
  modifiers JSONB NOT NULL,
  price NUMERIC NOT NULL,
  price_text VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  tags JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_drink_items_created ON drink_items(created_at);
COMMENT ON TABLE drink_items IS '833 records';

CREATE TABLE IF NOT EXISTS drink_sections (
  _source VARCHAR(255) NOT NULL,
  available_days TEXT NOT NULL,
  available_end TEXT NOT NULL,
  available_start TEXT NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  section_name VARCHAR(255) NOT NULL,
  section_note TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_drink_sections_created ON drink_sections(created_at);
COMMENT ON TABLE drink_sections IS '248 records';

CREATE TABLE IF NOT EXISTS entity (
  _source VARCHAR(255) NOT NULL,
  accessibility JSONB NOT NULL,
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 TEXT NOT NULL,
  advance_booking_required BOOLEAN NOT NULL,
  booking_url VARCHAR(255) NOT NULL,
  business_status VARCHAR(255) NOT NULL,
  call_url VARCHAR(255) NOT NULL,
  cancellation_policy TEXT NOT NULL,
  capacity_max TEXT NOT NULL,
  capacity_min TEXT NOT NULL,
  city VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  delivery BOOLEAN NOT NULL,
  description VARCHAR(255) NOT NULL,
  difficulty_level TEXT NOT NULL,
  dine_in BOOLEAN NOT NULL,
  directions_url VARCHAR(255) NOT NULL,
  duration_text VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  entity_subtype VARCHAR(255) NOT NULL,
  entity_type VARCHAR(255) NOT NULL,
  featured BOOLEAN NOT NULL,
  good_for_children BOOLEAN NOT NULL,
  good_for_groups BOOLEAN NOT NULL,
  good_for_sports BOOLEAN NOT NULL,
  google_places_id VARCHAR(255) NOT NULL,
  hero_image_url VARCHAR(255) NOT NULL,
  hh_days VARCHAR(255) NOT NULL,
  hh_description TEXT NOT NULL,
  hh_end VARCHAR(255) NOT NULL,
  hh_start VARCHAR(255) NOT NULL,
  icon VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL,
  is_free_tier BOOLEAN NOT NULL,
  is_open_now TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  legacy_site_id VARCHAR(255) NOT NULL,
  live_music BOOLEAN NOT NULL,
  location_city VARCHAR(255) NOT NULL,
  longitude NUMERIC NOT NULL,
  max_weight TEXT NOT NULL,
  meeting_point VARCHAR(255) NOT NULL,
  min_age TEXT NOT NULL,
  min_weight TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  order_url TEXT NOT NULL,
  outdoor_seating BOOLEAN NOT NULL,
  parent_entity_id TEXT NOT NULL,
  parking JSONB NOT NULL,
  payment_options JSONB NOT NULL,
  phone VARCHAR(255) NOT NULL,
  phone_international VARCHAR(255) NOT NULL,
  place_types JSONB NOT NULL,
  price_from INTEGER NOT NULL,
  price_range VARCHAR(255) NOT NULL,
  price_to TEXT NOT NULL,
  price_unit TEXT NOT NULL,
  rating NUMERIC NOT NULL,
  reservation_url TEXT NOT NULL,
  review_count INTEGER NOT NULL,
  secondary_types TEXT NOT NULL,
  serves_beer BOOLEAN NOT NULL,
  serves_breakfast BOOLEAN NOT NULL,
  serves_brunch BOOLEAN NOT NULL,
  serves_cocktails BOOLEAN NOT NULL,
  serves_coffee BOOLEAN NOT NULL,
  serves_dessert BOOLEAN NOT NULL,
  serves_dinner BOOLEAN NOT NULL,
  serves_lunch BOOLEAN NOT NULL,
  serves_vegetarian BOOLEAN NOT NULL,
  serves_wine BOOLEAN NOT NULL,
  slug VARCHAR(255) NOT NULL,
  social_facebook VARCHAR(255) NOT NULL,
  social_instagram VARCHAR(255) NOT NULL,
  social_tiktok VARCHAR(255) NOT NULL,
  source VARCHAR(255) NOT NULL,
  state VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) NOT NULL,
  takeout BOOLEAN NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  website_url VARCHAR(255) NOT NULL,
  wheelchair_accessible BOOLEAN NOT NULL,
  zip VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_entity_created ON entity(created_at);
COMMENT ON TABLE entity IS '2235 records';

CREATE TABLE IF NOT EXISTS entity_events (
  _source VARCHAR(255) NOT NULL,
  artist_about TEXT NOT NULL,
  artist_name VARCHAR(255) NOT NULL,
  cover_charge TEXT NOT NULL,
  day_of_week VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  end_time VARCHAR(255) NOT NULL,
  entity_id TEXT,
  event_date TIMESTAMP NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  music_style TEXT NOT NULL,
  place_id VARCHAR(255),
  recurring BOOLEAN NOT NULL,
  recurring_end_date TEXT NOT NULL,
  recurring_start_date TEXT NOT NULL,
  start_time VARCHAR(255) NOT NULL,
  venue_location VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_entity_events_created ON entity_events(created_at);
COMMENT ON TABLE entity_events IS '3289 records';

CREATE TABLE IF NOT EXISTS entity_features (
  _source VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_entity_features_created ON entity_features(created_at);
COMMENT ON TABLE entity_features IS '295 records';

CREATE TABLE IF NOT EXISTS entity_hours (
  _source VARCHAR(255) NOT NULL,
  close_time VARCHAR(255) NOT NULL,
  day_of_week VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  is_closed BOOLEAN NOT NULL,
  open_time VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_entity_hours_created ON entity_hours(created_at);
COMMENT ON TABLE entity_hours IS '7791 records';

CREATE TABLE IF NOT EXISTS entity_perfect_for (
  _source VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_entity_perfect_for_created ON entity_perfect_for(created_at);
COMMENT ON TABLE entity_perfect_for IS '178 records';

CREATE TABLE IF NOT EXISTS entity_photos (
  _source VARCHAR(255) NOT NULL,
  caption VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  is_cover BOOLEAN NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_entity_photos_created ON entity_photos(created_at);
COMMENT ON TABLE entity_photos IS '7118 records';

CREATE TABLE IF NOT EXISTS entity_qna (
  _source VARCHAR(255) NOT NULL,
  answer VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  question VARCHAR(255) NOT NULL,
  section_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_entity_qna_created ON entity_qna(created_at);
COMMENT ON TABLE entity_qna IS '1224 records';

CREATE TABLE IF NOT EXISTS entity_sections (
  _source VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  section_key VARCHAR(255) NOT NULL,
  section_label VARCHAR(255) NOT NULL,
  section_type VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_entity_sections_created ON entity_sections(created_at);
COMMENT ON TABLE entity_sections IS '1120 records';

CREATE TABLE IF NOT EXISTS entity_specials (
  _source VARCHAR(255) NOT NULL,
  days VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  discount_text VARCHAR(255) NOT NULL,
  end_time VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  special_name VARCHAR(255) NOT NULL,
  special_type VARCHAR(255) NOT NULL,
  start_time VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_entity_specials_created ON entity_specials(created_at);
COMMENT ON TABLE entity_specials IS '54 records';

CREATE TABLE IF NOT EXISTS entity_tags (
  _source VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  tag VARCHAR(255) NOT NULL,
  tag_category VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_entity_tags_created ON entity_tags(created_at);
COMMENT ON TABLE entity_tags IS '19275 records';

CREATE TABLE IF NOT EXISTS events (
  _source VARCHAR(255) NOT NULL,
  _table_source VARCHAR(255) NOT NULL,
  active BOOLEAN,
  age_limit TEXT,
  artist_about TEXT,
  artist_id TEXT,
  artist_name VARCHAR(255) NOT NULL,
  category VARCHAR(255),
  cover TEXT,
  cover_charge BOOLEAN NOT NULL,
  created_at TIMESTAMP,
  day_of_week VARCHAR(255),
  description VARCHAR(255) NOT NULL,
  emoji TEXT,
  end_time VARCHAR(255) NOT NULL,
  entity_id TEXT,
  event_date TIMESTAMP NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  event_time TEXT,
  event_type VARCHAR(255),
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  is_active BOOLEAN,
  kids_friendly BOOLEAN,
  music_style TEXT,
  name VARCHAR(255),
  pet_friendly BOOLEAN,
  place_id VARCHAR(255),
  recurring BOOLEAN NOT NULL,
  recurring_day TEXT,
  recurring_end_date TEXT,
  recurring_start_date TEXT,
  start_time VARCHAR(255) NOT NULL,
  ticket_url TEXT,
  time TEXT,
  title VARCHAR(255),
  venue_location VARCHAR(255),
  venue_name TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_events_created ON events(created_at);
COMMENT ON TABLE events IS '3394 records';

CREATE TABLE IF NOT EXISTS faqs (
  _source VARCHAR(255) NOT NULL,
  answer VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  id VARCHAR(255) NOT NULL,
  question VARCHAR(255) NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_faqs_created ON faqs(created_at);
COMMENT ON TABLE faqs IS '5 records';

CREATE TABLE IF NOT EXISTS fleet_items (
  _source VARCHAR(255) NOT NULL,
  capacity TEXT,
  condition VARCHAR(255) NOT NULL,
  created_at TIMESTAMP,
  description VARCHAR(255),
  dimensions TEXT,
  fleet_type_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url VARCHAR(255),
  item_name VARCHAR(255),
  max_capacity_text TEXT,
  notes TEXT,
  place_id VARCHAR(255) NOT NULL,
  serial_number TEXT,
  sort_order INTEGER,
  unit_name VARCHAR(255),
  updated_at TIMESTAMP,
  weight TEXT,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_fleet_items_created ON fleet_items(created_at);
COMMENT ON TABLE fleet_items IS '10 records';

CREATE TABLE IF NOT EXISTS fleet_types (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  available BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  description VARCHAR(255) NOT NULL,
  featured BOOLEAN NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  specs JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_fleet_types_created ON fleet_types(created_at);
COMMENT ON TABLE fleet_types IS '10 records';

CREATE TABLE IF NOT EXISTS gcr_directory (
  _source VARCHAR(255) NOT NULL,
  about_text VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  events JSONB NOT NULL,
  gallery JSONB NOT NULL,
  happy_hour JSONB NOT NULL,
  hours VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image VARCHAR(255) NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  menu JSONB NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(255) NOT NULL,
  price_level INTEGER NOT NULL,
  rating NUMERIC NOT NULL,
  social_links JSONB NOT NULL,
  specials JSONB NOT NULL,
  state VARCHAR(255) NOT NULL,
  subcategory JSONB NOT NULL,
  tags JSONB NOT NULL,
  type VARCHAR(255) NOT NULL,
  user_ratings_total INTEGER NOT NULL,
  website VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_gcr_directory_created ON gcr_directory(created_at);
COMMENT ON TABLE gcr_directory IS '186 records';

CREATE TABLE IF NOT EXISTS gcr_faqs (
  _source VARCHAR(255) NOT NULL,
  answer VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  question VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_gcr_faqs_created ON gcr_faqs(created_at);
COMMENT ON TABLE gcr_faqs IS '15 records';

CREATE TABLE IF NOT EXISTS gcr_menu_items (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  available_days JSONB NOT NULL,
  available_end VARCHAR(255) NOT NULL,
  available_start VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  description VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  menu_type VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price VARCHAR(255) NOT NULL,
  price_variants JSONB NOT NULL,
  section VARCHAR(255) NOT NULL,
  section_order INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  subdomain VARCHAR(255) NOT NULL,
  tags JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_gcr_menu_items_created ON gcr_menu_items(created_at);
COMMENT ON TABLE gcr_menu_items IS '30 records';

CREATE TABLE IF NOT EXISTS gcr_page_views (
  _source VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  country VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  device_type VARCHAR(255) NOT NULL,
  duration_secs INTEGER NOT NULL,
  entity_id TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  ip_address VARCHAR(255) NOT NULL,
  page_path VARCHAR(255) NOT NULL,
  page_title VARCHAR(255) NOT NULL,
  referrer VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  source VARCHAR(255) NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT NOT NULL,
  utm_medium TEXT NOT NULL,
  utm_source TEXT NOT NULL,
  utm_term TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_gcr_page_views_created ON gcr_page_views(created_at);
COMMENT ON TABLE gcr_page_views IS '345 records';

CREATE TABLE IF NOT EXISTS gcr_reviews (
  _source VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone TEXT NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  photos JSONB NOT NULL,
  rating INTEGER NOT NULL,
  review_method VARCHAR(255) NOT NULL,
  review_text VARCHAR(255) NOT NULL,
  source VARCHAR(255) NOT NULL,
  status VARCHAR(255) NOT NULL,
  token TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_gcr_reviews_created ON gcr_reviews(created_at);
COMMENT ON TABLE gcr_reviews IS '1056 records';

CREATE TABLE IF NOT EXISTS happy_hour_items (
  _source VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  hh_price NUMERIC NOT NULL,
  hh_section_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  modifiers JSONB NOT NULL,
  price_text TEXT NOT NULL,
  regular_price TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  tags JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_happy_hour_items_created ON happy_hour_items(created_at);
COMMENT ON TABLE happy_hour_items IS '84 records';

CREATE TABLE IF NOT EXISTS happy_hour_sections (
  _source VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  section_name VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_happy_hour_sections_created ON happy_hour_sections(created_at);
COMMENT ON TABLE happy_hour_sections IS '57 records';

CREATE TABLE IF NOT EXISTS locations (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  address VARCHAR(255) NOT NULL,
  city TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  id VARCHAR(255) NOT NULL,
  is_primary BOOLEAN NOT NULL,
  lat TEXT NOT NULL,
  lng TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  notes TEXT NOT NULL,
  phone TEXT NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  state TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  zip TEXT NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_locations_created ON locations(created_at);
COMMENT ON TABLE locations IS '5 records';

CREATE TABLE IF NOT EXISTS media (
  _source VARCHAR(255) NOT NULL,
  alt_text TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  folder VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP NOT NULL,
  url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_media_created ON media(created_at);
COMMENT ON TABLE media IS '59 records';

CREATE TABLE IF NOT EXISTS meeting_points (
  _source VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  checkin_instructions TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  location_name TEXT NOT NULL,
  parking_info TEXT NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  what_to_bring TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_meeting_points_created ON meeting_points(created_at);
COMMENT ON TABLE meeting_points IS '4 records';

CREATE TABLE IF NOT EXISTS menu_categories (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  description TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  time_end VARCHAR(255) NOT NULL,
  time_start VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_menu_categories_created ON menu_categories(created_at);
COMMENT ON TABLE menu_categories IS '2 records';

CREATE TABLE IF NOT EXISTS menu_items (
  _source VARCHAR(255) NOT NULL,
  allergens JSONB NOT NULL,
  available BOOLEAN,
  category VARCHAR(255),
  created_at TIMESTAMP,
  description VARCHAR(255) NOT NULL,
  extra_photos JSONB,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  ingredients TEXT,
  is_available BOOLEAN,
  item_name VARCHAR(255) NOT NULL,
  item_type VARCHAR(255) NOT NULL,
  menu_section_id VARCHAR(255),
  menu_sub_section_id TEXT,
  modifiers JSONB,
  name VARCHAR(255),
  photo_url TEXT,
  place_id VARCHAR(255) NOT NULL,
  price INTEGER NOT NULL,
  price_text VARCHAR(255),
  sort_order INTEGER NOT NULL,
  subcategory TEXT,
  tags JSONB NOT NULL,
  updated_at TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_menu_items_created ON menu_items(created_at);
COMMENT ON TABLE menu_items IS '8737 records';

CREATE TABLE IF NOT EXISTS menu_sections (
  _source VARCHAR(255) NOT NULL,
  available_days TEXT NOT NULL,
  available_end TEXT NOT NULL,
  available_start TEXT NOT NULL,
  icon TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  section_description TEXT NOT NULL,
  section_name VARCHAR(255) NOT NULL,
  section_note TEXT NOT NULL,
  show_on_links_page BOOLEAN NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_menu_sections_created ON menu_sections(created_at);
COMMENT ON TABLE menu_sections IS '1637 records';

CREATE TABLE IF NOT EXISTS menu_subcategories (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  category_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  description TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_menu_subcategories_created ON menu_subcategories(created_at);
COMMENT ON TABLE menu_subcategories IS '4 records';

CREATE TABLE IF NOT EXISTS messages (
  _source VARCHAR(255) NOT NULL,
  body VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone INTEGER NOT NULL,
  direction VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  media_url TEXT NOT NULL,
  message_type VARCHAR(255) NOT NULL,
  read BOOLEAN NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  twilio_sid TEXT NOT NULL,
  twilio_status TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_messages_created ON messages(created_at);
COMMENT ON TABLE messages IS '3 records';

CREATE TABLE IF NOT EXISTS messaging_settings (
  _source VARCHAR(255) NOT NULL,
  customer_booking_template VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  notification_email VARCHAR(255) NOT NULL,
  notification_email_2 TEXT,
  notification_phone VARCHAR(255) NOT NULL,
  notify_customer_on_booking BOOLEAN NOT NULL,
  notify_customer_on_cancel BOOLEAN NOT NULL,
  notify_owner_on_booking BOOLEAN NOT NULL,
  notify_owner_on_booking_whatsapp BOOLEAN,
  notify_owner_on_cancel BOOLEAN NOT NULL,
  owner_booking_template VARCHAR(255) NOT NULL,
  owner_phone VARCHAR(255) NOT NULL,
  owner_sms_consent BOOLEAN,
  owner_sms_consent_at TIMESTAMP,
  owner_sms_consent_text VARCHAR(255),
  photo_gallery_enabled BOOLEAN NOT NULL,
  photo_gallery_section VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  voice_ai_enabled BOOLEAN NOT NULL,
  voice_greeting VARCHAR(255) NOT NULL,
  whatsapp_access_token VARCHAR(255),
  whatsapp_connected BOOLEAN,
  whatsapp_phone_number TEXT,
  whatsapp_phone_number_id INTEGER,
  whatsapp_waba_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_messaging_settings_created ON messaging_settings(created_at);
COMMENT ON TABLE messaging_settings IS '2 records';

CREATE TABLE IF NOT EXISTS module_manifest (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  category VARCHAR(255) NOT NULL,
  config_schema TEXT NOT NULL,
  description VARCHAR(255) NOT NULL,
  icon VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  is_core BOOLEAN NOT NULL,
  js_path VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price_monthly INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_module_manifest_created ON module_manifest(created_at);
COMMENT ON TABLE module_manifest IS '45 records';

CREATE TABLE IF NOT EXISTS notifications (
  _source VARCHAR(255) NOT NULL,
  body VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  entity_id VARCHAR(255),
  id VARCHAR(255) NOT NULL,
  metadata JSONB NOT NULL,
  read BOOLEAN NOT NULL,
  site_id VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_notifications_created ON notifications(created_at);
COMMENT ON TABLE notifications IS '146 records';

CREATE TABLE IF NOT EXISTS page_events (
  _source VARCHAR(255) NOT NULL,
  event VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  page VARCHAR(255) NOT NULL,
  site VARCHAR(255) NOT NULL,
  source VARCHAR(255) NOT NULL,
  ts TIMESTAMP NOT NULL,
  user_agent VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_page_events_created ON page_events(created_at);
COMMENT ON TABLE page_events IS '247 records';

CREATE TABLE IF NOT EXISTS page_views (
  _source VARCHAR(255) NOT NULL,
  browser VARCHAR(255) NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  device_type VARCHAR(255) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  id INTEGER NOT NULL,
  ip_address VARCHAR(255),
  os VARCHAR(255) NOT NULL,
  page_path VARCHAR(255) NOT NULL,
  page_title VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  referrer VARCHAR(255) NOT NULL,
  region TEXT NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  user_id TEXT,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT,
  utm_medium TEXT NOT NULL,
  utm_source VARCHAR(255) NOT NULL,
  utm_term TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_page_views_created ON page_views(created_at);
COMMENT ON TABLE page_views IS '3977 records';

CREATE TABLE IF NOT EXISTS platform_config (
  _source VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  value VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_platform_config_created ON platform_config(created_at);
COMMENT ON TABLE platform_config IS '3 records';

CREATE TABLE IF NOT EXISTS platform_settings (
  _source VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_platform_settings_created ON platform_settings(created_at);
COMMENT ON TABLE platform_settings IS '2 records';

CREATE TABLE IF NOT EXISTS policies (
  _source VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  policy_text VARCHAR(255) NOT NULL,
  policy_type VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_policies_created ON policies(created_at);
COMMENT ON TABLE policies IS '5 records';

CREATE TABLE IF NOT EXISTS pricing_items (
  _source VARCHAR(255) NOT NULL,
  available_days TEXT NOT NULL,
  description VARCHAR(255) NOT NULL,
  duration VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  max_people TEXT NOT NULL,
  min_people TEXT NOT NULL,
  package_name VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  price NUMERIC NOT NULL,
  price_text VARCHAR(255) NOT NULL,
  price_unit VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  time_slot_end TEXT NOT NULL,
  time_slot_start VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_pricing_items_created ON pricing_items(created_at);
COMMENT ON TABLE pricing_items IS '35 records';

CREATE TABLE IF NOT EXISTS requirements (
  _source VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  requirement_text VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_requirements_created ON requirements(created_at);
COMMENT ON TABLE requirements IS '33 records';

CREATE TABLE IF NOT EXISTS reviews (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  booking_id TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  original_voice_text TEXT NOT NULL,
  photo_added_to_gallery BOOLEAN NOT NULL,
  photos JSONB NOT NULL,
  published_to_site BOOLEAN NOT NULL,
  rating INTEGER NOT NULL,
  review_method VARCHAR(255) NOT NULL,
  review_token TEXT NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  status VARCHAR(255) NOT NULL,
  text VARCHAR(255) NOT NULL,
  token_used BOOLEAN NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_reviews_created ON reviews(created_at);
COMMENT ON TABLE reviews IS '267 records';

CREATE TABLE IF NOT EXISTS robots_config (
  _source VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  id VARCHAR(255) NOT NULL,
  robots_txt VARCHAR(255) NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_robots_config_created ON robots_config(created_at);
COMMENT ON TABLE robots_config IS '1 records';

CREATE TABLE IF NOT EXISTS sales_leads (
  _source VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  email VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  notes TEXT NOT NULL,
  phone INTEGER NOT NULL,
  sms_consent BOOLEAN NOT NULL,
  source VARCHAR(255) NOT NULL,
  status VARCHAR(255) NOT NULL,
  updated_at TEXT NOT NULL,
  website_url TEXT NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_sales_leads_created ON sales_leads(created_at);
COMMENT ON TABLE sales_leads IS '3 records';

CREATE TABLE IF NOT EXISTS section_bullets (
  _source VARCHAR(255) NOT NULL,
  bullet_text VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_section_bullets_created ON section_bullets(created_at);
COMMENT ON TABLE section_bullets IS '848 records';

CREATE TABLE IF NOT EXISTS section_cards (
  _source VARCHAR(255) NOT NULL,
  badge_text VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT NOT NULL,
  price_text VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  subtitle VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_section_cards_created ON section_cards(created_at);
COMMENT ON TABLE section_cards IS '46 records';

CREATE TABLE IF NOT EXISTS section_groups (
  _source VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  note_text VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  subtitle VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_section_groups_created ON section_groups(created_at);
COMMENT ON TABLE section_groups IS '517 records';

CREATE TABLE IF NOT EXISTS section_hours (
  _source VARCHAR(255) NOT NULL,
  close_time VARCHAR(255) NOT NULL,
  day_of_week VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  is_closed BOOLEAN NOT NULL,
  note_text VARCHAR(255) NOT NULL,
  open_time VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_section_hours_created ON section_hours(created_at);
COMMENT ON TABLE section_hours IS '2335 records';

CREATE TABLE IF NOT EXISTS section_items (
  _source VARCHAR(255) NOT NULL,
  group_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  item_description VARCHAR(255) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  item_type VARCHAR(255) NOT NULL,
  metadata_json JSONB NOT NULL,
  price_label VARCHAR(255) NOT NULL,
  price_max INTEGER NOT NULL,
  price_min INTEGER NOT NULL,
  price_numeric INTEGER NOT NULL,
  price_text VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  unit_label VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_section_items_created ON section_items(created_at);
COMMENT ON TABLE section_items IS '1501 records';

CREATE TABLE IF NOT EXISTS section_location (
  _source VARCHAR(255) NOT NULL,
  address_line_1 VARCHAR(255) NOT NULL,
  address_line_2 TEXT NOT NULL,
  city VARCHAR(255) NOT NULL,
  directions_url VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  latitude TEXT NOT NULL,
  longitude TEXT NOT NULL,
  note_text VARCHAR(255) NOT NULL,
  phone VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  state VARCHAR(255) NOT NULL,
  website_url VARCHAR(255) NOT NULL,
  zip INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_section_location_created ON section_location(created_at);
COMMENT ON TABLE section_location IS '65 records';

CREATE TABLE IF NOT EXISTS section_photos (
  _source VARCHAR(255) NOT NULL,
  alt_text VARCHAR(255) NOT NULL,
  caption VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_section_photos_created ON section_photos(created_at);
COMMENT ON TABLE section_photos IS '689 records';

CREATE TABLE IF NOT EXISTS section_reviews (
  _source VARCHAR(255) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL,
  review_date TEXT NOT NULL,
  review_text VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  source VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_section_reviews_created ON section_reviews(created_at);
COMMENT ON TABLE section_reviews IS '1296 records';

CREATE TABLE IF NOT EXISTS section_rich_text (
  _source VARCHAR(255) NOT NULL,
  body_text VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  section_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_section_rich_text_created ON section_rich_text(created_at);
COMMENT ON TABLE section_rich_text IS '211 records';

CREATE TABLE IF NOT EXISTS seo_meta_tags (
  _source VARCHAR(255) NOT NULL,
  canonical_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  id VARCHAR(255) NOT NULL,
  meta_description VARCHAR(255) NOT NULL,
  meta_keywords TEXT NOT NULL,
  og_description VARCHAR(255) NOT NULL,
  og_image TEXT NOT NULL,
  og_title VARCHAR(255) NOT NULL,
  og_type VARCHAR(255) NOT NULL,
  page_slug VARCHAR(255) NOT NULL,
  page_title VARCHAR(255) NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  robots VARCHAR(255) NOT NULL,
  schema_json JSONB NOT NULL,
  twitter_card VARCHAR(255) NOT NULL,
  twitter_description TEXT NOT NULL,
  twitter_image TEXT NOT NULL,
  twitter_title TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_seo_meta_tags_created ON seo_meta_tags(created_at);
COMMENT ON TABLE seo_meta_tags IS '8 records';

CREATE TABLE IF NOT EXISTS site_apps (
  _source VARCHAR(255) NOT NULL,
  app_id VARCHAR(255) NOT NULL,
  config JSONB NOT NULL,
  enabled BOOLEAN NOT NULL,
  id VARCHAR(255) NOT NULL,
  installed_at TIMESTAMP NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_site_apps_created ON site_apps(created_at);
COMMENT ON TABLE site_apps IS '8 records';

CREATE TABLE IF NOT EXISTS site_content (
  _source VARCHAR(255) NOT NULL,
  about_text VARCHAR(255) NOT NULL,
  address VARCHAR(255) NOT NULL,
  book_a_bay JSONB NOT NULL,
  city VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(255) NOT NULL,
  cover_url VARCHAR(255) NOT NULL,
  cta_banner TEXT NOT NULL,
  custom_css TEXT NOT NULL,
  custom_sections TEXT NOT NULL,
  docks JSONB NOT NULL,
  facebook_pixel_id TEXT NOT NULL,
  faq TEXT NOT NULL,
  features JSONB NOT NULL,
  footer JSONB NOT NULL,
  ga4_id TEXT NOT NULL,
  gallery JSONB NOT NULL,
  games JSONB NOT NULL,
  google_maps VARCHAR(255) NOT NULL,
  group_rate JSONB NOT NULL,
  happy_hour JSONB NOT NULL,
  hero_cta_text VARCHAR(255) NOT NULL,
  hero_cta_url VARCHAR(255) NOT NULL,
  hero_subtext VARCHAR(255) NOT NULL,
  hero_text VARCHAR(255) NOT NULL,
  hero_video_url VARCHAR(255) NOT NULL,
  highlights JSONB NOT NULL,
  hours JSONB NOT NULL,
  hours_note VARCHAR(255) NOT NULL,
  how_it_works TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  league JSONB NOT NULL,
  links_page JSONB NOT NULL,
  lng NUMERIC NOT NULL,
  locations JSONB NOT NULL,
  logo_url VARCHAR(255) NOT NULL,
  messaging_settings JSONB NOT NULL,
  modules TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  packages JSONB NOT NULL,
  perfect_for JSONB NOT NULL,
  policies JSONB NOT NULL,
  qna JSONB NOT NULL,
  restrictions JSONB NOT NULL,
  review_questions JSONB NOT NULL,
  schedules JSONB NOT NULL,
  seo_description VARCHAR(255) NOT NULL,
  seo_title VARCHAR(255) NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  social_links JSONB NOT NULL,
  state VARCHAR(255) NOT NULL,
  steps JSONB NOT NULL,
  theme_color VARCHAR(255) NOT NULL,
  theme_font VARCHAR(255) NOT NULL,
  twilio_number TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  website_url VARCHAR(255) NOT NULL,
  what_to_bring TEXT NOT NULL,
  whats_included JSONB NOT NULL,
  zip INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_site_content_created ON site_content(created_at);
COMMENT ON TABLE site_content IS '206 records';

CREATE TABLE IF NOT EXISTS site_data_store (
  _source VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_site_data_store_created ON site_data_store(created_at);
COMMENT ON TABLE site_data_store IS '2 records';

CREATE TABLE IF NOT EXISTS site_pages (
  _source VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  html_content TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  page_type TEXT NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  visible BOOLEAN NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_site_pages_created ON site_pages(created_at);
COMMENT ON TABLE site_pages IS '20 records';

CREATE TABLE IF NOT EXISTS sitemap_config (
  _source VARCHAR(255) NOT NULL,
  auto_generate BOOLEAN NOT NULL,
  change_frequency VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  custom_urls TEXT NOT NULL,
  excluded_urls TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  include_blog BOOLEAN NOT NULL,
  include_pages BOOLEAN NOT NULL,
  last_generated_at TEXT NOT NULL,
  priority NUMERIC NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_sitemap_config_created ON sitemap_config(created_at);
COMMENT ON TABLE sitemap_config IS '1 records';

CREATE TABLE IF NOT EXISTS sms_campaigns (
  _source VARCHAR(255) NOT NULL,
  audience VARCHAR(255) NOT NULL,
  coupon_code TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  entity_id VARCHAR(255),
  failed_count INTEGER NOT NULL,
  id VARCHAR(255) NOT NULL,
  message VARCHAR(255) NOT NULL,
  recipient_count INTEGER NOT NULL,
  sent_count INTEGER NOT NULL,
  site_id VARCHAR(255),
  status VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_sms_campaigns_created ON sms_campaigns(created_at);
COMMENT ON TABLE sms_campaigns IS '28 records';

CREATE TABLE IF NOT EXISTS sms_log (
  _source VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  entity_id VARCHAR(255),
  id VARCHAR(255) NOT NULL,
  message VARCHAR(255) NOT NULL,
  metadata JSONB NOT NULL,
  related_id VARCHAR(255) NOT NULL,
  site_id VARCHAR(255),
  status VARCHAR(255) NOT NULL,
  to_phone VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_sms_log_created ON sms_log(created_at);
COMMENT ON TABLE sms_log IS '217 records';

CREATE TABLE IF NOT EXISTS specials (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  days JSONB NOT NULL,
  description VARCHAR(255) NOT NULL,
  discount VARCHAR(255) NOT NULL,
  discount_amount TEXT NOT NULL,
  discount_text VARCHAR(255) NOT NULL,
  discount_type TEXT NOT NULL,
  drink_specials JSONB NOT NULL,
  end_time VARCHAR(255) NOT NULL,
  gcr_category TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  items JSONB NOT NULL,
  items_list JSONB NOT NULL,
  name VARCHAR(255) NOT NULL,
  recurring BOOLEAN NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  start_time VARCHAR(255) NOT NULL,
  type VARCHAR(255) NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_specials_created ON specials(created_at);
COMMENT ON TABLE specials IS '91 records';

CREATE TABLE IF NOT EXISTS staff (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  bio TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  email TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(255) NOT NULL,
  photo_url TEXT NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_staff_created ON staff(created_at);
COMMENT ON TABLE staff IS '8 records';

CREATE TABLE IF NOT EXISTS tourist_group_members (
  _source VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  group_id VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_tourist_group_members_created ON tourist_group_members(created_at);
COMMENT ON TABLE tourist_group_members IS '1 records';

CREATE TABLE IF NOT EXISTS tourist_groups (
  _source VARCHAR(255) NOT NULL,
  arrival TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  departure TEXT NOT NULL,
  destination VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  invite_code VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  owner_user_id VARCHAR(255) NOT NULL,
  sharing_mode VARCHAR(255) NOT NULL,
  sharing_until TEXT NOT NULL,
  slug VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_tourist_groups_created ON tourist_groups(created_at);
COMMENT ON TABLE tourist_groups IS '1 records';

CREATE TABLE IF NOT EXISTS tourist_itineraries (
  _source VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  days JSONB NOT NULL,
  destination VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  model_used VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_tourist_itineraries_created ON tourist_itineraries(created_at);
COMMENT ON TABLE tourist_itineraries IS '2 records';

CREATE TABLE IF NOT EXISTS tourist_profiles (
  _source VARCHAR(255) NOT NULL,
  answers JSONB NOT NULL,
  arrival TIMESTAMP NOT NULL,
  budget VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  departure TIMESTAMP NOT NULL,
  destination VARCHAR(255) NOT NULL,
  group_type VARCHAR(255) NOT NULL,
  hotel_name VARCHAR(255) NOT NULL,
  interests JSONB NOT NULL,
  name VARCHAR(255) NOT NULL,
  setup_complete BOOLEAN NOT NULL,
  stay_status VARCHAR(255) NOT NULL,
  trip_days INTEGER NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_tourist_profiles_created ON tourist_profiles(created_at);
COMMENT ON TABLE tourist_profiles IS '2 records';

CREATE TABLE IF NOT EXISTS tourist_saves (
  _source VARCHAR(255) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  entity_slug VARCHAR(255) NOT NULL,
  group_id TEXT NOT NULL,
  hero_image_url VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  price_range VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL,
  saved_at TIMESTAMP NOT NULL,
  subtitle VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_tourist_saves_created ON tourist_saves(created_at);
COMMENT ON TABLE tourist_saves IS '117 records';

CREATE TABLE IF NOT EXISTS tourist_setup_questions (
  _source VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  id VARCHAR(255) NOT NULL,
  input_type VARCHAR(255) NOT NULL,
  key VARCHAR(255) NOT NULL,
  label VARCHAR(255) NOT NULL,
  options JSONB NOT NULL,
  placeholder VARCHAR(255) NOT NULL,
  required BOOLEAN NOT NULL,
  sort_order INTEGER NOT NULL,
  subtitle VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_tourist_setup_questions_created ON tourist_setup_questions(created_at);
COMMENT ON TABLE tourist_setup_questions IS '9 records';

CREATE TABLE IF NOT EXISTS tripswipe_business_settings (
  _source VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL,
  extra_images JSONB NOT NULL,
  hero_image TEXT NOT NULL,
  slug VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_tripswipe_business_settings_created ON tripswipe_business_settings(created_at);
COMMENT ON TABLE tripswipe_business_settings IS '318 records';

CREATE TABLE IF NOT EXISTS update_links (
  _source VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  fields_config TEXT NOT NULL,
  id VARCHAR(255) NOT NULL,
  link_date TIMESTAMP NOT NULL,
  link_type VARCHAR(255) NOT NULL,
  send_phone TEXT NOT NULL,
  submitted_at TIMESTAMP NOT NULL,
  submitted_data TEXT NOT NULL,
  token VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_update_links_created ON update_links(created_at);
COMMENT ON TABLE update_links IS '3 records';

CREATE TABLE IF NOT EXISTS users (
  _source VARCHAR(255) NOT NULL,
  auth_id VARCHAR(255),
  auth_user_id TEXT,
  avatar_url TEXT NOT NULL,
  business_id VARCHAR(255),
  business_name VARCHAR(255),
  created_at TIMESTAMP NOT NULL,
  deleted_at TEXT,
  email VARCHAR(255) NOT NULL,
  email_verified BOOLEAN,
  first_name VARCHAR(255),
  full_name VARCHAR(255),
  id VARCHAR(255) NOT NULL,
  is_active BOOLEAN,
  last_login_at TEXT,
  last_name VARCHAR(255),
  name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  permissions JSONB,
  phone VARCHAR(255),
  place_id VARCHAR(255),
  reset_expires TIMESTAMP,
  reset_token VARCHAR(255),
  role VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_users_created ON users(created_at);
COMMENT ON TABLE users IS '29 records';

CREATE TABLE IF NOT EXISTS waivers (
  _source VARCHAR(255) NOT NULL,
  booking_id VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  id VARCHAR(255) NOT NULL,
  ip_address TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  signed_at TIMESTAMP NOT NULL,
  site_id VARCHAR(255) NOT NULL,
  waiver_text VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) WITH (OIDS=FALSE);
CREATE INDEX idx_waivers_created ON waivers(created_at);
COMMENT ON TABLE waivers IS '11 records';
