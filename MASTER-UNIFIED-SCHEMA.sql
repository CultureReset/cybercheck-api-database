-- ============================================================
-- MASTER UNIFIED SCHEMA — CyberCheck + GCR Platform
-- Single database schema combining all tables
-- Run this ONCE in your new Supabase SQL Editor
-- ============================================================

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. BUSINESSES (core platform table)
-- ============================================
CREATE TABLE IF NOT EXISTS businesses (
    site_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE,
    subdomain VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    logo_url TEXT,
    cover_url TEXT,
    plan VARCHAR(20) DEFAULT 'free',
    status VARCHAR(20) DEFAULT 'active',
    gcr_listed BOOLEAN DEFAULT false,
    gcr_verified BOOLEAN DEFAULT false,
    emoji VARCHAR(10) DEFAULT '🏪',
    tagline VARCHAR(255),
    featured BOOLEAN DEFAULT false,
    tags JSONB DEFAULT '[]',
    price_range VARCHAR(10),
    rating DECIMAL(3,2),
    review_count INT DEFAULT 0,
    happy_hour VARCHAR(255),
    kids_friendly BOOLEAN DEFAULT false,
    pet_friendly BOOLEAN DEFAULT false,
    live_music BOOLEAN DEFAULT false,
    outdoor BOOLEAN DEFAULT false,
    reservations BOOLEAN DEFAULT false,
    alcohol BOOLEAN DEFAULT false,
    booking_required BOOLEAN DEFAULT false,
    delivery BOOLEAN DEFAULT false,
    takeout BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    area VARCHAR(50),
    subcategory VARCHAR(100),
    waterfront BOOLEAN DEFAULT false,
    beachfront BOOLEAN DEFAULT false,
    dockside BOOLEAN DEFAULT false,
    gluten_free BOOLEAN DEFAULT false,
    vegan BOOLEAN DEFAULT false,
    vegetarian BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_businesses_domain ON businesses(domain);
CREATE INDEX idx_businesses_subdomain ON businesses(subdomain);
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_gcr ON businesses(gcr_listed, status);
CREATE INDEX idx_businesses_type ON businesses(type);
CREATE INDEX idx_businesses_featured ON businesses(featured);
CREATE INDEX idx_businesses_tags ON businesses USING gin(tags);
CREATE INDEX idx_businesses_area ON businesses(area);
CREATE INDEX idx_businesses_subcategory ON businesses(type, subcategory);

-- ============================================
-- 2. USERS (business owners + platform admins)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE,
    site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'owner',
    avatar_url TEXT,
    password_hash TEXT,
    reset_token TEXT,
    reset_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_site ON users(site_id);
CREATE INDEX idx_users_auth ON users(auth_id);

-- ============================================
-- 3. SITE CONTENT (homepage + contact info)
-- ============================================
CREATE TABLE IF NOT EXISTS site_content (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    hero_text TEXT,
    hero_subtext TEXT,
    hero_video_url TEXT,
    about_text TEXT,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    website_url TEXT,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(10),
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    hours JSONB DEFAULT '{}',
    hours_note TEXT,
    gallery JSONB DEFAULT '[]',
    social_links JSONB DEFAULT '{}',
    theme_color VARCHAR(7) DEFAULT '#00ada8',
    theme_font VARCHAR(50) DEFAULT 'Inter',
    custom_css TEXT,
    seo_title VARCHAR(255),
    seo_description TEXT,
    messaging_settings JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. SITE PAGES (generated website pages)
-- ============================================
CREATE TABLE IF NOT EXISTS site_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    html_content TEXT,
    page_type VARCHAR(50),
    visible BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, slug)
);

CREATE INDEX idx_site_pages_site ON site_pages(site_id);

-- ============================================
-- 5. APPS (marketplace catalog)
-- ============================================
CREATE TABLE IF NOT EXISTS apps (
    app_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    business_types JSONB DEFAULT '[]',
    monthly_price DECIMAL(10,2) DEFAULT 0,
    icon VARCHAR(10),
    status VARCHAR(20) DEFAULT 'active'
);

-- ============================================
-- 6. SITE APPS (installed apps per business)
-- ============================================
CREATE TABLE IF NOT EXISTS site_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    app_id VARCHAR(50) NOT NULL REFERENCES apps(app_id),
    config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, app_id)
);

CREATE INDEX idx_site_apps_site ON site_apps(site_id);

-- ============================================
-- 7. OAUTH CONNECTIONS (Stripe, Google, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    account_id VARCHAR(255),
    account_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'connected',
    metadata JSONB DEFAULT '{}',
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, provider)
);

CREATE INDEX idx_connections_site ON connections(site_id);
CREATE INDEX idx_connections_provider ON connections(site_id, provider);

-- ============================================
-- 8. CUSTOMERS (per business CRM)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    notes TEXT,
    tier VARCHAR(20) DEFAULT 'customer',
    total_orders INT DEFAULT 0,
    total_bookings INT DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    last_visit TIMESTAMPTZ,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_site ON customers(site_id);
CREATE INDEX idx_customers_email ON customers(site_id, email);

-- ============================================
-- 9. MENU CATEGORIES (Breakfast, Lunch, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    time_start TIME,
    time_end TIME,
    image_url TEXT,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menu_categories_site ON menu_categories(site_id);

-- ============================================
-- 10. MENU SUBCATEGORIES (Appetizers, Seafood, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS menu_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menu_subcategories_site ON menu_subcategories(site_id);
CREATE INDEX idx_menu_subcategories_cat ON menu_subcategories(category_id);

-- ============================================
-- 11. MENU ITEMS (dishes/products)
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES menu_subcategories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    image_url TEXT,
    tags JSONB DEFAULT '[]',
    allergens JSONB DEFAULT '[]',
    ingredients TEXT,
    calories INT,
    section VARCHAR(100),
    dietary_tags JSONB DEFAULT '[]',
    available BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menu_items_site ON menu_items(site_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_subcategory ON menu_items(subcategory_id);
CREATE INDEX idx_menu_items_section ON menu_items(site_id, section);
CREATE INDEX idx_menu_items_dietary ON menu_items USING gin(dietary_tags);

-- ============================================
-- 12. SPECIALS / HAPPY HOURS
-- ============================================
CREATE TABLE IF NOT EXISTS specials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    days JSONB DEFAULT '[]',
    start_time TIME,
    end_time TIME,
    recurring BOOLEAN DEFAULT true,
    valid_from DATE,
    valid_until DATE,
    discount_text VARCHAR(255),
    discount_type VARCHAR(20),
    discount_amount DECIMAL(10,2),
    items JSONB DEFAULT '[]',
    drink_specials JSONB DEFAULT '[]',
    image_url TEXT,
    gcr_category VARCHAR(50),
    discount TEXT,
    items_list JSONB DEFAULT '[]',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_specials_site ON specials(site_id);
CREATE INDEX idx_specials_type ON specials(site_id, type);
CREATE INDEX idx_specials_gcr_cat ON specials(site_id, gcr_category);

-- ============================================
-- 13. EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    event_date DATE,
    start_time TIME,
    end_time TIME,
    time VARCHAR(50),
    category VARCHAR(50),
    cover VARCHAR(100),
    ticket_url TEXT,
    venue_name VARCHAR(255),
    emoji VARCHAR(10),
    cover_charge BOOLEAN DEFAULT false,
    kids_friendly BOOLEAN DEFAULT false,
    age_limit VARCHAR(20),
    pet_friendly BOOLEAN DEFAULT false,
    artist_id UUID,
    artist_name VARCHAR(255),
    recurring BOOLEAN DEFAULT false,
    recurring_day VARCHAR(20),
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_site ON events(site_id);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_category ON events(site_id, category);
CREATE INDEX idx_events_artist ON events(artist_id);

-- ============================================
-- 14. ARTISTS (musicians / local performers)
-- ============================================
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
    user_id UUID,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    genre VARCHAR(100),
    bio TEXT,
    photo_url TEXT,
    cover_url TEXT,
    website TEXT,
    booking_email VARCHAR(255),
    booking_phone VARCHAR(20),
    social JSONB DEFAULT '{}',
    tags JSONB DEFAULT '[]',
    gcr_listed BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    home_venue VARCHAR(255),
    upcoming_shows JSONB DEFAULT '[]',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_artists_gcr ON artists(gcr_listed);
CREATE INDEX idx_artists_slug ON artists(slug);
CREATE INDEX idx_artists_site ON artists(site_id);
CREATE INDEX idx_artists_user ON artists(user_id);

-- ============================================
-- 15. ARTIST SHOWS
-- ============================================
CREATE TABLE IF NOT EXISTS artist_shows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    site_id UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
    venue_name VARCHAR(255) NOT NULL,
    venue_city VARCHAR(100),
    show_date DATE NOT NULL,
    start_time VARCHAR(50),
    end_time VARCHAR(50),
    show_type VARCHAR(50) DEFAULT 'live-music',
    cover VARCHAR(100) DEFAULT 'Free',
    ticket_url TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_artist_shows_artist ON artist_shows(artist_id, show_date);
CREATE INDEX idx_artist_shows_venue ON artist_shows(site_id, show_date);
CREATE INDEX idx_artist_shows_date ON artist_shows(show_date);

-- ============================================
-- 16. SONG REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS song_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    show_id UUID REFERENCES artist_shows(id) ON DELETE SET NULL,
    song_name VARCHAR(255) NOT NULL,
    requester_name VARCHAR(100),
    tip_amount DECIMAL(6,2) DEFAULT 0,
    tip_method VARCHAR(20),
    tip_handle VARCHAR(100),
    position INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_song_requests_artist ON song_requests(artist_id, status, position);
CREATE INDEX idx_song_requests_show ON song_requests(show_id, status);

-- ============================================
-- 17. GCR FEED POSTS
-- ============================================
CREATE TABLE IF NOT EXISTS gcr_feed_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'update',
    text TEXT,
    image_url TEXT,
    link_url TEXT,
    link_text VARCHAR(100),
    emoji VARCHAR(10),
    business_name VARCHAR(255),
    business_logo TEXT,
    pinned BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feed_site ON gcr_feed_posts(site_id);
CREATE INDEX idx_feed_active ON gcr_feed_posts(active, created_at DESC);
CREATE INDEX idx_feed_pinned ON gcr_feed_posts(pinned);

-- ============================================
-- 18. SERVICES (salon, charter, packages)
-- ============================================
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    duration_minutes INT,
    capacity INT DEFAULT 1,
    image_url TEXT,
    category VARCHAR(100),
    whats_included JSONB DEFAULT '[]',
    min_guests INT DEFAULT 1,
    max_guests INT,
    booking_url TEXT,
    notes TEXT,
    kids_friendly BOOLEAN DEFAULT false,
    age_minimum INT,
    weight_limit INT,
    pet_friendly BOOLEAN DEFAULT false,
    available BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_services_site ON services(site_id);

-- ============================================
-- 19. AVAILABILITY (service time slots)
-- ============================================
CREATE TABLE IF NOT EXISTS availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    day_of_week INT,
    specific_date DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_bookings INT DEFAULT 1,
    blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_availability_site ON availability(site_id);

-- ============================================
-- 20. FLEET TYPES (boat types, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS fleet_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    specs JSONB DEFAULT '{}',
    image_url TEXT,
    featured BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fleet_types_site ON fleet_types(site_id);

-- ============================================
-- 21. FLEET ITEMS (individual units)
-- ============================================
CREATE TABLE IF NOT EXISTS fleet_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID NOT NULL REFERENCES fleet_types(id) ON DELETE CASCADE,
    unit_name VARCHAR(100),
    serial_number VARCHAR(100),
    condition VARCHAR(20) DEFAULT 'good',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fleet_items_site ON fleet_items(site_id);
CREATE INDEX idx_fleet_items_type ON fleet_items(fleet_type_id);

-- ============================================
-- 22. RENTAL TIME SLOTS
-- ============================================
CREATE TABLE IF NOT EXISTS rental_time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true
);

CREATE INDEX idx_rental_time_slots_site ON rental_time_slots(site_id);

-- ============================================
-- 23. RENTAL PRICING
-- ============================================
CREATE TABLE IF NOT EXISTS rental_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID NOT NULL REFERENCES fleet_types(id) ON DELETE CASCADE,
    time_slot_id UUID REFERENCES rental_time_slots(id) ON DELETE CASCADE,
    slot_label VARCHAR(100),
    price DECIMAL(10,2),
    active BOOLEAN DEFAULT true,
    UNIQUE(site_id, fleet_type_id, time_slot_id)
);

CREATE INDEX idx_rental_pricing_site ON rental_pricing(site_id);

-- ============================================
-- 24. RENTAL GROUP RATES
-- ============================================
CREATE TABLE IF NOT EXISTS rental_group_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID REFERENCES fleet_types(id) ON DELETE CASCADE,
    time_slot_id UUID REFERENCES rental_time_slots(id) ON DELETE CASCADE,
    min_qty INT,
    price_per_unit DECIMAL(10,2),
    title VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2),
    price_label VARCHAR(100),
    active BOOLEAN DEFAULT true
);

-- ============================================
-- 25. RENTAL ADD-ONS
-- ============================================
CREATE TABLE IF NOT EXISTS rental_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    price_half DECIMAL(10,2),
    price_full DECIMAL(10,2),
    category VARCHAR(50),
    icon VARCHAR(10),
    image_url TEXT,
    per_unit VARCHAR(50) DEFAULT 'per rental',
    badge VARCHAR(50),
    specs TEXT,
    features JSONB DEFAULT '[]',
    unit VARCHAR(50),
    available BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rental_addons_site ON rental_addons(site_id);

-- ============================================
-- 26. BOOKINGS (universal)
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    service_id UUID REFERENCES services(id),
    fleet_type_id UUID REFERENCES fleet_types(id),
    time_slot_id UUID REFERENCES rental_time_slots(id),
    booking_date DATE NOT NULL,
    booking_time TIME,
    end_time TIME,
    duration_minutes INT,
    qty INT DEFAULT 1,
    party_size INT DEFAULT 1,
    addons JSONB DEFAULT '[]',
    subtotal DECIMAL(10,2),
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2),
    deposit DECIMAL(10,2) DEFAULT 0,
    payment_id VARCHAR(255),
    payment_provider VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    waiver_signed BOOLEAN DEFAULT false,
    sms_delivered BOOLEAN DEFAULT false,
    review_requested BOOLEAN DEFAULT false,
    booking_token VARCHAR(50),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_site ON bookings(site_id);
CREATE INDEX idx_bookings_date ON bookings(site_id, booking_date);
CREATE INDEX idx_bookings_status ON bookings(site_id, status);

-- ============================================
-- 27. BOOKING HOLDS
-- ============================================
CREATE TABLE IF NOT EXISTS booking_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID NOT NULL,
    time_slot_id UUID NOT NULL,
    booking_date DATE NOT NULL,
    qty INT NOT NULL DEFAULT 1,
    session_id VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_holds_lookup ON booking_holds(site_id, fleet_type_id, time_slot_id, booking_date);
CREATE INDEX idx_booking_holds_expiry ON booking_holds(expires_at);

-- ============================================
-- 28. ORDERS (restaurant, bakery, retail)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    items JSONB NOT NULL,
    subtotal DECIMAL(10,2),
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending',
    payment_id VARCHAR(255),
    payment_provider VARCHAR(50),
    pickup_time TIMESTAMPTZ,
    order_type VARCHAR(20) DEFAULT 'pickup',
    notes TEXT,
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_site ON orders(site_id);
CREATE INDEX idx_orders_status ON orders(site_id, status);

-- ============================================
-- 29. WAIVERS
-- ============================================
CREATE TABLE IF NOT EXISTS waivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    signature_data TEXT,
    waiver_text TEXT,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(45)
);

CREATE INDEX idx_waivers_site ON waivers(site_id);
CREATE INDEX idx_waivers_booking ON waivers(booking_id);

-- ============================================
-- 30. REVIEWS
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    text TEXT,
    photos JSONB DEFAULT '[]',
    booking_id UUID REFERENCES bookings(id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_site ON reviews(site_id);
CREATE INDEX idx_reviews_status ON reviews(site_id, status);

-- ============================================
-- 31. STAFF / TEAM MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50),
    bio TEXT,
    photo_url TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staff_site ON staff(site_id);

-- ============================================
-- 32. MEDIA LIBRARY
-- ============================================
CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    title VARCHAR(255),
    url TEXT NOT NULL,
    filename VARCHAR(255),
    file_type VARCHAR(50),
    file_size INT,
    alt_text VARCHAR(255),
    folder VARCHAR(100) DEFAULT 'general',
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_site ON media(site_id);

-- ============================================
-- 33. SMS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS sms_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    to_phone VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'sent',
    related_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_log_site ON sms_log(site_id);

-- ============================================
-- 34. SMS OPT-OUTS (TCPA compliance)
-- ============================================
CREATE TABLE IF NOT EXISTS sms_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    site_id UUID REFERENCES businesses(site_id),
    opted_out_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phone, site_id)
);

CREATE INDEX idx_sms_opt_outs_phone ON sms_opt_outs(phone);

-- ============================================
-- 35. SMS CAMPAIGNS
-- ============================================
CREATE TABLE IF NOT EXISTS sms_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    audience VARCHAR(50),
    message TEXT NOT NULL,
    coupon_code VARCHAR(50),
    recipient_count INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_campaigns_site ON sms_campaigns(site_id);

-- ============================================
-- 36. FAQS
-- ============================================
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_faqs_site ON faqs(site_id);

-- ============================================
-- 37. COUPONS
-- ============================================
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'percentage',
    amount DECIMAL(10,2) NOT NULL,
    min_order DECIMAL(10,2) DEFAULT 0,
    max_uses INT,
    uses_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupons_site ON coupons(site_id);
CREATE INDEX idx_coupons_code ON coupons(site_id, code);

-- ============================================
-- 38. NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    metadata JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_site ON notifications(site_id);
CREATE INDEX idx_notifications_unread ON notifications(site_id, read);

-- ============================================
-- 39. ACTIVITY LOG (per business)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_site ON activity_log(site_id);

-- ============================================
-- 40. AUDIT LOG (platform admin actions)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_admin ON audit_log(admin_id);

-- ============================================
-- 41. TEMPLATES (website templates)
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(50),
    description TEXT,
    thumbnail_url TEXT,
    html_content TEXT,
    css_content TEXT,
    js_content TEXT,
    price DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    usage_count INT DEFAULT 0,
    template_type VARCHAR(20) DEFAULT 'website',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 42. SUPPORT TICKETS
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(20) DEFAULT 'open',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_support_tickets_site ON support_tickets(site_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);

-- ============================================
-- 43. PLATFORM CONFIG
-- ============================================
CREATE TABLE IF NOT EXISTS platform_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 44. DOMAINS (custom domain management)
-- ============================================
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    is_primary BOOLEAN DEFAULT false,
    dns_verified BOOLEAN DEFAULT false,
    dns_verification_token VARCHAR(100),
    ssl_status VARCHAR(20) DEFAULT 'pending',
    ssl_expires_at TIMESTAMPTZ,
    dns_type VARCHAR(10) DEFAULT 'CNAME',
    dns_target VARCHAR(255),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_domains_site ON domains(site_id);
CREATE INDEX idx_domains_domain ON domains(domain);

-- ============================================
-- 45. TOURIST SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID UNIQUE DEFAULT gen_random_uuid(),
    name TEXT,
    phone TEXT,
    email TEXT,
    interests TEXT[],
    visitor_type TEXT,
    checkin DATE,
    checkout DATE,
    chat_url TEXT,
    sms_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tourist_sessions_phone ON tourist_sessions(phone);
CREATE INDEX idx_tourist_sessions_sid ON tourist_sessions(session_id);

-- ============================================
-- 46. TOURIST CONVERSATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES tourist_sessions(session_id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tourist_conv_session ON tourist_conversations(session_id, created_at);

-- ============================================
-- 47. GCR CLAIMS
-- ============================================
CREATE TABLE IF NOT EXISTS gcr_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
    business_name VARCHAR(255) NOT NULL,
    claimant_name VARCHAR(255) NOT NULL,
    claimant_email VARCHAR(255) NOT NULL,
    claimant_phone VARCHAR(20),
    business_role VARCHAR(100),
    notes TEXT,
    claim_type VARCHAR(50) DEFAULT 'business',
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gcr_claims_status ON gcr_claims(status);
CREATE INDEX idx_gcr_claims_email ON gcr_claims(claimant_email);

-- ============================================
-- 48. LOYALTY SIGNUPS
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    visitor_type VARCHAR(50),
    interests TEXT[],
    checkin DATE,
    checkout DATE,
    source VARCHAR(100),
    session_id UUID REFERENCES tourist_sessions(session_id) ON DELETE SET NULL,
    sms_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loyalty_email ON loyalty_signups(email);
CREATE INDEX idx_loyalty_phone ON loyalty_signups(phone);

-- ============================================
-- 49. AI CHUNKS (RAG/vector search)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
    chunk_type TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    source TEXT DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chunks_embedding_idx ON ai_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS ai_chunks_site_id_idx ON ai_chunks(site_id);
CREATE INDEX IF NOT EXISTS ai_chunks_type_idx ON ai_chunks(chunk_type);

-- ============================================
-- 50. QA PAIRS
-- ============================================
CREATE TABLE IF NOT EXISTS qa_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT,
    embedding vector(1536),
    confidence DECIMAL(3,2) DEFAULT 1.0,
    active BOOL DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 51. BUSINESS DETAILS (AI-ready descriptions)
-- ============================================
CREATE TABLE IF NOT EXISTS business_details (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    elevator_pitch TEXT,
    vibe_description TEXT,
    who_its_for TEXT,
    what_to_expect TEXT,
    signature_dish TEXT,
    signature_drink TEXT,
    must_try TEXT[],
    avoid TEXT[],
    local_favorite BOOL DEFAULT false,
    tourist_trap BOOL DEFAULT false,
    award_winning BOOL DEFAULT false,
    awards TEXT[],
    years_in_business INT,
    owner_name TEXT,
    insider_tip TEXT,
    best_kept_secret TEXT,
    pro_tip TEXT,
    best_time_of_day TEXT,
    best_days TEXT[],
    worst_days TEXT[],
    avg_wait_time TEXT,
    avg_visit_duration TEXT,
    updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 52. BUSINESS LOGISTICS
-- ============================================
CREATE TABLE IF NOT EXISTS business_logistics (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    parking_type TEXT,
    parking_notes TEXT,
    parking_lot_size TEXT,
    wheelchair_accessible BOOL DEFAULT false,
    stroller_friendly BOOL DEFAULT false,
    elevator BOOL DEFAULT false,
    waterfront_access BOOL DEFAULT false,
    boat_accessible BOOL DEFAULT false,
    dock_available BOOL DEFAULT false,
    reservations TEXT DEFAULT 'walk-in',
    reservation_url TEXT,
    reservation_phone TEXT,
    waitlist_app TEXT,
    directions_note TEXT,
    landmark TEXT,
    uber_friendly BOOL DEFAULT true,
    golf_cart_parking BOOL DEFAULT false,
    distance_from_beach TEXT,
    distance_from_wharf TEXT,
    updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 53. BUSINESS ATMOSPHERE
-- ============================================
CREATE TABLE IF NOT EXISTS business_atmosphere (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    noise_level TEXT,
    lighting TEXT,
    seating_types TEXT[],
    dress_code TEXT DEFAULT 'beach casual',
    avg_age_range TEXT,
    live_music BOOL DEFAULT false,
    live_music_schedule TEXT,
    live_music_genre TEXT,
    dance_floor BOOL DEFAULT false,
    sports_tv BOOL DEFAULT false,
    karaoke BOOL DEFAULT false,
    trivia_night TEXT,
    outdoor_seating BOOL DEFAULT false,
    covered_outdoor BOOL DEFAULT false,
    fire_pit BOOL DEFAULT false,
    ocean_view BOOL DEFAULT false,
    bay_view BOOL DEFAULT false,
    sunset_view BOOL DEFAULT false,
    wifi BOOL DEFAULT false,
    wifi_password TEXT,
    charging_stations BOOL DEFAULT false,
    pool_table BOOL DEFAULT false,
    arcade_games BOOL DEFAULT false,
    gift_shop BOOL DEFAULT false,
    updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 54. MENU DETAILS
-- ============================================
CREATE TABLE IF NOT EXISTS menu_details (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    cuisine_types TEXT[],
    cooking_styles TEXT[],
    sourcing_note TEXT,
    vegetarian_options BOOL DEFAULT false,
    vegan_options BOOL DEFAULT false,
    gluten_free_options BOOL DEFAULT false,
    gluten_free_menu BOOL DEFAULT false,
    dairy_free_options BOOL DEFAULT false,
    nut_allergy_friendly BOOL DEFAULT false,
    kids_menu BOOL DEFAULT false,
    kids_eat_free TEXT,
    full_bar BOOL DEFAULT false,
    craft_beer BOOL DEFAULT false,
    local_beer BOOL DEFAULT false,
    wine_list BOOL DEFAULT false,
    signature_cocktails BOOL DEFAULT false,
    byob BOOL DEFAULT false,
    corkage_fee TEXT,
    happy_hour BOOL DEFAULT false,
    happy_hour_schedule TEXT,
    happy_hour_deals TEXT,
    service_style TEXT,
    avg_check_per_person TEXT,
    takeout BOOL DEFAULT false,
    delivery BOOL DEFAULT false,
    delivery_apps TEXT[],
    catering BOOL DEFAULT false,
    updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 55. ACTIVITY DETAILS
-- ============================================
CREATE TABLE IF NOT EXISTS activity_details (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    activity_type TEXT,
    difficulty TEXT DEFAULT 'easy',
    physical_required TEXT,
    min_age INT,
    max_age INT,
    min_weight_lbs INT,
    max_weight_lbs INT,
    swimming_required BOOL DEFAULT false,
    experience_required BOOL DEFAULT false,
    experience_note TEXT,
    duration_hours DECIMAL(4,1),
    departure_location TEXT,
    departure_lat DECIMAL(10,7),
    departure_lng DECIMAL(10,7),
    what_to_bring TEXT[],
    what_is_provided TEXT[],
    fish_species TEXT[],
    fishing_type TEXT,
    trip_types TEXT[],
    advance_booking_required TEXT,
    cancellation_policy TEXT,
    deposit_required BOOL DEFAULT false,
    deposit_amount DECIMAL(8,2),
    updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 56. ACCOMMODATION DETAILS
-- ============================================
CREATE TABLE IF NOT EXISTS accommodation_details (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    star_rating DECIMAL(2,1),
    total_rooms INT,
    floors INT,
    year_built INT,
    year_renovated INT,
    beachfront BOOL DEFAULT false,
    beach_access TEXT,
    beach_chairs_included BOOL DEFAULT false,
    pools INT DEFAULT 0,
    indoor_pool BOOL DEFAULT false,
    heated_pool BOOL DEFAULT false,
    lazy_river BOOL DEFAULT false,
    waterslide BOOL DEFAULT false,
    restaurant_on_site BOOL DEFAULT false,
    bar_on_site BOOL DEFAULT false,
    gym BOOL DEFAULT false,
    spa BOOL DEFAULT false,
    business_center BOOL DEFAULT false,
    resort_fee DECIMAL(8,2),
    resort_fee_includes TEXT[],
    parking_fee TEXT,
    pet_fee TEXT,
    check_in_time TEXT DEFAULT '4:00 PM',
    check_out_time TEXT DEFAULT '11:00 AM',
    min_age_to_book INT DEFAULT 21,
    pets_allowed BOOL DEFAULT false,
    pet_size_limit TEXT,
    smoking_policy TEXT DEFAULT 'non-smoking',
    updated_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 57. PACKAGES
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    price_label TEXT,
    duration_minutes INT,
    whats_included TEXT[],
    min_guests INT DEFAULT 1,
    max_guests INT,
    booking_url TEXT,
    advance_hours INT DEFAULT 24,
    active BOOL DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 58. ROOM TYPES
-- ============================================
CREATE TABLE IF NOT EXISTS room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price_per_night DECIMAL(10,2),
    price_weekend DECIMAL(10,2),
    price_peak DECIMAL(10,2),
    total_available INT,
    amenities TEXT[],
    max_occupancy INT,
    bedding TEXT,
    square_feet INT,
    created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 59. LOYALTY MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255),
    name VARCHAR(255),
    points INT DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'bronze',
    interests JSONB DEFAULT '[]',
    member_type VARCHAR(20) DEFAULT 'tourist',
    zip VARCHAR(10),
    sms_opt_in BOOLEAN DEFAULT true,
    personal_code VARCHAR(20) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loyalty_members_site_id ON loyalty_members(site_id);
CREATE INDEX idx_loyalty_members_phone ON loyalty_members(phone);
CREATE INDEX idx_loyalty_members_email ON loyalty_members(email);

-- ============================================
-- 60. LOYALTY TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    type VARCHAR(20),
    points INT,
    description TEXT,
    booking_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loyalty_transactions_member_id ON loyalty_transactions(member_id);
CREATE INDEX idx_loyalty_transactions_site_id ON loyalty_transactions(site_id);
CREATE INDEX idx_loyalty_transactions_booking_id ON loyalty_transactions(booking_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION increment_customer_bookings(customer_uuid UUID, amount DECIMAL)
RETURNS void AS $$
BEGIN
    UPDATE customers
    SET total_bookings = total_bookings + 1,
        total_spent = total_spent + amount,
        last_visit = NOW(),
        updated_at = NOW()
    WHERE id = customer_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_customer_orders(customer_uuid UUID, amount DECIMAL)
RETURNS void AS $$
BEGIN
    UPDATE customers
    SET total_orders = total_orders + 1,
        total_spent = total_spent + amount,
        last_visit = NOW(),
        updated_at = NOW()
    WHERE id = customer_uuid;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_booking_if_available(
    p_site_id UUID,
    p_fleet_type_id UUID,
    p_time_slot_id UUID,
    p_booking_date DATE,
    p_qty INT,
    p_service_id UUID DEFAULT NULL,
    p_booking_time TEXT DEFAULT NULL,
    p_party_size INT DEFAULT 1,
    p_addons JSONB DEFAULT '[]',
    p_subtotal DECIMAL DEFAULT 0,
    p_tax DECIMAL DEFAULT 0,
    p_total DECIMAL DEFAULT 0,
    p_customer_id UUID DEFAULT NULL,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_customer_email TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_hold_session_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_total_inventory INT;
    v_booked INT;
    v_held INT;
    v_available INT;
    v_booking_id UUID;
    v_result JSONB;
BEGIN
    SELECT COUNT(*) INTO v_total_inventory
    FROM fleet_items
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND condition = 'good';

    SELECT COALESCE(SUM(qty), 0) INTO v_booked
    FROM bookings
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND status IN ('pending', 'confirmed', 'checked_in');

    SELECT COALESCE(SUM(qty), 0) INTO v_held
    FROM booking_holds
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND expires_at > NOW()
      AND (p_hold_session_id IS NULL OR session_id != p_hold_session_id);

    v_available := v_total_inventory - v_booked - v_held;

    IF v_available < p_qty THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not enough availability. Only ' || v_available || ' unit(s) remaining.',
            'available', v_available,
            'requested', p_qty
        );
    END IF;

    INSERT INTO bookings (
        site_id, fleet_type_id, service_id, time_slot_id, booking_date,
        booking_time, qty, party_size, addons, subtotal, tax, total,
        customer_id, customer_name, customer_phone, customer_email,
        notes, status, payment_status
    ) VALUES (
        p_site_id, p_fleet_type_id, p_service_id, p_time_slot_id, p_booking_date,
        p_booking_time, p_qty, p_party_size, p_addons, p_subtotal, p_tax, p_total,
        p_customer_id, p_customer_name, p_customer_phone, p_customer_email,
        p_notes, 'pending', 'unpaid'
    )
    RETURNING id INTO v_booking_id;

    IF p_hold_session_id IS NOT NULL THEN
        DELETE FROM booking_holds
        WHERE session_id = p_hold_session_id
          AND site_id = p_site_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'available_after', v_available - p_qty
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_booking_hold(
    p_site_id UUID,
    p_fleet_type_id UUID,
    p_time_slot_id UUID,
    p_booking_date DATE,
    p_qty INT,
    p_session_id TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_total_inventory INT;
    v_booked INT;
    v_held INT;
    v_available INT;
    v_hold_id UUID;
BEGIN
    DELETE FROM booking_holds WHERE expires_at < NOW();

    SELECT COUNT(*) INTO v_total_inventory
    FROM fleet_items
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND condition = 'good';

    SELECT COALESCE(SUM(qty), 0) INTO v_booked
    FROM bookings
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND status IN ('pending', 'confirmed', 'checked_in');

    SELECT COALESCE(SUM(qty), 0) INTO v_held
    FROM booking_holds
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND expires_at > NOW()
      AND session_id != p_session_id;

    v_available := v_total_inventory - v_booked - v_held;

    IF v_available < p_qty THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not enough availability. Only ' || v_available || ' unit(s) remaining.',
            'available', v_available
        );
    END IF;

    DELETE FROM booking_holds
    WHERE session_id = p_session_id AND site_id = p_site_id;

    INSERT INTO booking_holds (site_id, fleet_type_id, time_slot_id, booking_date, qty, session_id)
    VALUES (p_site_id, p_fleet_type_id, p_time_slot_id, p_booking_date, p_qty, p_session_id)
    RETURNING id INTO v_hold_id;

    RETURN jsonb_build_object(
        'success', true,
        'hold_id', v_hold_id,
        'expires_in_seconds', 600,
        'available_after', v_available - p_qty
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GCR API VIEW
-- ============================================
CREATE OR REPLACE VIEW gcr_businesses_view AS
SELECT
    b.site_id,
    b.subdomain AS slug,
    b.name,
    b.type,
    b.emoji,
    b.tagline,
    b.featured,
    b.tags,
    b.price_range,
    b.rating,
    b.review_count,
    b.happy_hour,
    b.kids_friendly,
    b.pet_friendly,
    b.live_music,
    b.outdoor,
    b.reservations,
    b.alcohol,
    b.booking_required,
    b.delivery,
    b.takeout,
    b.sort_order,
    b.gcr_listed,
    b.gcr_verified,
    b.logo_url,
    b.cover_url,
    sc.address,
    sc.city,
    sc.state,
    sc.zip,
    sc.lat,
    sc.lng,
    sc.contact_phone AS phone,
    sc.contact_email AS email,
    sc.website_url AS website,
    sc.hours,
    sc.hours_note,
    sc.about_text AS description,
    sc.gallery,
    sc.social_links AS social,
    sc.cover_url AS cover_image
FROM businesses b
LEFT JOIN site_content sc ON sc.site_id = b.site_id
WHERE b.gcr_listed = true
  AND b.status = 'active'
ORDER BY b.featured DESC, b.sort_order ASC, b.name ASC;

-- ============================================================
-- TOURIST INTELLIGENCE LAYER
-- Powers: RAG, personalization, AI concierge, SMS targeting,
--         preference scoring, voice-to-chat, magic links
-- ============================================================

-- 61. TOURIST PROFILES (rich trip + identity data)
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_profiles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID UNIQUE REFERENCES tourist_sessions(session_id) ON DELETE CASCADE,
    firebase_uid  TEXT UNIQUE,           -- Firebase phone auth UID
    phone         TEXT UNIQUE,           -- verified by Firebase, primary identity key
    email         TEXT,
    name          TEXT,
    destination   TEXT,
    arrival       DATE,
    departure     DATE,
    trip_days     INT,
    group_type    TEXT,                  -- solo | couple | family | friends | group
    budget        TEXT,                  -- $ | $$ | $$$ | $$$$
    interests     TEXT[]  DEFAULT '{}',
    stay_status   TEXT,                  -- hotel | vrbo | camping | local
    hotel_name    TEXT,
    setup_complete BOOLEAN DEFAULT false,
    sms_opt_in    BOOLEAN DEFAULT false,
    sms_opted_in_at TIMESTAMPTZ,
    otp_code            TEXT,
    otp_expires         TIMESTAMPTZ,
    magic_token         TEXT UNIQUE,
    magic_token_expires TIMESTAMPTZ,
    last_lat            DECIMAL(10,7),   -- geofencing: last known location
    last_lng            DECIMAL(10,7),
    last_location_at    TIMESTAMPTZ,
    last_active         TIMESTAMPTZ DEFAULT NOW(),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tourist_profiles_phone    ON tourist_profiles(phone);
CREATE INDEX idx_tourist_profiles_firebase ON tourist_profiles(firebase_uid);
CREATE INDEX idx_tourist_profiles_session  ON tourist_profiles(session_id);
CREATE INDEX idx_tourist_profiles_token    ON tourist_profiles(magic_token);
CREATE INDEX idx_tourist_profiles_sms      ON tourist_profiles(sms_opt_in) WHERE sms_opt_in = true;
CREATE INDEX idx_tourist_profiles_geo      ON tourist_profiles(last_lat, last_lng) WHERE last_lat IS NOT NULL;

-- 62. TOURIST SWIPE EVENTS (raw behavioral signal)
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_swipe_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tourist_id    UUID NOT NULL REFERENCES tourist_profiles(id) ON DELETE CASCADE,
    business_slug TEXT NOT NULL,         -- references businesses.subdomain
    business_name TEXT,
    category      TEXT,
    direction     TEXT NOT NULL,         -- like | nope | super
    source        TEXT DEFAULT 'swipe',  -- swipe | menu | event | search
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_swipe_tourist   ON tourist_swipe_events(tourist_id);
CREATE INDEX idx_swipe_slug      ON tourist_swipe_events(business_slug);
CREATE INDEX idx_swipe_direction ON tourist_swipe_events(direction);
CREATE INDEX idx_swipe_created   ON tourist_swipe_events(created_at);

-- 63. USER PREFERENCE SCORES (the training output)
-- ============================================
-- Upserted automatically every time a swipe event is recorded.
-- Weights: like +5, save +8, super +15, book +20, view +2, nope -4
CREATE TABLE IF NOT EXISTS user_preference_scores (
    tourist_id    UUID NOT NULL REFERENCES tourist_profiles(id) ON DELETE CASCADE,
    tag           TEXT NOT NULL,         -- 'seafood' | 'waterfront' | 'live-music' | 'happy-hour'
    score         INT  NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tourist_id, tag)
);

CREATE INDEX idx_pref_scores_tourist ON user_preference_scores(tourist_id);
CREATE INDEX idx_pref_scores_score   ON user_preference_scores(tourist_id, score DESC);

-- 64. TOURIST MEMORIES (AI-saved durable facts)
-- ============================================
-- Claude writes to this table via save_memory / update_memory / delete_memory tools.
-- Survives across sessions. Injected into every AI prompt.
CREATE TABLE IF NOT EXISTS tourist_memories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tourist_id    UUID NOT NULL REFERENCES tourist_profiles(id) ON DELETE CASCADE,
    category      TEXT NOT NULL,         -- preference | fact | goal | decision | recurring | note
    key           TEXT NOT NULL,         -- e.g. 'dietary_restriction' | 'trip_goal'
    value         TEXT NOT NULL,
    tags          TEXT[] DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tourist_id, category, key)
);

CREATE INDEX idx_memories_tourist ON tourist_memories(tourist_id);

-- 65. TOURIST SAVES (liked / itinerary places)
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_saves (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tourist_id    UUID NOT NULL REFERENCES tourist_profiles(id) ON DELETE CASCADE,
    business_slug TEXT NOT NULL,
    business_name TEXT,
    category      TEXT,
    hero_image_url TEXT,
    is_super_like BOOLEAN DEFAULT false,
    saved_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tourist_id, business_slug)
);

CREATE INDEX idx_saves_tourist ON tourist_saves(tourist_id);

-- 66. TOURIST AI CONVERSATIONS (chat sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_ai_conversations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tourist_id    UUID NOT NULL REFERENCES tourist_profiles(id) ON DELETE CASCADE,
    title         TEXT,
    channel       TEXT DEFAULT 'app',    -- app | sms | voice
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conv_tourist ON tourist_ai_conversations(tourist_id, updated_at DESC);

-- 67. TOURIST AI MESSAGES (full conversation history)
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_ai_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES tourist_ai_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,       -- user | assistant | tool
    content         TEXT,
    tool_calls      JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_msg_conv ON tourist_ai_messages(conversation_id, created_at);

-- 68. TOURIST SMS LOG (outbound targeted messages)
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_sms_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tourist_id    UUID REFERENCES tourist_profiles(id) ON DELETE SET NULL,
    phone         TEXT NOT NULL,
    message       TEXT NOT NULL,
    trigger_type  TEXT,                  -- daily_digest | geofence | event_reminder | special | welcome
    business_slug TEXT,                  -- which business triggered this
    sent_at       TIMESTAMPTZ DEFAULT NOW(),
    status        TEXT DEFAULT 'sent'    -- sent | failed | delivered
);

CREATE INDEX idx_tourist_sms_tourist  ON tourist_sms_log(tourist_id);
CREATE INDEX idx_tourist_sms_phone    ON tourist_sms_log(phone);
CREATE INDEX idx_tourist_sms_sent     ON tourist_sms_log(sent_at);

-- ============================================================
-- RAG FUNCTIONS (pgvector)
-- ============================================================

-- Semantic search across all embedded business content (ai_chunks)
-- Call from backend: supabase.rpc('match_business_chunks', { query_embedding, match_count, filter_site_ids })
CREATE OR REPLACE FUNCTION match_business_chunks(
    query_embedding vector(1536),
    match_count     INT DEFAULT 8,
    filter_site_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
    id          UUID,
    site_id     UUID,
    chunk_type  TEXT,
    content     TEXT,
    metadata    JSONB,
    similarity  FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.site_id,
        c.chunk_type,
        c.content,
        c.metadata,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM ai_chunks c
    WHERE
        c.embedding IS NOT NULL
        AND (filter_site_ids IS NULL OR c.site_id = ANY(filter_site_ids))
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================
-- PREFERENCE SCORE UPSERT FUNCTION
-- Called from backend after every swipe batch
-- ============================================================
CREATE OR REPLACE FUNCTION upsert_preference_score(
    p_tourist_id UUID,
    p_tag        TEXT,
    p_delta      INT
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO user_preference_scores (tourist_id, tag, score, updated_at)
    VALUES (p_tourist_id, p_tag, p_delta, NOW())
    ON CONFLICT (tourist_id, tag)
    DO UPDATE SET
        score      = GREATEST(-50, LEAST(200, user_preference_scores.score + p_delta)),
        updated_at = NOW();
END;
$$;

-- ============================================================
-- RANKED BUSINESSES VIEW (personalization-ready)
-- Join this with user_preference_scores in the API layer
-- to get a per-user ranked feed
-- ============================================================
CREATE OR REPLACE VIEW gcr_businesses_full AS
SELECT
    b.site_id,
    b.subdomain                   AS slug,
    b.name,
    b.type                        AS category,
    b.emoji,
    b.tagline,
    b.featured,
    b.tags,
    b.price_range,
    b.rating,
    b.review_count,
    b.happy_hour,
    b.kids_friendly,
    b.pet_friendly,
    b.live_music,
    b.outdoor,
    b.waterfront,
    b.beachfront,
    b.gcr_listed,
    b.gcr_verified,
    b.plan,
    b.logo_url,
    b.cover_url,
    sc.address,
    sc.city,
    sc.state,
    sc.lat,
    sc.lng,
    sc.contact_phone              AS phone,
    sc.website_url                AS website,
    sc.about_text                 AS description,
    sc.hours,
    sc.gallery,
    sc.social_links               AS social
FROM businesses b
LEFT JOIN site_content sc ON sc.site_id = b.site_id
WHERE b.gcr_listed = true
  AND b.status = 'active';

-- ============================================
-- DONE!
-- ============================================
