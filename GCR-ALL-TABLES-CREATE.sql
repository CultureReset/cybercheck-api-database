-- ============================================
-- GCR COMPLETE TABLE SCHEMA
-- Paste ALL of this into Supabase SQL Editor
-- ============================================

-- 1. CORE ENTITY TABLES
CREATE TABLE IF NOT EXISTS entity (id UUID PRIMARY KEY, name VARCHAR(255), slug VARCHAR(255) UNIQUE, entity_type VARCHAR(50), entity_subtype VARCHAR(50), website_url TEXT, phone VARCHAR(20), address_line_1 TEXT, city VARCHAR(100), state VARCHAR(50), zip VARCHAR(10), lat DECIMAL(10,7), lng DECIMAL(10,7), description TEXT, rating DECIMAL(3,1), reviews_count INT, place_id VARCHAR(255) UNIQUE, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());

-- 2. BUSINESS/ENTITY METADATA
CREATE TABLE IF NOT EXISTS entity_tags (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, tag VARCHAR(100), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS entity_features (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, feature VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS entity_about_bullets (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, bullet_text TEXT, sort_order INT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS entity_perfect_for (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, category VARCHAR(100), created_at TIMESTAMPTZ DEFAULT NOW());

-- 3. HOURS & AVAILABILITY
CREATE TABLE IF NOT EXISTS entity_hours (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, day_of_week VARCHAR(10), open_time TIME, close_time TIME, is_closed BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW());

-- 4. MENU SYSTEM
CREATE TABLE IF NOT EXISTS menu_sections (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, section_name VARCHAR(255), sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS menu_sub_sections (id UUID PRIMARY KEY, menu_section_id UUID NOT NULL REFERENCES menu_sections(id) ON DELETE CASCADE, subsection_name VARCHAR(255), sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS menu_items (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, menu_section_id UUID REFERENCES menu_sections(id) ON DELETE SET NULL, name VARCHAR(255) NOT NULL, description TEXT, price DECIMAL(10,2), dietary_tags TEXT[], available BOOLEAN DEFAULT true, sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());

-- 5. DRINKS & SPECIALS
CREATE TABLE IF NOT EXISTS drink_sections (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, section_name VARCHAR(255), sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS drink_items (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, drink_section_id UUID REFERENCES drink_sections(id) ON DELETE SET NULL, item_name VARCHAR(255), description TEXT, price DECIMAL(10,2), brewery VARCHAR(255), item_style VARCHAR(100), available BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());

-- 6. HAPPY HOURS
CREATE TABLE IF NOT EXISTS happy_hour_sections (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, section_name VARCHAR(255), sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS happy_hour_items (id UUID PRIMARY KEY, happy_hour_section_id UUID NOT NULL REFERENCES happy_hour_sections(id) ON DELETE CASCADE, item_name VARCHAR(255), description TEXT, price DECIMAL(10,2), category VARCHAR(50), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS entity_happy_hours (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, day_of_week VARCHAR(10), start_time TIME, end_time TIME, created_at TIMESTAMPTZ DEFAULT NOW());

-- 7. SPECIALS & DEALS
CREATE TABLE IF NOT EXISTS entity_specials (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, title VARCHAR(255), description TEXT, special_type VARCHAR(50), day_of_week VARCHAR(10), days TEXT[], start_time TIME, end_time TIME, discount TEXT, price DECIMAL(10,2), is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());

-- 8. EVENTS
CREATE TABLE IF NOT EXISTS entity_events (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, event_name VARCHAR(255), description TEXT, artist_name VARCHAR(255), start_date DATE, start_time TIME, event_type VARCHAR(50), venue_location VARCHAR(255), cover_charge DECIMAL(10,2), music_style VARCHAR(100), is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());

-- 9. PHOTOS & MEDIA
CREATE TABLE IF NOT EXISTS entity_photos (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, image_url TEXT, caption TEXT, sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());

-- 10. Q&A
CREATE TABLE IF NOT EXISTS entity_qna (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, question TEXT, answer TEXT, created_at TIMESTAMPTZ DEFAULT NOW());

-- 11. REVIEWS
CREATE TABLE IF NOT EXISTS reviews (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, author_name VARCHAR(255), rating DECIMAL(3,1), review_text TEXT, created_at TIMESTAMPTZ DEFAULT NOW());

-- 12. GENERIC SECTIONS (for custom content)
CREATE TABLE IF NOT EXISTS entity_sections (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, section_name VARCHAR(255), section_type VARCHAR(50), sort_order INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS section_bullets (id UUID PRIMARY KEY, section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE, bullet_text TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS section_cards (id UUID PRIMARY KEY, section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE, card_title VARCHAR(255), card_content TEXT, card_image_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS section_photos (id UUID PRIMARY KEY, section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE, image_url TEXT, caption TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS section_reviews (id UUID PRIMARY KEY, section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE, review_text TEXT, author VARCHAR(255), rating DECIMAL(3,1), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS section_rich_text (id UUID PRIMARY KEY, section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE, html_content TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS section_location (id UUID PRIMARY KEY, section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE, address TEXT, lat DECIMAL(10,7), lng DECIMAL(10,7), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS section_hours (id UUID PRIMARY KEY, section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE, day_of_week VARCHAR(10), open_time TIME, close_time TIME, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS section_items (id UUID PRIMARY KEY, section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE, item_name VARCHAR(255), item_price DECIMAL(10,2), item_description TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS section_groups (id UUID PRIMARY KEY, section_id UUID NOT NULL REFERENCES entity_sections(id) ON DELETE CASCADE, group_name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());

-- 13. GCR-SPECIFIC
CREATE TABLE IF NOT EXISTS gcr_menu_items (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, name VARCHAR(255), description TEXT, price TEXT, section VARCHAR(100), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS gcr_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), setting_key VARCHAR(255) UNIQUE, setting_value TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS gcr_category_page_config (id UUID PRIMARY KEY, category_id VARCHAR(100), hero_image_url TEXT, hero_title VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS gcr_ads (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, ad_title VARCHAR(255), ad_content TEXT, image_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS gcr_claims (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, user_email VARCHAR(255), claim_status VARCHAR(50) DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS gcr_page_views (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, view_date DATE, view_count INT DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW());

-- 14. SITE CONTENT (legacy)
CREATE TABLE IF NOT EXISTS site_content (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, website_url TEXT, contact_phone VARCHAR(20), contact_email VARCHAR(255), address TEXT, created_at TIMESTAMPTZ DEFAULT NOW());

-- 15. ACTIVITIES
CREATE TABLE IF NOT EXISTS activities (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, activity_name VARCHAR(255), description TEXT, activity_type VARCHAR(100), created_at TIMESTAMPTZ DEFAULT NOW());

-- 16. OTHER REQUIRED TABLES (minimal)
CREATE TABLE IF NOT EXISTS events (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, event_name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS businesses (id UUID PRIMARY KEY, name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS specials (id UUID PRIMARY KEY, title VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS faqs (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, question TEXT, answer TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS policies (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, policy_name VARCHAR(255), policy_text TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS requirements (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, requirement_text TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS whats_included (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, included_item VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());

-- 17. BOOKING & RENTALS (minimal)
CREATE TABLE IF NOT EXISTS booking_slots (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, slot_date DATE, slot_time TIME, available BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS bookings (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, booking_date DATE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS rental_pricing (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, price_name VARCHAR(255), price DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS rental_time_slots (id UUID PRIMARY KEY, rental_pricing_id UUID REFERENCES rental_pricing(id) ON DELETE SET NULL, slot_name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS rental_addons (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, addon_name VARCHAR(255), addon_price DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS rental_group_rates (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, group_size INT, rate DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW());

-- 18. PRODUCTS
CREATE TABLE IF NOT EXISTS product_sections (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, section_name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS product_sub_sections (id UUID PRIMARY KEY, product_section_id UUID REFERENCES product_sections(id) ON DELETE SET NULL, subsection_name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS product_items (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, product_name VARCHAR(255), product_price DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS pricing_items (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, pricing_name VARCHAR(255), price DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW());

-- 19. FLEET & SERVICES
CREATE TABLE IF NOT EXISTS fleet_types (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, fleet_type_name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS fleet_items (id UUID PRIMARY KEY, fleet_type_id UUID REFERENCES fleet_types(id) ON DELETE SET NULL, item_name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS services (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, service_name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS addons (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, addon_name VARCHAR(255), addon_price DECIMAL(10,2), created_at TIMESTAMPTZ DEFAULT NOW());

-- 20. QR MENUS
CREATE TABLE IF NOT EXISTS qr_menu_themes (id UUID PRIMARY KEY, theme_name VARCHAR(255), theme_config JSONB, created_at TIMESTAMPTZ DEFAULT NOW());

-- 21. STAFF & MEETINGS
CREATE TABLE IF NOT EXISTS staff (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, staff_name VARCHAR(255), staff_role VARCHAR(100), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS meeting_points (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, meeting_point_name VARCHAR(255), lat DECIMAL(10,7), lng DECIMAL(10,7), created_at TIMESTAMPTZ DEFAULT NOW());

-- 22. TOURIST SYSTEM
CREATE TABLE IF NOT EXISTS tourist_profiles (id UUID PRIMARY KEY, user_email VARCHAR(255) UNIQUE, user_name VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS tourist_sessions (id UUID PRIMARY KEY, tourist_profile_id UUID REFERENCES tourist_profiles(id) ON DELETE CASCADE, session_token VARCHAR(255), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS tourist_saves (id UUID PRIMARY KEY, tourist_profile_id UUID REFERENCES tourist_profiles(id) ON DELETE CASCADE, entity_id UUID REFERENCES entity(id) ON DELETE CASCADE, saved_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS tourist_photos (id UUID PRIMARY KEY, tourist_profile_id UUID REFERENCES tourist_profiles(id) ON DELETE CASCADE, photo_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW());

-- 23. AI & EMBEDDINGS
CREATE TABLE IF NOT EXISTS business_embeddings (id UUID PRIMARY KEY, entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE, embedding_vector VECTOR(1536), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS ai_settings (id UUID PRIMARY KEY, setting_name VARCHAR(255), setting_value TEXT, created_at TIMESTAMPTZ DEFAULT NOW());

-- 24. ANALYTICS & OTHER
CREATE TABLE IF NOT EXISTS sales_leads (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, lead_info TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS user_preference_scores (id UUID PRIMARY KEY, tourist_profile_id UUID REFERENCES tourist_profiles(id) ON DELETE CASCADE, preference_name VARCHAR(255), score DECIMAL(5,2), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS business_media (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, media_url TEXT, media_type VARCHAR(50), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS site_data_store (id UUID PRIMARY KEY, entity_id UUID REFERENCES entity(id) ON DELETE SET NULL, data_key VARCHAR(255), data_value TEXT, created_at TIMESTAMPTZ DEFAULT NOW());

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_entity_slug ON entity(slug);
CREATE INDEX idx_entity_place_id ON entity(place_id);
CREATE INDEX idx_menu_items_entity ON menu_items(entity_id);
CREATE INDEX idx_happy_hour_sections_entity ON happy_hour_sections(entity_id);
CREATE INDEX idx_entity_specials_entity ON entity_specials(entity_id);
CREATE INDEX idx_entity_events_entity ON entity_events(entity_id);
CREATE INDEX idx_entity_photos_entity ON entity_photos(entity_id);
CREATE INDEX idx_gcr_menu_items_entity ON gcr_menu_items(entity_id);

-- ============================================
-- DONE! All 70 tables created.
-- ============================================
