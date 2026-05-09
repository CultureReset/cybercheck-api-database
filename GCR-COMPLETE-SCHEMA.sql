-- ============================================================
-- COMBINED SCHEMA: GCR + CyberCheck Admin + AI
-- Run in GCR Supabase SQL Editor (adpnhipmdefutkzzltbs)
-- Uses IF NOT EXISTS so safe to run on existing database
-- ============================================================


-- ====== 01-tables.sql ======
-- ============================================================
-- CyberCheck Platform — Complete Schema
-- Part 1: Tables + Indexes
-- Run this FIRST in Supabase SQL Editor
-- ============================================================

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. BUSINESSES (one row per customer site)
-- ============================================
CREATE TABLE IF NOT EXISTS businesses (
    site_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE,          -- custom domain: beachsideboats.com
    subdomain VARCHAR(100) UNIQUE,       -- platform subdomain: beachside.cybercheck.com
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,           -- restaurant, bakery, salon, charter, rental, retail, service
    logo_url TEXT,
    cover_url TEXT,
    plan VARCHAR(20) DEFAULT 'free',     -- free, starter, pro, enterprise
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, setup
    gcr_listed BOOLEAN DEFAULT false,    -- listed on GCR public search directory (admin toggle)
    gcr_verified BOOLEAN DEFAULT false,  -- verified by platform admin
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_businesses_domain ON businesses(domain);
CREATE INDEX idx_businesses_subdomain ON businesses(subdomain);
CREATE INDEX idx_businesses_status ON businesses(status);

-- ============================================
-- 2. USERS (business owners + staff who log in)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE,                 -- links to Supabase auth.users
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'owner',    -- owner, staff, admin (platform super-admin)
    avatar_url TEXT,
    password_hash TEXT,
    reset_token TEXT,
    reset_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_site ON users(site_id);
CREATE INDEX idx_users_auth ON users(auth_id);

-- ============================================
-- 3. SITE CONTENT (what the customer website displays)
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
    gallery JSONB DEFAULT '[]',          -- [{url, caption}]
    social_links JSONB DEFAULT '{}',     -- {facebook, instagram, tiktok, twitter}
    logo_url TEXT,
    cover_url TEXT,
    theme_color VARCHAR(7) DEFAULT '#00ada8',
    theme_font VARCHAR(50) DEFAULT 'Inter',
    custom_css TEXT,
    seo_title VARCHAR(255),
    seo_description TEXT,
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
    page_type VARCHAR(50),               -- generated, ai_generated, cloned, custom
    visible BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, slug)
);

CREATE INDEX idx_site_pages_site ON site_pages(site_id);

-- ============================================
-- 5. APPS (marketplace app catalog — global)
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
-- 6. SITE APPS (which apps a business has installed)
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
-- 8. CUSTOMERS (CRM per business)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    notes TEXT,
    tier VARCHAR(20) DEFAULT 'customer', -- customer, vip, blocked
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
-- 9. MENU CATEGORIES (Breakfast, Lunch, Dinner, Happy Hour, etc.)
-- Top-level meal periods that control when a menu shows
-- ============================================
CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,              -- Breakfast, Lunch, Dinner, Happy Hour, Late Night, All Day
    description TEXT,
    time_start TIME,                          -- 06:00 for breakfast, 11:00 for lunch, etc.
    time_end TIME,                            -- 11:00 for breakfast, 15:00 for lunch, etc.
    image_url TEXT,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menu_categories_site ON menu_categories(site_id);

-- ============================================
-- 10. MENU SUBCATEGORIES (Appetizers, Seafood, Burgers, etc.)
-- Nested under a category — Dinner > Appetizers, Lunch > Burgers
-- ============================================
CREATE TABLE IF NOT EXISTS menu_subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,              -- Appetizers, Seafood, Burgers, Pasta, Salads, Gluten Free, Kids Menu
    description TEXT,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menu_subcategories_site ON menu_subcategories(site_id);
CREATE INDEX idx_menu_subcategories_cat ON menu_subcategories(category_id);

-- ============================================
-- 11. MENU ITEMS (individual dishes/products)
-- Each item belongs to a subcategory (which belongs to a category)
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
    tags JSONB DEFAULT '[]',                 -- ["popular","new","spicy","vegetarian","vegan"]
    allergens JSONB DEFAULT '[]',            -- ["gluten","dairy","nuts","shellfish"]
    ingredients TEXT,
    calories INT,
    available BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_menu_items_site ON menu_items(site_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_subcategory ON menu_items(subcategory_id);

-- ============================================
-- 12. SPECIALS / HAPPY HOURS
-- Recurring deals with specific days and times
-- type: happy_hour, daily_special, seasonal, weekend_brunch, late_night
-- ============================================
CREATE TABLE IF NOT EXISTS specials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,              -- 'Happy Hour', 'Taco Tuesday', 'Weekend Brunch'
    description TEXT,
    type VARCHAR(50),                        -- happy_hour, daily_special, seasonal, weekend_brunch, late_night
    days JSONB DEFAULT '[]',                 -- ["monday","tuesday","wednesday","thursday","friday"]
    start_time TIME,                         -- 16:00
    end_time TIME,                           -- 19:00
    recurring BOOLEAN DEFAULT true,          -- repeats weekly
    valid_from DATE,                         -- seasonal: start date (NULL = always)
    valid_until DATE,                        -- seasonal: end date (NULL = always)
    discount_text VARCHAR(255),              -- "50% off apps, $5 drafts, $3 wells"
    discount_type VARCHAR(20),               -- percentage, fixed, bogo, custom
    discount_amount DECIMAL(10,2),           -- 50 (for 50%), 5.00 (for $5 off)
    items JSONB DEFAULT '[]',                -- [{menu_item_id, special_price}]
    drink_specials JSONB DEFAULT '[]',       -- [{"name":"Draft Beer","price":5.00},{"name":"House Wine","price":6.00}]
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_specials_site ON specials(site_id);
CREATE INDEX idx_specials_type ON specials(site_id, type);

-- ============================================
-- 13. EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE,
    start_time TIME,
    end_time TIME,
    recurring BOOLEAN DEFAULT false,
    recurring_day VARCHAR(20),
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_site ON events(site_id);

-- ============================================
-- 14. SERVICES (salon, charter, service businesses)
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
    available BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_services_site ON services(site_id);

-- ============================================
-- 13. AVAILABILITY (time slots for services)
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
-- 14. FLEET TYPES (rental businesses — boat types, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS fleet_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    specs JSONB DEFAULT '{}',
    image_url TEXT,
    sort_order INT DEFAULT 0,
    available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fleet_types_site ON fleet_types(site_id);

-- ============================================
-- 15. FLEET ITEMS (individual physical inventory units)
-- ============================================
CREATE TABLE IF NOT EXISTS fleet_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID NOT NULL REFERENCES fleet_types(id) ON DELETE CASCADE,
    unit_name VARCHAR(100),
    serial_number VARCHAR(100),
    condition VARCHAR(20) DEFAULT 'good', -- good, fair, maintenance, retired
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fleet_items_site ON fleet_items(site_id);
CREATE INDEX idx_fleet_items_type ON fleet_items(fleet_type_id);

-- ============================================
-- 16. RENTAL TIME SLOTS (Half Day AM, PM, All Day, etc.)
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
-- 17. RENTAL PRICING (fleet_type x time_slot = price)
-- ============================================
CREATE TABLE IF NOT EXISTS rental_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID NOT NULL REFERENCES fleet_types(id) ON DELETE CASCADE,
    time_slot_id UUID NOT NULL REFERENCES rental_time_slots(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL,
    UNIQUE(site_id, fleet_type_id, time_slot_id)
);

CREATE INDEX idx_rental_pricing_site ON rental_pricing(site_id);

-- ============================================
-- 18. RENTAL GROUP RATES (bulk discounts)
-- ============================================
CREATE TABLE IF NOT EXISTS rental_group_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID NOT NULL REFERENCES fleet_types(id) ON DELETE CASCADE,
    time_slot_id UUID REFERENCES rental_time_slots(id) ON DELETE CASCADE,
    min_qty INT NOT NULL,
    price_per_unit DECIMAL(10,2) NOT NULL,
    active BOOLEAN DEFAULT true
);

-- ============================================
-- 19. RENTAL ADD-ONS (docks, coolers, gear)
-- ============================================
CREATE TABLE IF NOT EXISTS rental_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50),
    icon VARCHAR(10),
    image_url TEXT,
    per_unit VARCHAR(50) DEFAULT 'per rental',
    available BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rental_addons_site ON rental_addons(site_id);

-- ============================================
-- 20. BOOKINGS (universal — rentals, services, appointments)
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),

    -- What was booked
    service_id UUID REFERENCES services(id),
    fleet_type_id UUID REFERENCES fleet_types(id),
    time_slot_id UUID REFERENCES rental_time_slots(id),

    -- When
    booking_date DATE NOT NULL,
    booking_time TIME,
    end_time TIME,
    duration_minutes INT,

    -- Details
    qty INT DEFAULT 1,
    party_size INT DEFAULT 1,
    addons JSONB DEFAULT '[]',

    -- Money
    subtotal DECIMAL(10,2),
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2),
    deposit DECIMAL(10,2) DEFAULT 0,
    payment_id VARCHAR(255),
    payment_provider VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'unpaid',

    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    waiver_signed BOOLEAN DEFAULT false,

    -- Tracking
    sms_delivered BOOLEAN DEFAULT false,
    review_requested BOOLEAN DEFAULT false,
    booking_token VARCHAR(50),

    -- Customer info (denormalized for speed)
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
-- 21. ORDERS (restaurant, bakery, retail)
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
-- 22. WAIVERS
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
-- 23. REVIEWS
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
-- 24. STAFF / TEAM MEMBERS
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
-- 25. MEDIA LIBRARY
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
-- 26. SMS LOG
-- ============================================
CREATE TABLE IF NOT EXISTS sms_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    to_phone VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'sent',
    related_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_log_site ON sms_log(site_id);

-- ============================================
-- 27. FAQS
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
-- 28. COUPONS
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
-- 29. NOTIFICATIONS
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
-- 30. ACTIVITY LOG (per business)
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
-- 31. AUDIT LOG (platform admin actions)
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
-- 32. TEMPLATES (website templates catalog)
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
-- 33. SUPPORT TICKETS
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
-- 34. PLATFORM CONFIG (AI server URL, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS platform_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 35. CUSTOM DOMAINS (DNS management per business)
-- ============================================
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,       -- beachsidecircleboats.com
    is_primary BOOLEAN DEFAULT false,          -- which domain is the main one
    dns_verified BOOLEAN DEFAULT false,        -- did DNS check pass
    dns_verification_token VARCHAR(100),       -- TXT record token for verification
    ssl_status VARCHAR(20) DEFAULT 'pending',  -- pending, active, error
    ssl_expires_at TIMESTAMPTZ,
    dns_type VARCHAR(10) DEFAULT 'CNAME',      -- CNAME or A record
    dns_target VARCHAR(255),                   -- what they point their DNS to
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_domains_site ON domains(site_id);
CREATE INDEX idx_domains_domain ON domains(domain);

-- ====== 02-gcr-migrations.sql ======
-- ============================================================
-- GCR Migrations — Run in Supabase SQL Editor
-- Run AFTER 01-tables.sql
-- ============================================================

-- ============================================
-- MIGRATION 12: Add GCR columns to businesses
-- ============================================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS emoji          VARCHAR(10)   DEFAULT '🏪';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tagline        VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS featured       BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS tags           JSONB         DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS price_range    VARCHAR(10);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS rating         DECIMAL(3,2);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS review_count   INT           DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS happy_hour     VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS kids_friendly  BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pet_friendly   BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS live_music     BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS outdoor        BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS reservations   BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS alcohol        BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS booking_required BOOLEAN     DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS delivery       BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS takeout        BOOLEAN       DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS sort_order     INT           DEFAULT 0;

-- Index for GCR listing queries
CREATE INDEX IF NOT EXISTS idx_businesses_gcr       ON businesses(gcr_listed, status);
CREATE INDEX IF NOT EXISTS idx_businesses_type      ON businesses(type);
CREATE INDEX IF NOT EXISTS idx_businesses_featured  ON businesses(featured);
CREATE INDEX IF NOT EXISTS idx_businesses_tags      ON businesses USING gin(tags);

-- ============================================
-- Fix events table: add GCR-specific fields
-- ============================================
-- 'name' exists but frontend expects 'title' — add title as alias
ALTER TABLE events ADD COLUMN IF NOT EXISTS title        VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS time         VARCHAR(50);   -- "7pm", "2pm – 5pm"
ALTER TABLE events ADD COLUMN IF NOT EXISTS category     VARCHAR(50);   -- live-music|concert|festival|sports|holiday|bar-event|family|the-wharf
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover        VARCHAR(100);  -- "Free", "$10", "No Cover"
ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_url   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_name   VARCHAR(255);
ALTER TABLE events ADD COLUMN IF NOT EXISTS emoji        VARCHAR(10);
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_charge BOOLEAN DEFAULT false;

-- Keep title/name in sync via trigger (title wins if set, fallback to name)
CREATE OR REPLACE FUNCTION sync_event_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.title IS NOT NULL AND NEW.title != '' THEN
    NEW.name := NEW.title;
  ELSIF NEW.name IS NOT NULL AND NEW.name != '' AND (NEW.title IS NULL OR NEW.title = '') THEN
    NEW.title := NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_event_title ON events;
CREATE TRIGGER trg_sync_event_title
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION sync_event_title();

CREATE INDEX IF NOT EXISTS idx_events_date     ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(site_id, category);

-- ============================================
-- Fix specials table: add GCR filter category
-- ============================================
-- 'type' exists (happy_hour, daily_special, etc.) but GCR filter chips use different values
-- gcr_category maps to filter chips: ayce|daily|weekend|lunch|family|early-bird|kids
ALTER TABLE specials ADD COLUMN IF NOT EXISTS gcr_category VARCHAR(50);  -- ayce|daily|weekend|lunch|family|early-bird|kids
ALTER TABLE specials ADD COLUMN IF NOT EXISTS discount TEXT;             -- flat discount string for display ("$3 wells, $4 drafts")
ALTER TABLE specials ADD COLUMN IF NOT EXISTS items_list JSONB DEFAULT '[]'; -- [{name, description, price}] for expand dropdown

CREATE INDEX IF NOT EXISTS idx_specials_gcr_cat ON specials(site_id, gcr_category);

-- ============================================
-- Fix site_content: add hours_note
-- ============================================
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS hours_note TEXT;  -- "Seasonal hours may vary"

-- ============================================
-- NEW TABLE: artists (musicians / local performers)
-- Listed on the events page "Artists & Musicians" section
-- ============================================
CREATE TABLE IF NOT EXISTS artists (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id      UUID REFERENCES businesses(site_id) ON DELETE SET NULL,  -- linked biz (optional)
    name         VARCHAR(255) NOT NULL,
    slug         VARCHAR(100) UNIQUE,                -- for URL: /artists/tim-roberts
    genre        VARCHAR(100),                       -- "Country Rock", "Beach Pop", "Blues"
    bio          TEXT,
    photo_url    TEXT,
    cover_url    TEXT,
    website      TEXT,
    booking_email VARCHAR(255),
    booking_phone VARCHAR(20),
    social       JSONB DEFAULT '{}',                 -- {instagram, facebook, spotify, tiktok, youtube}
    tags         JSONB DEFAULT '[]',                 -- ["live-music","country","local"]
    gcr_listed   BOOLEAN DEFAULT true,
    featured     BOOLEAN DEFAULT false,
    home_venue   VARCHAR(255),                       -- "Flora-Bama", "The Wharf", etc.
    upcoming_shows JSONB DEFAULT '[]',               -- [{venue, date, time, cover, ticket_url}]
    sort_order   INT DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_gcr    ON artists(gcr_listed);
CREATE INDEX IF NOT EXISTS idx_artists_slug   ON artists(slug);
CREATE INDEX IF NOT EXISTS idx_artists_site   ON artists(site_id);

-- ============================================
-- NEW TABLE: gcr_feed_posts (live local feed)
-- Businesses post updates — shows on /feed page
-- ============================================
CREATE TABLE IF NOT EXISTS gcr_feed_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    type        VARCHAR(50) DEFAULT 'update',   -- update|event|special|news|alert|photo
    text        TEXT,
    image_url   TEXT,
    link_url    TEXT,
    link_text   VARCHAR(100),
    emoji       VARCHAR(10),
    pinned      BOOLEAN DEFAULT false,
    active      BOOLEAN DEFAULT true,
    expires_at  TIMESTAMPTZ,                    -- optional: auto-hide after date
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_site    ON gcr_feed_posts(site_id);
CREATE INDEX IF NOT EXISTS idx_feed_active  ON gcr_feed_posts(active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_pinned  ON gcr_feed_posts(pinned);

-- ============================================
-- NEW TABLE: tourist_sessions
-- Created when tourist signs up via GCR loyalty modal
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID UNIQUE DEFAULT gen_random_uuid(),
    name         TEXT,
    phone        TEXT,
    email        TEXT,
    interests    TEXT[],           -- ['restaurants','boat-rentals','fishing','live-music']
    visitor_type TEXT,             -- tourist|local|snowbird
    checkin      DATE,
    checkout     DATE,
    chat_url     TEXT,             -- generated link sent via SMS
    sms_sent     BOOLEAN DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tourist_sessions_phone   ON tourist_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_tourist_sessions_sid     ON tourist_sessions(session_id);

-- ============================================
-- NEW TABLE: tourist_conversations
-- Grok AI chat history per tourist session
-- ============================================
CREATE TABLE IF NOT EXISTS tourist_conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES tourist_sessions(session_id) ON DELETE CASCADE,
    role       TEXT NOT NULL,   -- user | assistant
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tourist_conv_session ON tourist_conversations(session_id, created_at);

-- ============================================
-- GCR API helper view: full business listing
-- Used by gcr-api.js for the /api/gcr/businesses endpoint
-- ============================================
CREATE OR REPLACE VIEW gcr_businesses_view AS
SELECT
    b.site_id,
    b.subdomain                         AS slug,
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
    -- From site_content
    sc.address,
    sc.city,
    sc.state,
    sc.zip,
    sc.lat,
    sc.lng,
    sc.contact_phone                    AS phone,
    sc.contact_email                    AS email,
    sc.website_url                      AS website,
    sc.hours,
    sc.hours_note,
    sc.about_text                       AS description,
    sc.gallery,
    sc.social_links                     AS social,
    sc.cover_url                        AS cover_image
FROM businesses b
LEFT JOIN site_content sc ON sc.site_id = b.site_id
WHERE b.gcr_listed = true
  AND b.status = 'active'
ORDER BY b.featured DESC, b.sort_order ASC, b.name ASC;

-- ============================================
-- NEW TABLE: artist_shows
-- Links an artist to a venue + date (the co-op data)
-- When artist adds a show → also appears on venue's events page
-- ============================================
CREATE TABLE IF NOT EXISTS artist_shows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id   UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    site_id     UUID REFERENCES businesses(site_id) ON DELETE SET NULL,  -- venue (null = external venue)
    venue_name  VARCHAR(255) NOT NULL,      -- "Flora-Bama" (fallback if no site_id)
    venue_city  VARCHAR(100),
    show_date   DATE NOT NULL,
    start_time  VARCHAR(50),               -- "7pm", "8:30pm"
    end_time    VARCHAR(50),
    show_type   VARCHAR(50) DEFAULT 'live-music',  -- live-music|acoustic|duo|trio|headline
    cover       VARCHAR(100) DEFAULT 'Free',       -- "Free", "$10", "No Cover"
    ticket_url  TEXT,
    notes       TEXT,
    active      BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_shows_artist  ON artist_shows(artist_id, show_date);
CREATE INDEX IF NOT EXISTS idx_artist_shows_venue   ON artist_shows(site_id, show_date);
CREATE INDEX IF NOT EXISTS idx_artist_shows_date    ON artist_shows(show_date);

-- ============================================
-- NEW TABLE: song_requests
-- Fan requests during a live show
-- Artist manages queue from their dashboard
-- ============================================
CREATE TABLE IF NOT EXISTS song_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id      UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    show_id        UUID REFERENCES artist_shows(id) ON DELETE SET NULL,
    song_name      VARCHAR(255) NOT NULL,
    requester_name VARCHAR(100),
    tip_amount     DECIMAL(6,2) DEFAULT 0,
    tip_method     VARCHAR(20),            -- venmo|cashapp|paypal
    tip_handle     VARCHAR(100),           -- their handle for confirmation
    position       INT DEFAULT 0,          -- queue position (lower = higher priority)
    status         VARCHAR(20) DEFAULT 'pending',  -- pending|played|skipped
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_song_requests_artist  ON song_requests(artist_id, status, position);
CREATE INDEX IF NOT EXISTS idx_song_requests_show    ON song_requests(show_id, status);

-- ============================================
-- MISSING #1: businesses.area — geographic area tag
-- Critical for location-based filtering on GCR
-- ============================================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS area VARCHAR(50);
-- Values: orange-beach | gulf-shores | perdido-key | the-wharf | owa | foley | fort-morgan

CREATE INDEX IF NOT EXISTS idx_businesses_area ON businesses(area);

-- ============================================
-- MISSING #2: events.artist_id — co-op data link
-- When artist adds a show → event row created here
-- Shows on BOTH the venue's GCR page AND artist's profile
-- ============================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES artists(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS artist_name VARCHAR(255);  -- denormalized for speed

CREATE INDEX IF NOT EXISTS idx_events_artist ON events(artist_id);

-- ============================================
-- MISSING #3: services — package/charter inclusions
-- Fishing charters, boat tours, parasailing have "what's included"
-- ============================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS whats_included  JSONB DEFAULT '[]';  -- ["Fuel","Bait","Life Jackets","Captain"]
ALTER TABLE services ADD COLUMN IF NOT EXISTS min_guests       INT DEFAULT 1;
ALTER TABLE services ADD COLUMN IF NOT EXISTS max_guests       INT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS booking_url      TEXT;               -- external booking link override
ALTER TABLE services ADD COLUMN IF NOT EXISTS notes            TEXT;               -- "Weather permitting", "Minimum age 6"

-- ============================================
-- MISSING #4: gcr_claims — business claim requests
-- When someone fills out claim.html, tracked here
-- Admin approves → business gets a CyberCheck account
-- ============================================
CREATE TABLE IF NOT EXISTS gcr_claims (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id        UUID REFERENCES businesses(site_id) ON DELETE SET NULL,  -- linked listing (if exists)
    business_name  VARCHAR(255) NOT NULL,
    claimant_name  VARCHAR(255) NOT NULL,
    claimant_email VARCHAR(255) NOT NULL,
    claimant_phone VARCHAR(20),
    business_role  VARCHAR(100),           -- "Owner", "Manager", "Marketing"
    notes          TEXT,                   -- how they want to use the platform
    claim_type     VARCHAR(50) DEFAULT 'business',  -- business | artist | event
    status         VARCHAR(20) DEFAULT 'pending',   -- pending | approved | denied | contacted
    admin_notes    TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gcr_claims_status ON gcr_claims(status);
CREATE INDEX IF NOT EXISTS idx_gcr_claims_email  ON gcr_claims(claimant_email);

-- ============================================
-- MISSING #5: loyalty_signups — GCR loyalty modal
-- Simpler than tourist_sessions — just name + email/phone
-- Feeds into marketing list + optionally creates a tourist_session
-- ============================================
CREATE TABLE IF NOT EXISTS loyalty_signups (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(255),
    email          VARCHAR(255),
    phone          VARCHAR(20),
    visitor_type   VARCHAR(50),            -- tourist | local | snowbird
    interests      TEXT[],
    checkin        DATE,
    checkout       DATE,
    source         VARCHAR(100),           -- which page/modal they signed up on
    session_id     UUID REFERENCES tourist_sessions(session_id) ON DELETE SET NULL,  -- if they went full AI agent
    sms_sent       BOOLEAN DEFAULT false,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_email ON loyalty_signups(email);
CREATE INDEX IF NOT EXISTS idx_loyalty_phone ON loyalty_signups(phone);

-- ============================================
-- PHASE 1B: Final missing columns
-- ============================================

-- businesses.subcategory — the filter chip value for that business
-- Separate from tags[] so filtering is a single column equality check
-- restaurants: seafood|italian|burgers|bbq|pizza|mexican|breakfast|waterfront|bar-food
-- things-to-do: boat-rentals|fishing|parasailing|dolphin-tours|kayaking|paddleboarding|golf|mini-golf|arcade|free
-- nightlife: bar|beach-bar|sports-bar|late-night|karaoke
-- coffee-sweets: coffee|bakery|ice-cream|sweets
-- shopping: clothing|gifts|beachwear|souvenirs|jewelry|home-decor
-- hotels: resort|oceanfront|pet-friendly|pool
-- services: salon|spa|fitness|photography|cleaning|repair
-- other: public-beach|boat-launch|parking|free
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subcategory VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_businesses_subcategory ON businesses(type, subcategory);

-- High-value boolean attributes — AI uses these for natural language queries
-- "waterfront restaurant with outdoor seating that's pet friendly"
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS waterfront   BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS beachfront   BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS dockside     BOOLEAN DEFAULT false;  -- boat-accessible, dock parking
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS gluten_free  BOOLEAN DEFAULT false;  -- has gluten-free menu options
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS vegan        BOOLEAN DEFAULT false;  -- has vegan options
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS vegetarian   BOOLEAN DEFAULT false;

-- menu_items.section — flat section label for restaurants that don't use the
-- full category/subcategory hierarchy (just "Starters", "Mains", "Desserts")
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS section       VARCHAR(100);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS dietary_tags  JSONB DEFAULT '[]';
-- dietary_tags values: ["gluten-free","vegan","vegetarian","dairy-free","nut-free","spicy","kids","popular"]
CREATE INDEX IF NOT EXISTS idx_menu_items_section ON menu_items(site_id, section);
CREATE INDEX IF NOT EXISTS idx_menu_items_dietary ON menu_items USING gin(dietary_tags);

-- events — kid-friendly flag + age restriction
ALTER TABLE events ADD COLUMN IF NOT EXISTS kids_friendly  BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS age_limit      VARCHAR(20);  -- "21+", "18+", "All Ages"
ALTER TABLE events ADD COLUMN IF NOT EXISTS pet_friendly   BOOLEAN DEFAULT false;

-- services (things-to-do packages) — age/kids flags
-- e.g. "Minimum age 6" for parasailing, "Family friendly" for dolphin tours
ALTER TABLE services ADD COLUMN IF NOT EXISTS kids_friendly  BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS age_minimum    INT;           -- minimum age in years
ALTER TABLE services ADD COLUMN IF NOT EXISTS weight_limit   INT;           -- lbs, for parasailing/rentals
ALTER TABLE services ADD COLUMN IF NOT EXISTS pet_friendly   BOOLEAN DEFAULT false;

-- artists.user_id — links artist to a CyberCheck login account
-- Same users table as business owners, role = 'artist'
ALTER TABLE artists ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_artists_user ON artists(user_id);

-- gcr_feed_posts — denormalized business name + logo for fast rendering
-- Avoids a JOIN on every feed render
ALTER TABLE gcr_feed_posts ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE gcr_feed_posts ADD COLUMN IF NOT EXISTS business_logo TEXT;

-- ============================================
-- Sample data: GCR page subcategory reference
-- (not stored in DB — just here for reference)
-- ============================================
-- restaurants:   seafood|italian|burgers|bbq|pizza|mexican|breakfast|waterfront|gluten-free|vegan|bar-food
-- things-to-do:  boat-rentals|fishing|parasailing|dolphin-tours|kayaking|paddleboarding|golf|mini-golf|arcade|free
-- happy-hours:   bar|beach-bar|sports-bar|waterfront|live-music|food-specials
-- specials:      ayce|daily|weekend|lunch|family|early-bird|kids
-- events:        live-music|concert|festival|sports|family|bar-event|holiday|the-wharf
-- shopping:      clothing|gifts|beachwear|souvenirs|jewelry|home-decor
-- coffee-sweets: coffee|bakery|ice-cream|sweets
-- hotels:        resort|beach-access|pet-friendly|pool|oceanfront
-- services:      salon|spa|cleaning|repair|fitness|photography|childcare
-- other:         public-beach|boat-launch|parking|free
-- nightlife:     bar|live-music|beach-bar|sports-bar|late-night|karaoke

-- ============================================
-- RENTAL TABLE FIXES (for gcr-push.js compatibility)
-- 01-tables.sql uses time_slot_id FK; gcr-push.js uses slot_label text
-- These alters make the tables work with the push script
-- ============================================

-- fleet_types: add featured + active flags used by push script
ALTER TABLE fleet_types ADD COLUMN IF NOT EXISTS featured   BOOLEAN DEFAULT false;
ALTER TABLE fleet_types ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT true;

-- rental_pricing: add slot_label text column + active flag
-- time_slot_id is nullable so push script rows (no time slot FK) work
ALTER TABLE rental_pricing ADD COLUMN IF NOT EXISTS slot_label VARCHAR(100);
ALTER TABLE rental_pricing ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT true;
ALTER TABLE rental_pricing ALTER COLUMN time_slot_id DROP NOT NULL;

-- rental_group_rates: push script sends title/description/price/price_label
-- fleet_type_id and min_qty are optional for GCR group rate display
ALTER TABLE rental_group_rates ADD COLUMN IF NOT EXISTS title       VARCHAR(255);
ALTER TABLE rental_group_rates ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rental_group_rates ADD COLUMN IF NOT EXISTS price       DECIMAL(10,2);
ALTER TABLE rental_group_rates ADD COLUMN IF NOT EXISTS price_label VARCHAR(100);
ALTER TABLE rental_group_rates ADD COLUMN IF NOT EXISTS active      BOOLEAN DEFAULT true;
ALTER TABLE rental_group_rates ALTER COLUMN fleet_type_id DROP NOT NULL;
ALTER TABLE rental_group_rates ALTER COLUMN min_qty       DROP NOT NULL;

-- rental_addons: docks need price_half/price_full; accessories need unit/badge/specs/features
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS price_half DECIMAL(10,2);
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS price_full DECIMAL(10,2);
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS badge      VARCHAR(50);
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS specs      TEXT;
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS features   JSONB DEFAULT '[]';
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS unit       VARCHAR(50);
ALTER TABLE rental_addons ADD COLUMN IF NOT EXISTS active     BOOLEAN DEFAULT true;
ALTER TABLE rental_addons ALTER COLUMN price DROP NOT NULL;

-- ====== 03-concierge-schema.sql ======
-- ============================================================
-- 03-concierge-schema.sql
-- Gulf Coast Radar — Tourist Concierge + Voice AI Schema
-- Run this in Supabase SQL Editor AFTER 01 and 02
-- ============================================================

-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- SECTION 1 — RAG / VECTOR SEARCH
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  chunk_type      TEXT NOT NULL,
  -- 'about'|'menu'|'hours'|'specials'|'reviews'|'packages'
  -- 'faq'|'amenities'|'vibe'|'tips'|'logistics'|'area'|'local-knowledge'
  content         TEXT NOT NULL,
  embedding       vector(1536),
  metadata        JSONB DEFAULT '{}',
  source          TEXT DEFAULT 'admin',
  -- 'admin'|'owner'|'scraper'|'ai-generated'
  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chunks_embedding_idx
  ON ai_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS ai_chunks_site_id_idx ON ai_chunks(site_id);
CREATE INDEX IF NOT EXISTS ai_chunks_type_idx ON ai_chunks(chunk_type);

-- Pre-built Q&A pairs the AI learns from
CREATE TABLE IF NOT EXISTS qa_pairs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  -- NULL site_id = general GCR/area knowledge
  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  category        TEXT,
  -- 'hours'|'parking'|'menu'|'booking'|'directions'|'price'|'policy'
  embedding       vector(1536),
  confidence      DECIMAL(3,2) DEFAULT 1.0,
  active          BOOL DEFAULT true,
  created_at      TIMESTAMP DEFAULT now()
);

-- ============================================================
-- SECTION 2 — RICH BUSINESS DATA
-- ============================================================

-- Core AI-ready descriptions
CREATE TABLE IF NOT EXISTS business_details (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  elevator_pitch        TEXT,
  -- "Cosmo's is a waterfront seafood spot on Cotton Bayou..."
  vibe_description      TEXT,
  -- "lively beach bar, usually packed by noon on weekends"
  who_its_for           TEXT,
  -- "perfect for families, large groups, first-timers"
  what_to_expect        TEXT,
  -- "order at counter, seats inside and out, expect wait on weekends"
  signature_dish        TEXT,
  signature_drink       TEXT,
  must_try              TEXT[],
  avoid                 TEXT[],
  local_favorite        BOOL DEFAULT false,
  tourist_trap          BOOL DEFAULT false,
  award_winning         BOOL DEFAULT false,
  awards                TEXT[],
  years_in_business     INT,
  owner_name            TEXT,
  insider_tip           TEXT,
  best_kept_secret      TEXT,
  pro_tip               TEXT,
  best_time_of_day      TEXT,
  best_days             TEXT[],
  worst_days            TEXT[],
  avg_wait_time         TEXT,
  avg_visit_duration    TEXT,
  updated_at            TIMESTAMP DEFAULT now()
);

-- Parking, access, directions
CREATE TABLE IF NOT EXISTS business_logistics (
  site_id                   UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  parking_type              TEXT,
  -- 'free'|'paid'|'valet'|'street'|'none'
  parking_notes             TEXT,
  parking_lot_size          TEXT,
  -- 'small'|'medium'|'large'
  wheelchair_accessible     BOOL DEFAULT false,
  stroller_friendly         BOOL DEFAULT false,
  elevator                  BOOL DEFAULT false,
  waterfront_access         BOOL DEFAULT false,
  boat_accessible           BOOL DEFAULT false,
  dock_available            BOOL DEFAULT false,
  reservations              TEXT DEFAULT 'walk-in',
  -- 'required'|'recommended'|'walk-in-only'|'optional'
  reservation_url           TEXT,
  reservation_phone         TEXT,
  waitlist_app              TEXT,
  directions_note           TEXT,
  landmark                  TEXT,
  uber_friendly             BOOL DEFAULT true,
  golf_cart_parking         BOOL DEFAULT false,
  distance_from_beach       TEXT,
  distance_from_wharf       TEXT,
  updated_at                TIMESTAMP DEFAULT now()
);

-- Vibe, features, atmosphere
CREATE TABLE IF NOT EXISTS business_atmosphere (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  noise_level           TEXT,
  -- 'quiet'|'moderate'|'lively'|'loud'
  lighting              TEXT,
  seating_types         TEXT[],
  -- ['bar','booth','patio','rooftop','waterfront','picnic']
  dress_code            TEXT DEFAULT 'beach casual',
  avg_age_range         TEXT,
  live_music            BOOL DEFAULT false,
  live_music_schedule   TEXT,
  live_music_genre      TEXT,
  dance_floor           BOOL DEFAULT false,
  sports_tv             BOOL DEFAULT false,
  karaoke               BOOL DEFAULT false,
  trivia_night          TEXT,
  outdoor_seating       BOOL DEFAULT false,
  covered_outdoor       BOOL DEFAULT false,
  fire_pit              BOOL DEFAULT false,
  ocean_view            BOOL DEFAULT false,
  bay_view              BOOL DEFAULT false,
  sunset_view           BOOL DEFAULT false,
  wifi                  BOOL DEFAULT false,
  wifi_password         TEXT,
  charging_stations     BOOL DEFAULT false,
  pool_table            BOOL DEFAULT false,
  arcade_games          BOOL DEFAULT false,
  gift_shop             BOOL DEFAULT false,
  updated_at            TIMESTAMP DEFAULT now()
);

-- Food & drink specifics
CREATE TABLE IF NOT EXISTS menu_details (
  site_id                   UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  cuisine_types             TEXT[],
  cooking_styles            TEXT[],
  sourcing_note             TEXT,
  vegetarian_options        BOOL DEFAULT false,
  vegan_options             BOOL DEFAULT false,
  gluten_free_options       BOOL DEFAULT false,
  gluten_free_menu          BOOL DEFAULT false,
  dairy_free_options        BOOL DEFAULT false,
  nut_allergy_friendly      BOOL DEFAULT false,
  kids_menu                 BOOL DEFAULT false,
  kids_eat_free             TEXT,
  full_bar                  BOOL DEFAULT false,
  craft_beer                BOOL DEFAULT false,
  local_beer                BOOL DEFAULT false,
  wine_list                 BOOL DEFAULT false,
  signature_cocktails       BOOL DEFAULT false,
  byob                      BOOL DEFAULT false,
  corkage_fee               TEXT,
  happy_hour                BOOL DEFAULT false,
  happy_hour_schedule       TEXT,
  happy_hour_deals          TEXT,
  service_style             TEXT,
  -- 'table service'|'counter order'|'buffet'|'food truck'
  avg_check_per_person      TEXT,
  takeout                   BOOL DEFAULT false,
  delivery                  BOOL DEFAULT false,
  delivery_apps             TEXT[],
  catering                  BOOL DEFAULT false,
  updated_at                TIMESTAMP DEFAULT now()
);

-- Activities, tours, charters
CREATE TABLE IF NOT EXISTS activity_details (
  site_id                   UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  activity_type             TEXT,
  -- 'fishing-charter'|'boat-rental'|'dolphin-tour'|'kayak'|'parasail'|'jet-ski'
  difficulty                TEXT DEFAULT 'easy',
  physical_required         TEXT,
  min_age                   INT,
  max_age                   INT,
  min_weight_lbs            INT,
  max_weight_lbs            INT,
  swimming_required         BOOL DEFAULT false,
  experience_required       BOOL DEFAULT false,
  experience_note           TEXT,
  duration_hours            DECIMAL(4,1),
  departure_location        TEXT,
  departure_lat             DECIMAL(10,7),
  departure_lng             DECIMAL(10,7),
  what_to_bring             TEXT[],
  what_is_provided          TEXT[],
  fish_species              TEXT[],
  fishing_type              TEXT,
  -- 'inshore'|'offshore'|'deep-sea'|'bay'|'surf'
  trip_types                TEXT[],
  advance_booking_required  TEXT,
  cancellation_policy       TEXT,
  deposit_required          BOOL DEFAULT false,
  deposit_amount            DECIMAL(8,2),
  updated_at                TIMESTAMP DEFAULT now()
);

-- Hotels & accommodations
CREATE TABLE IF NOT EXISTS accommodation_details (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  star_rating           DECIMAL(2,1),
  total_rooms           INT,
  floors                INT,
  year_built            INT,
  year_renovated        INT,
  beachfront            BOOL DEFAULT false,
  beach_access          TEXT,
  beach_chairs_included BOOL DEFAULT false,
  pools                 INT DEFAULT 0,
  indoor_pool           BOOL DEFAULT false,
  heated_pool           BOOL DEFAULT false,
  lazy_river            BOOL DEFAULT false,
  waterslide            BOOL DEFAULT false,
  restaurant_on_site    BOOL DEFAULT false,
  bar_on_site           BOOL DEFAULT false,
  gym                   BOOL DEFAULT false,
  spa                   BOOL DEFAULT false,
  business_center       BOOL DEFAULT false,
  resort_fee            DECIMAL(8,2),
  resort_fee_includes   TEXT[],
  parking_fee           TEXT,
  pet_fee               TEXT,
  check_in_time         TEXT DEFAULT '4:00 PM',
  check_out_time        TEXT DEFAULT '11:00 AM',
  min_age_to_book       INT DEFAULT 21,
  pets_allowed          BOOL DEFAULT false,
  pet_size_limit        TEXT,
  smoking_policy        TEXT DEFAULT 'non-smoking',
  updated_at            TIMESTAMP DEFAULT now()
);

-- Packages (tours, charters, activities, hotels)
CREATE TABLE IF NOT EXISTS packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  price           DECIMAL(10,2),
  price_label     TEXT,
  -- 'per person'|'per boat'|'per night'|'flat rate'
  duration_minutes INT,
  whats_included  TEXT[],
  min_guests      INT DEFAULT 1,
  max_guests      INT,
  booking_url     TEXT,
  advance_hours   INT DEFAULT 24,
  -- how many hours ahead to book
  active          BOOL DEFAULT true,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT now()
);

-- Room types for hotels
CREATE TABLE IF NOT EXISTS room_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  -- 'King Suite', 'Gulf Front Double', 'Studio'
  description     TEXT,
  price_per_night DECIMAL(10,2),
  price_weekend   DECIMAL(10,2),
  price_peak      DECIMAL(10,2),
  max_guests      INT,
  beds            TEXT,
  -- '1 King', '2 Queens', 'Bunk beds + Queen'
  sqft            INT,
  floor           TEXT,
  view            TEXT,
  -- 'gulf front'|'bay view'|'pool view'|'garden'
  amenities       TEXT[],
  image_url       TEXT,
  booking_url     TEXT,
  active          BOOL DEFAULT true,
  sort_order      INT DEFAULT 0
);

-- Business photos
CREATE TABLE IF NOT EXISTS photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  caption         TEXT,
  category        TEXT DEFAULT 'general',
  -- 'food'|'interior'|'exterior'|'menu'|'staff'|'event'|'view'
  featured        BOOL DEFAULT false,
  sort_order      INT DEFAULT 0,
  uploaded_by     TEXT DEFAULT 'admin',
  created_at      TIMESTAMP DEFAULT now()
);

-- Price guide for AI to quote
CREATE TABLE IF NOT EXISTS price_guide (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  price       DECIMAL(8,2),
  price_label TEXT,
  -- 'market price'|'seasonal'|'per person'
  category    TEXT,
  -- 'appetizer'|'entree'|'drink'|'dessert'|'activity'|'room'
  note        TEXT,
  active      BOOL DEFAULT true
);

-- Hours exceptions (holidays, closures, special hours)
CREATE TABLE IF NOT EXISTS hours_exceptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  closed      BOOL DEFAULT false,
  open_time   TIME,
  close_time  TIME,
  note        TEXT,
  -- "Closed Thanksgiving", "Holiday hours"
  created_at  TIMESTAMP DEFAULT now()
);

-- AI voice scripts per business
CREATE TABLE IF NOT EXISTS ai_voice_scripts (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  short_answer          TEXT,
  -- 1 sentence for quick voice response
  medium_answer         TEXT,
  -- 2-3 sentences
  full_answer           TEXT,
  -- complete description
  how_to_get_there      TEXT,
  -- spoken directions
  what_to_order         TEXT,
  -- "I'd recommend the grouper sandwich"
  reservation_script    TEXT,
  hours_script          TEXT,
  price_script          TEXT,
  -- "Expect to spend around $15-25 per person"
  kids_script           TEXT,
  -- specific note about kids/families
  pets_script           TEXT,
  updated_at            TIMESTAMP DEFAULT now()
);

-- Data completeness tracking
CREATE TABLE IF NOT EXISTS business_data_status (
  site_id               UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  has_basic_info        BOOL DEFAULT false,
  has_photos            BOOL DEFAULT false,
  has_description       BOOL DEFAULT false,
  has_hours             BOOL DEFAULT false,
  has_contact           BOOL DEFAULT false,
  has_menu              BOOL DEFAULT false,
  has_packages          BOOL DEFAULT false,
  has_specials          BOOL DEFAULT false,
  has_events            BOOL DEFAULT false,
  has_reviews           BOOL DEFAULT false,
  has_ai_script         BOOL DEFAULT false,
  has_highlights        BOOL DEFAULT false,
  has_logistics         BOOL DEFAULT false,
  has_atmosphere        BOOL DEFAULT false,
  has_embeddings        BOOL DEFAULT false,
  completeness_score    INT DEFAULT 0,
  data_tier             TEXT DEFAULT 'stub',
  -- 'stub'|'basic'|'full'|'ai-ready'
  last_updated_by       TEXT,
  last_updated_at       TIMESTAMP DEFAULT now(),
  claimed_by_owner      BOOL DEFAULT false,
  needs_review          BOOL DEFAULT false,
  notes                 TEXT
);

-- ============================================================
-- SECTION 3 — MASTER FILTER TABLE (multi-criteria search)
-- ============================================================

CREATE TABLE IF NOT EXISTS business_filters (
  site_id                   UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,

  -- Food
  cuisine                   TEXT[],
  dietary_gluten_free       BOOL DEFAULT false,
  dietary_vegan             BOOL DEFAULT false,
  dietary_vegetarian        BOOL DEFAULT false,
  dietary_halal             BOOL DEFAULT false,
  kids_menu                 BOOL DEFAULT false,
  kids_eat_free             BOOL DEFAULT false,
  byob                      BOOL DEFAULT false,
  full_bar                  BOOL DEFAULT false,
  craft_beer                BOOL DEFAULT false,
  wine_list                 BOOL DEFAULT false,

  -- Happy hour
  has_happy_hour            BOOL DEFAULT false,
  happy_hour_days           TEXT[],
  happy_hour_start          TIME,
  happy_hour_end            TIME,
  happy_hour_deals          TEXT,

  -- Live music
  has_live_music            BOOL DEFAULT false,
  live_music_days           TEXT[],
  live_music_start          TIME,
  live_music_end            TIME,
  live_music_genre          TEXT[],

  -- Atmosphere
  outdoor_seating           BOOL DEFAULT false,
  waterfront                BOOL DEFAULT false,
  rooftop                   BOOL DEFAULT false,
  pet_friendly              BOOL DEFAULT false,
  kid_friendly              BOOL DEFAULT false,
  romantic                  BOOL DEFAULT false,
  group_friendly            BOOL DEFAULT false,
  sports_tv                 BOOL DEFAULT false,
  dance_floor               BOOL DEFAULT false,

  -- Logistics
  reservations_required     BOOL DEFAULT false,
  parking_free              BOOL DEFAULT false,
  wheelchair_accessible     BOOL DEFAULT false,
  boat_dock                 BOOL DEFAULT false,
  golf_cart_parking         BOOL DEFAULT false,

  -- Price
  price_range               TEXT,
  avg_check_min             DECIMAL(8,2),
  avg_check_max             DECIMAL(8,2),

  -- Hours (denormalized for fast query)
  open_monday               BOOL DEFAULT false,
  open_tuesday              BOOL DEFAULT false,
  open_wednesday            BOOL DEFAULT false,
  open_thursday             BOOL DEFAULT false,
  open_friday               BOOL DEFAULT false,
  open_saturday             BOOL DEFAULT false,
  open_sunday               BOOL DEFAULT false,
  open_time                 TIME,
  close_time                TIME,
  open_late                 BOOL DEFAULT false,
  open_early                BOOL DEFAULT false,

  -- Activities
  has_fishing               BOOL DEFAULT false,
  has_boat_rental           BOOL DEFAULT false,
  has_water_sports          BOOL DEFAULT false,
  has_tours                 BOOL DEFAULT false,
  has_golf                  BOOL DEFAULT false,
  has_arcade                BOOL DEFAULT false,

  updated_at                TIMESTAMP DEFAULT now()
);

-- ============================================================
-- SECTION 4 — AREA KNOWLEDGE
-- ============================================================

CREATE TABLE IF NOT EXISTS area_knowledge (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  -- 'Orange Beach'|'Gulf Shores'|'Fort Morgan'|'Perdido Key'
  description     TEXT,
  vibe            TEXT,
  best_for        TEXT[],
  avoid_if        TEXT[],
  distance_from_airport TEXT,
  insider_note    TEXT,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS neighborhoods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  area            TEXT,
  description     TEXT,
  walkable        BOOL DEFAULT false,
  best_for        TEXT[],
  parking_note    TEXT,
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7),
  radius_miles    DECIMAL(4,2)
);

CREATE TABLE IF NOT EXISTS beaches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  area            TEXT,
  crowd_level     TEXT,
  best_for        TEXT[],
  facilities      TEXT[],
  parking         TEXT,
  parking_fee     TEXT,
  dog_friendly    BOOL DEFAULT false,
  alcohol_allowed BOOL DEFAULT false,
  lifeguard       BOOL DEFAULT false,
  flag_system     BOOL DEFAULT true,
  insider_tip     TEXT,
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7)
);

CREATE TABLE IF NOT EXISTS local_tips (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT,
  -- 'beach'|'food'|'parking'|'safety'|'money-saving'|'weather'|'traffic'
  tip         TEXT NOT NULL,
  source      TEXT DEFAULT 'local',
  area        TEXT,
  seasonal    BOOL DEFAULT false,
  season      TEXT,
  active      BOOL DEFAULT true,
  upvotes     INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hidden_gems (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  why_hidden          TEXT,
  how_to_find         TEXT,
  best_kept_secret    TEXT,
  verified_local      BOOL DEFAULT false,
  created_at          TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS money_saving_tips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area            TEXT,
  tip             TEXT NOT NULL,
  saves_amount    TEXT,
  valid_days      TEXT[],
  valid_times     TEXT,
  site_id         UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  active          BOOL DEFAULT true
);

CREATE TABLE IF NOT EXISTS comparisons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_a      UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  business_b      UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  category        TEXT,
  a_wins_at       TEXT[],
  b_wins_at       TEXT[],
  summary         TEXT,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transportation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT,
  -- 'uber'|'lyft'|'golf-cart-rental'|'trolley'|'bike-rental'|'water-taxi'
  name            TEXT,
  description     TEXT,
  coverage_area   TEXT,
  price_estimate  TEXT,
  contact         TEXT,
  website         TEXT,
  tip             TEXT,
  active          BOOL DEFAULT true
);

CREATE TABLE IF NOT EXISTS emergency_info (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        TEXT,
  -- 'hospital'|'urgent-care'|'pharmacy'|'police'|'coast-guard'|'vet'
  name            TEXT NOT NULL,
  address         TEXT,
  phone           TEXT,
  hours           TEXT,
  distance_note   TEXT,
  lat             DECIMAL(10,7),
  lng             DECIMAL(10,7)
);

CREATE TABLE IF NOT EXISTS grocery_and_supplies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT,
  -- 'grocery'|'liquor'|'bait'|'beach-supplies'|'pharmacy'|'convenience'
  area        TEXT,
  address     TEXT,
  hours       TEXT,
  note        TEXT,
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7)
);

CREATE TABLE IF NOT EXISTS seasonal_info (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  season          TEXT,
  -- 'spring-break'|'summer'|'fall'|'winter'|'snowbird'
  note            TEXT,
  best_months     TEXT[],
  crowd_level     TEXT,
  price_level     TEXT,
  -- 'peak'|'shoulder'|'off-season'
  special_hours   TEXT
);

CREATE TABLE IF NOT EXISTS live_conditions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area                TEXT NOT NULL,
  updated_at          TIMESTAMP DEFAULT now(),
  crowd_level         TEXT,
  traffic_note        TEXT,
  weather_advisory    TEXT,
  beach_flag          TEXT,
  -- 'green'|'yellow'|'red'|'double-red'
  water_temp_f        INT,
  wave_height         TEXT,
  jellyfish_warning   BOOL DEFAULT false,
  special_note        TEXT
);

-- ============================================================
-- SECTION 5 — TOURIST IDENTITY + FULL MEMORY
-- ============================================================

CREATE TABLE IF NOT EXISTS tourists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT UNIQUE,
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT,
  arrival_date    DATE,
  checkout_date   DATE,
  trip_active     BOOL DEFAULT true,
  hotel_name      TEXT,
  hotel_area      TEXT,
  hotel_site_id   UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  signup_source   TEXT DEFAULT 'sms',
  -- 'sms'|'qr-code'|'hotel-kiosk'|'referral'|'web'
  referral_business UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  agent_active    BOOL DEFAULT false,
  last_active_at  TIMESTAMP,
  total_conversations INT DEFAULT 0,
  created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tourist_memory (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id            UUID REFERENCES tourists(id) ON DELETE CASCADE,

  -- Party
  party_size            INT,
  adults                INT,
  children              INT,
  children_ages         INT[],
  has_pets              BOOL DEFAULT false,
  pet_details           TEXT,

  -- Budget
  budget_level          TEXT,
  daily_spend_estimate  DECIMAL(8,2),

  -- Dietary (critical)
  dietary_restrictions  TEXT[],
  food_preferences      TEXT[],
  food_dislikes         TEXT[],
  drinks_alcohol        BOOL DEFAULT true,

  -- Interests
  primary_interests     TEXT[],
  activity_level        TEXT DEFAULT 'moderate',
  -- 'relaxed'|'moderate'|'active'|'adventurous'

  -- Mobility
  mobility_needs        TEXT,
  wheelchair            BOOL DEFAULT false,
  stroller              BOOL DEFAULT false,

  -- Learned preferences
  prefers_outdoor       BOOL,
  prefers_waterfront    BOOL,
  prefers_quiet         BOOL,
  prefers_lively        BOOL,
  loved_vibes           TEXT[],
  hated_vibes           TEXT[],

  -- Logistics
  has_car               BOOL DEFAULT true,
  car_count             INT DEFAULT 1,
  uses_rideshare        BOOL DEFAULT false,
  max_drive_minutes     INT DEFAULT 20,

  updated_at            TIMESTAMP DEFAULT now()
);

-- Every place they visited + reaction
CREATE TABLE IF NOT EXISTS tourist_visits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id          UUID REFERENCES tourists(id) ON DELETE CASCADE,
  site_id             UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  visit_date          DATE,
  meal_type           TEXT,
  -- 'breakfast'|'lunch'|'dinner'|'drinks'|'activity'|'shopping'
  rating              INT CHECK (rating BETWEEN 1 AND 5),
  liked               TEXT[],
  disliked            TEXT[],
  would_return        BOOL,
  recommend_to_others BOOL,
  tourist_quote       TEXT,
  -- exact words they said
  recommended_by      TEXT DEFAULT 'agent',
  created_at          TIMESTAMP DEFAULT now()
);

-- Every recommendation the agent made
CREATE TABLE IF NOT EXISTS agent_recommendations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id            UUID REFERENCES tourists(id) ON DELETE CASCADE,
  site_id               UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  recommendation_rank   INT DEFAULT 1,
  why_recommended       TEXT,
  query_text            TEXT,
  filters_used          JSONB,
  requested_for_time    TIME,
  requested_for_date    DATE,
  outcome               TEXT DEFAULT 'pending',
  -- 'visited'|'declined'|'saved'|'ignored'|'booked'|'pending'
  outcome_recorded_at   TIMESTAMP,
  tourist_feedback      TEXT,
  created_at            TIMESTAMP DEFAULT now()
);

-- Saved places / wishlist
CREATE TABLE IF NOT EXISTS tourist_saved_places (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id      UUID REFERENCES tourists(id) ON DELETE CASCADE,
  site_id         UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  saved_reason    TEXT,
  priority        TEXT DEFAULT 'want-to',
  -- 'must-do'|'want-to'|'maybe'
  planned_for_date DATE,
  planned_for_time TIME,
  notes           TEXT,
  visited         BOOL DEFAULT false,
  saved_at        TIMESTAMP DEFAULT now(),
  UNIQUE(tourist_id, site_id)
);

-- Agent search intent log
CREATE TABLE IF NOT EXISTS search_intents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id            UUID REFERENCES tourists(id) ON DELETE CASCADE,
  raw_query             TEXT,
  intent                TEXT,
  wants_happy_hour      BOOL,
  wants_live_music      BOOL,
  wants_gluten_free     BOOL,
  wants_vegan           BOOL,
  wants_outdoor         BOOL,
  wants_waterfront      BOOL,
  wants_pet_friendly    BOOL,
  wants_kid_friendly    BOOL,
  wants_open_now        BOOL,
  requested_time        TIME,
  requested_day         TEXT,
  resolved_day          TEXT,
  resolved_date         DATE,
  budget_level          TEXT,
  party_size            INT,
  cuisine_requested     TEXT,
  filters_extracted     JSONB,
  results_returned      INT,
  top_result_id         UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  tourist_chose         UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
  created_at            TIMESTAMP DEFAULT now()
);

-- ============================================================
-- SECTION 6 — FULL TRIP ITINERARY
-- ============================================================

CREATE TABLE IF NOT EXISTS trip_itineraries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id        UUID REFERENCES tourists(id) ON DELETE CASCADE,
  title             TEXT,
  total_days        INT,
  est_total_spend   DECIMAL(10,2),
  agent_notes       TEXT,
  created_at        TIMESTAMP DEFAULT now(),
  updated_at        TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS itinerary_days (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id    UUID REFERENCES trip_itineraries(id) ON DELETE CASCADE,
  tourist_id      UUID REFERENCES tourists(id) ON DELETE CASCADE,
  day_number      INT,
  date            DATE,
  theme           TEXT,
  weather_note    TEXT,
  est_spend       DECIMAL(8,2)
);

CREATE TABLE IF NOT EXISTS itinerary_stops (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id                UUID REFERENCES itinerary_days(id) ON DELETE CASCADE,
  tourist_id            UUID REFERENCES tourists(id) ON DELETE CASCADE,
  site_id               UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  stop_order            INT,
  stop_type             TEXT,
  -- 'breakfast'|'activity'|'lunch'|'beach'|'dinner'|'drinks'|'shopping'
  start_time            TIME,
  end_time              TIME,
  duration_minutes      INT,
  est_cost_per_person   DECIMAL(8,2),
  agent_note            TEXT,
  booking_required      BOOL DEFAULT false,
  booking_url           TEXT,
  booking_confirmed     BOOL DEFAULT false,
  confirmation_code     TEXT,
  status                TEXT DEFAULT 'planned',
  -- 'planned'|'confirmed'|'visited'|'skipped'|'replaced'
  replaced_with         UUID REFERENCES businesses(site_id) ON DELETE SET NULL
);

-- ============================================================
-- SECTION 7 — AGENT STATE (persistent memory per tourist)
-- ============================================================

CREATE TABLE IF NOT EXISTS tourist_agent_state (
  tourist_id            UUID PRIMARY KEY REFERENCES tourists(id) ON DELETE CASCADE,

  -- Running summary (AI rewrites this after each conversation)
  profile_summary       TEXT,

  -- Onboarding completion
  confirmed_dietary     BOOL DEFAULT false,
  confirmed_budget      BOOL DEFAULT false,
  confirmed_party       BOOL DEFAULT false,
  confirmed_interests   BOOL DEFAULT false,
  onboarding_complete   BOOL DEFAULT false,

  -- Live context
  last_topic            TEXT,
  last_businesses       UUID[],
  pending_question      TEXT,

  -- Trip progress
  days_in               INT DEFAULT 0,
  places_visited        INT DEFAULT 0,
  places_saved          INT DEFAULT 0,
  conversations_total   INT DEFAULT 0,
  last_conversation_at  TIMESTAMP,

  -- Proactive messaging
  send_morning_brief      BOOL DEFAULT false,
  send_evening_suggestions BOOL DEFAULT false,
  morning_brief_time      TIME DEFAULT '08:00',
  opted_out_proactive     BOOL DEFAULT false,

  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- SECTION 8 — COMPLETENESS VIEW
-- ============================================================

CREATE OR REPLACE VIEW business_completeness AS
SELECT
  b.name,
  b.type,
  b.subdomain,
  COALESCE(s.data_tier, 'stub')           AS data_tier,
  COALESCE(s.completeness_score, 0)       AS score,
  COALESCE(s.has_basic_info,   false)     AS basic_info,
  COALESCE(s.has_photos,       false)     AS photos,
  COALESCE(s.has_menu,         false)     AS menu,
  COALESCE(s.has_ai_script,    false)     AS ai_script,
  COALESCE(s.has_embeddings,   false)     AS embeddings,
  COALESCE(s.has_logistics,    false)     AS logistics,
  s.last_updated_at,
  s.notes
FROM businesses b
LEFT JOIN business_data_status s ON s.site_id = b.site_id
ORDER BY COALESCE(s.completeness_score, 0) DESC;

-- ============================================================
-- SECTION 9 — INDEXES FOR FAST SEARCH
-- ============================================================

CREATE INDEX IF NOT EXISTS bf_happy_hour_idx   ON business_filters(has_happy_hour);
CREATE INDEX IF NOT EXISTS bf_live_music_idx   ON business_filters(has_live_music);
CREATE INDEX IF NOT EXISTS bf_gluten_free_idx  ON business_filters(dietary_gluten_free);
CREATE INDEX IF NOT EXISTS bf_pet_friendly_idx ON business_filters(pet_friendly);
CREATE INDEX IF NOT EXISTS bf_kid_friendly_idx ON business_filters(kid_friendly);
CREATE INDEX IF NOT EXISTS bf_waterfront_idx   ON business_filters(waterfront);
CREATE INDEX IF NOT EXISTS bf_outdoor_idx      ON business_filters(outdoor_seating);
CREATE INDEX IF NOT EXISTS bf_open_time_idx    ON business_filters(open_time, close_time);

CREATE INDEX IF NOT EXISTS tv_tourist_idx      ON tourist_visits(tourist_id);
CREATE INDEX IF NOT EXISTS tv_site_idx         ON tourist_visits(site_id);
CREATE INDEX IF NOT EXISTS tsp_tourist_idx     ON tourist_saved_places(tourist_id);
CREATE INDEX IF NOT EXISTS si_tourist_idx      ON search_intents(tourist_id);
CREATE INDEX IF NOT EXISTS ar_tourist_idx      ON agent_recommendations(tourist_id);

-- ============================================================
-- DONE
-- ============================================================
-- Tables created:
-- ai_chunks, qa_pairs
-- business_details, business_logistics, business_atmosphere
-- menu_details, activity_details, accommodation_details
-- packages, room_types, photos, price_guide
-- hours_exceptions, ai_voice_scripts, business_data_status
-- business_filters
-- area_knowledge, neighborhoods, beaches
-- local_tips, hidden_gems, money_saving_tips
-- comparisons, transportation, emergency_info
-- grocery_and_supplies, seasonal_info, live_conditions
-- tourists, tourist_memory, tourist_visits
-- agent_recommendations, tourist_saved_places
-- search_intents, trip_itineraries, itinerary_days
-- itinerary_stops, tourist_agent_state
-- VIEW: business_completeness
-- ============================================================

-- ====== 04-ai-webhook.sql ======
-- ============================================================
-- CyberCheck Platform — AI Server Webhook
-- Part 4: Push public data changes to your AI server
-- Run this FOURTH in Supabase SQL Editor
-- ============================================================
--
-- HOW IT WORKS:
-- When any public-facing data changes (site content, fleet,
-- pricing, menu, services, FAQs, reviews, staff), this trigger
-- fires and sends a POST to your AI server with the changed data.
--
-- Your AI server receives the payload and updates its knowledge
-- base so the public-facing AI always has current info.
--
-- UPDATE the ai_server_url in platform_config when your
-- server is ready:
--   UPDATE platform_config SET value = 'https://your-real-server.com/api/webhook/data-change' WHERE key = 'ai_server_url';
--

-- Enable pg_net for outbound HTTP from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================
-- WEBHOOK FUNCTION
-- Fires on INSERT/UPDATE/DELETE of public data
-- POSTs to AI server with the changed record
-- ============================================
CREATE OR REPLACE FUNCTION notify_ai_server()
RETURNS trigger AS $$
DECLARE
    payload JSONB;
    webhook_url TEXT;
    site UUID;
    record_data JSONB;
BEGIN
    -- Get AI server URL from config
    SELECT value INTO webhook_url FROM platform_config WHERE key = 'ai_server_url';
    IF webhook_url IS NULL OR webhook_url = 'https://your-server.com/api/webhook/data-change' THEN
        -- No real URL configured yet, skip
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Determine site_id and record data
    IF TG_OP = 'DELETE' THEN
        site := OLD.site_id;
        record_data := row_to_json(OLD)::JSONB;
    ELSE
        site := NEW.site_id;
        record_data := row_to_json(NEW)::JSONB;
    END IF;

    -- Only push to AI for businesses listed on GCR
    -- Maggie's (not listed) stays private, Beachside (listed) goes to AI
    IF NOT EXISTS (SELECT 1 FROM businesses WHERE site_id = site AND gcr_listed = true) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Build payload
    payload := jsonb_build_object(
        'event', TG_OP,
        'table', TG_TABLE_NAME,
        'site_id', site,
        'record', record_data,
        'timestamp', NOW()
    );

    -- Send async HTTP POST (non-blocking)
    PERFORM net.http_post(
        url := webhook_url,
        body := payload::TEXT,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Webhook-Source', 'cybercheck-supabase'
        )
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- APPLY TRIGGERS TO PUBLIC-FACING TABLES
-- These are the tables the AI needs to know about.
-- When a business updates their info, the AI learns it.
-- ============================================

-- Site content (business info, hours, address, etc.)
CREATE TRIGGER trg_ai_site_content
    AFTER INSERT OR UPDATE OR DELETE ON site_content
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Fleet types (what they rent)
CREATE TRIGGER trg_ai_fleet_types
    AFTER INSERT OR UPDATE OR DELETE ON fleet_types
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Rental time slots
CREATE TRIGGER trg_ai_time_slots
    AFTER INSERT OR UPDATE OR DELETE ON rental_time_slots
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Rental pricing
CREATE TRIGGER trg_ai_pricing
    AFTER INSERT OR UPDATE OR DELETE ON rental_pricing
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Rental add-ons
CREATE TRIGGER trg_ai_addons
    AFTER INSERT OR UPDATE OR DELETE ON rental_addons
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Menu categories (Breakfast, Lunch, Dinner, etc.)
CREATE TRIGGER trg_ai_menu_categories
    AFTER INSERT OR UPDATE OR DELETE ON menu_categories
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Menu subcategories (Appetizers, Seafood, Burgers, etc.)
CREATE TRIGGER trg_ai_menu_subcategories
    AFTER INSERT OR UPDATE OR DELETE ON menu_subcategories
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Menu items (for restaurant/bakery businesses)
CREATE TRIGGER trg_ai_menu_items
    AFTER INSERT OR UPDATE OR DELETE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Services (for salon/charter/service businesses)
CREATE TRIGGER trg_ai_services
    AFTER INSERT OR UPDATE OR DELETE ON services
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Specials
CREATE TRIGGER trg_ai_specials
    AFTER INSERT OR UPDATE OR DELETE ON specials
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Events
CREATE TRIGGER trg_ai_events
    AFTER INSERT OR UPDATE OR DELETE ON events
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- FAQs
CREATE TRIGGER trg_ai_faqs
    AFTER INSERT OR UPDATE OR DELETE ON faqs
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Reviews (published only — but trigger fires on all, AI can filter)
CREATE TRIGGER trg_ai_reviews
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Staff (public team page)
CREATE TRIGGER trg_ai_staff
    AFTER INSERT OR UPDATE OR DELETE ON staff
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- Businesses (name, type, status changes)
CREATE TRIGGER trg_ai_businesses
    AFTER INSERT OR UPDATE OR DELETE ON businesses
    FOR EACH ROW EXECUTE FUNCTION notify_ai_server();

-- ====== 04-missing-tables.sql ======
-- ============================================
-- MISSING TABLES (run in Supabase SQL Editor)
-- These are queried by the backend but not
-- defined in the main schema files.
-- ============================================

-- platform_settings — stores platform-level config (API keys, feature flags)
-- Used by admin.js routes for saving/reading platform config
CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- site_data_store — full-blob CMS data store per business
-- Used by server.js GET/POST /api/site-data for page builder saves
CREATE TABLE IF NOT EXISTS site_data_store (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- booking_time column fix — bookings table stores times as text (e.g. "10:00 AM")
-- Run this if bookings are returning 500 errors
ALTER TABLE bookings ALTER COLUMN booking_time TYPE TEXT USING booking_time::TEXT;

-- ====== 06-analytics-seo-social.sql ======
-- ============================================
-- Analytics, SEO, and Social Media Tables
-- ============================================

-- Page Views & Traffic Tracking
CREATE TABLE IF NOT EXISTS page_views (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  device_type TEXT, -- 'mobile', 'desktop', 'tablet'
  browser TEXT,
  os TEXT,
  ip_address INET,
  country TEXT,
  city TEXT,
  region TEXT,
  session_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_page_views_site_id ON page_views(site_id);
CREATE INDEX idx_page_views_created_at ON page_views(created_at);
CREATE INDEX idx_page_views_session_id ON page_views(session_id);
CREATE INDEX idx_page_views_utm_source ON page_views(utm_source);

-- Conversion Tracking
CREATE TABLE IF NOT EXISTS conversions (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  conversion_type TEXT NOT NULL, -- 'booking', 'contact', 'signup', 'purchase', 'custom'
  conversion_value DECIMAL(10,2) DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  customer_id UUID,
  customer_email TEXT,
  customer_name TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,
  session_id TEXT,
  booking_id UUID,
  metadata JSONB, -- Additional conversion data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversions_site_id ON conversions(site_id);
CREATE INDEX idx_conversions_created_at ON conversions(created_at);
CREATE INDEX idx_conversions_type ON conversions(conversion_type);
CREATE INDEX idx_conversions_session_id ON conversions(session_id);

-- Traffic Sources Summary (aggregated daily)
CREATE TABLE IF NOT EXISTS traffic_sources (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source TEXT NOT NULL, -- 'google', 'facebook', 'direct', 'referral', etc.
  medium TEXT, -- 'organic', 'cpc', 'social', 'email', etc.
  campaign TEXT,
  visitors INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  avg_session_duration INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, date, source, medium, campaign)
);

CREATE INDEX idx_traffic_sources_site_date ON traffic_sources(site_id, date);

-- SEO Meta Tags (per page)
CREATE TABLE IF NOT EXISTS seo_meta_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  page_slug TEXT NOT NULL, -- '/', '/about', '/contact', etc.
  page_title TEXT,
  meta_description TEXT,
  meta_keywords TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  og_type TEXT DEFAULT 'website',
  twitter_card TEXT DEFAULT 'summary_large_image',
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image TEXT,
  canonical_url TEXT,
  robots TEXT DEFAULT 'index, follow',
  schema_json JSONB, -- Schema.org structured data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, page_slug)
);

CREATE INDEX idx_seo_meta_site_id ON seo_meta_tags(site_id);

-- Sitemap Configuration
CREATE TABLE IF NOT EXISTS sitemap_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE UNIQUE,
  auto_generate BOOLEAN DEFAULT true,
  include_pages BOOLEAN DEFAULT true,
  include_blog BOOLEAN DEFAULT false,
  custom_urls JSONB, -- Array of custom URLs to include
  excluded_urls JSONB, -- Array of URLs to exclude
  change_frequency TEXT DEFAULT 'weekly', -- 'always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'
  priority DECIMAL(2,1) DEFAULT 0.5,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social Media Accounts
CREATE TABLE IF NOT EXISTS social_media_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'facebook', 'instagram', 'twitter', 'tiktok', 'youtube'
  account_name TEXT,
  account_id TEXT,
  account_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  page_id TEXT, -- For Facebook pages
  page_access_token TEXT, -- For Facebook pages
  is_connected BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  metadata JSONB, -- Platform-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, platform)
);

CREATE INDEX idx_social_accounts_site_id ON social_media_accounts(site_id);

-- Social Media Posts
CREATE TABLE IF NOT EXISTS social_media_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  post_text TEXT NOT NULL,
  media_urls TEXT[], -- Array of image/video URLs
  platforms TEXT[] NOT NULL, -- ['facebook', 'instagram', 'twitter']
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  post_ids JSONB, -- Platform-specific post IDs after publishing
  error_message TEXT,
  engagement_stats JSONB, -- Likes, shares, comments per platform
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_social_posts_site_id ON social_media_posts(site_id);
CREATE INDEX idx_social_posts_status ON social_media_posts(status);
CREATE INDEX idx_social_posts_scheduled ON social_media_posts(scheduled_for);

-- Social Media Analytics (daily aggregates)
CREATE TABLE IF NOT EXISTS social_media_analytics (
  id BIGSERIAL PRIMARY KEY,
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  followers INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, platform, date)
);

CREATE INDEX idx_social_analytics_site_date ON social_media_analytics(site_id, date);

-- Attribution Tracking (how customers found you)
CREATE TABLE IF NOT EXISTS attribution_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID,
  referral_source TEXT, -- 'google', 'facebook', 'instagram', 'friend', 'repeat', 'other'
  referral_details TEXT, -- Additional details about referral
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  first_touch_source TEXT, -- First time they visited
  first_touch_date TIMESTAMPTZ,
  last_touch_source TEXT, -- Right before conversion
  last_touch_date TIMESTAMPTZ,
  total_sessions INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attribution_site_id ON attribution_data(site_id);
CREATE INDEX idx_attribution_booking_id ON attribution_data(booking_id);

-- SEO Keywords Tracking
CREATE TABLE IF NOT EXISTS seo_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  search_volume INTEGER DEFAULT 0,
  difficulty_score INTEGER, -- 1-100
  current_ranking INTEGER, -- Google position
  target_url TEXT,
  tracked_since TIMESTAMPTZ DEFAULT NOW(),
  last_checked_at TIMESTAMPTZ,
  ranking_history JSONB, -- Historical ranking data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, keyword)
);

CREATE INDEX idx_seo_keywords_site_id ON seo_keywords(site_id);

-- Robots.txt Configuration
CREATE TABLE IF NOT EXISTS robots_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID REFERENCES businesses(site_id) ON DELETE CASCADE UNIQUE,
  robots_txt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies

-- Page Views (business owners can only see their own)
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own site page_views"
  ON page_views FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Conversions
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own site conversions"
  ON conversions FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own site conversions"
  ON conversions FOR INSERT
  WITH CHECK (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Traffic Sources
ALTER TABLE traffic_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own traffic_sources"
  ON traffic_sources FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- SEO Meta Tags
ALTER TABLE seo_meta_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own site SEO"
  ON seo_meta_tags FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Sitemap Config
ALTER TABLE sitemap_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sitemap"
  ON sitemap_config FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Social Media Accounts
ALTER TABLE social_media_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own social accounts"
  ON social_media_accounts FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Social Media Posts
ALTER TABLE social_media_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own social posts"
  ON social_media_posts FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Social Media Analytics
ALTER TABLE social_media_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own social analytics"
  ON social_media_analytics FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Attribution Data
ALTER TABLE attribution_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attribution data"
  ON attribution_data FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- SEO Keywords
ALTER TABLE seo_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own SEO keywords"
  ON seo_keywords FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Robots Config
ALTER TABLE robots_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own robots.txt"
  ON robots_config FOR ALL
  USING (
    site_id IN (
      SELECT site_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Functions for Analytics Aggregation

-- Daily aggregation function for traffic sources
CREATE OR REPLACE FUNCTION aggregate_traffic_sources()
RETURNS void AS $$
BEGIN
  INSERT INTO traffic_sources (
    site_id, date, source, medium, campaign,
    visitors, sessions, pageviews, conversions, revenue
  )
  SELECT
    pv.site_id,
    DATE(pv.created_at) as date,
    COALESCE(pv.utm_source, 'direct') as source,
    COALESCE(pv.utm_medium, 'none') as medium,
    COALESCE(pv.utm_campaign, '') as campaign,
    COUNT(DISTINCT pv.ip_address) as visitors,
    COUNT(DISTINCT pv.session_id) as sessions,
    COUNT(*) as pageviews,
    0 as conversions,
    0 as revenue
  FROM page_views pv
  WHERE DATE(pv.created_at) = CURRENT_DATE - INTERVAL '1 day'
  GROUP BY pv.site_id, DATE(pv.created_at), source, medium, campaign
  ON CONFLICT (site_id, date, source, medium, campaign)
  DO UPDATE SET
    visitors = EXCLUDED.visitors,
    sessions = EXCLUDED.sessions,
    pageviews = EXCLUDED.pageviews,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversion counts in traffic_sources
CREATE OR REPLACE FUNCTION update_traffic_source_conversions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE traffic_sources SET
    conversions = conversions + 1,
    revenue = revenue + COALESCE(NEW.revenue, 0),
    updated_at = NOW()
  WHERE
    site_id = NEW.site_id
    AND date = DATE(NEW.created_at)
    AND source = COALESCE(NEW.utm_source, 'direct')
    AND medium = COALESCE(NEW.utm_medium, 'none')
    AND campaign = COALESCE(NEW.utm_campaign, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversion_traffic_source_update
  AFTER INSERT ON conversions
  FOR EACH ROW
  EXECUTE FUNCTION update_traffic_source_conversions();

-- Generate XML sitemap
CREATE OR REPLACE FUNCTION generate_sitemap(p_site_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_sitemap TEXT;
  v_base_url TEXT;
BEGIN
  -- Get base URL from businesses table
  SELECT COALESCE(domain, 'https://' || subdomain || '.cybercheck.com')
  INTO v_base_url
  FROM businesses
  WHERE site_id = p_site_id;

  -- Build XML sitemap
  v_sitemap := '<?xml version="1.0" encoding="UTF-8"?>' || CHR(10);
  v_sitemap := v_sitemap || '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' || CHR(10);

  -- Add pages from site_pages table
  SELECT v_sitemap || string_agg(
    '  <url>' || CHR(10) ||
    '    <loc>' || v_base_url || slug || '</loc>' || CHR(10) ||
    '    <lastmod>' || TO_CHAR(updated_at, 'YYYY-MM-DD') || '</lastmod>' || CHR(10) ||
    '    <changefreq>weekly</changefreq>' || CHR(10) ||
    '    <priority>0.8</priority>' || CHR(10) ||
    '  </url>' || CHR(10),
    ''
  )
  INTO v_sitemap
  FROM site_pages
  WHERE site_id = p_site_id AND published = true;

  v_sitemap := v_sitemap || '</urlset>';

  RETURN v_sitemap;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE page_views IS 'Tracks every page view with UTM parameters and device info';
COMMENT ON TABLE conversions IS 'Tracks conversion events (bookings, signups, purchases)';
COMMENT ON TABLE traffic_sources IS 'Daily aggregated traffic data by source/medium/campaign';
COMMENT ON TABLE seo_meta_tags IS 'SEO meta tags configuration per page';
COMMENT ON TABLE social_media_accounts IS 'Connected social media accounts with OAuth tokens';
COMMENT ON TABLE social_media_posts IS 'Scheduled and published social media posts';
COMMENT ON TABLE attribution_data IS 'Customer attribution tracking (how they found you)';

-- ====== 08-messages-inbox.sql ======
-- ============================================================
-- Messages / SMS Inbox
-- One number per business handles everything:
--   booking confirmations, loyalty, promos, two-way replies
-- ============================================================

-- ── messages — every SMS in/out per business ──────────────────
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,

    -- The conversation thread key = customer phone number
    customer_phone VARCHAR(20) NOT NULL,
    customer_name  VARCHAR(255),         -- looked up from customers table
    customer_id    UUID REFERENCES customers(id),

    -- Message content
    direction VARCHAR(10) NOT NULL,      -- 'inbound' (tourist→biz) | 'outbound' (biz→tourist)
    body      TEXT NOT NULL,
    media_url TEXT,                      -- MMS photo attachment

    -- Type tells us why this was sent
    -- booking_confirm | loyalty | promo | review_request | ai_reply | manual | inbound
    message_type VARCHAR(50) DEFAULT 'manual',

    -- Twilio tracking
    twilio_sid   VARCHAR(50),
    twilio_status VARCHAR(20),           -- queued | sent | delivered | failed | received

    -- Inbox state
    read BOOLEAN DEFAULT false,          -- has owner read this inbound message?

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_site     ON messages(site_id);
CREATE INDEX IF NOT EXISTS idx_messages_phone    ON messages(site_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_messages_unread   ON messages(site_id, read) WHERE direction = 'inbound';
CREATE INDEX IF NOT EXISTS idx_messages_created  ON messages(created_at DESC);

-- ── business_phones — the one number assigned to each business ─
-- (could also live in site_content but this is cleaner)
ALTER TABLE site_content
    ADD COLUMN IF NOT EXISTS twilio_number VARCHAR(20),   -- the business's Twilio number
    ADD COLUMN IF NOT EXISTS owner_phone   VARCHAR(20);   -- owner's personal cell for forwarding

-- ====== 09-review-questions.sql ======
-- ============================================================
-- Review Questions — per-business custom review questions
-- ============================================================

CREATE TABLE IF NOT EXISTS review_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,

    -- Question content
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL,  -- 'stars' | 'yesno' | 'text' | 'rating'

    -- Order & visibility
    display_order INT DEFAULT 0,
    enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_questions_site ON review_questions(site_id);
CREATE INDEX IF NOT EXISTS idx_review_questions_order ON review_questions(site_id, display_order);

-- ============================================================
-- Review Answers — customer responses to custom questions
-- ============================================================

CREATE TABLE IF NOT EXISTS review_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES review_questions(id) ON DELETE CASCADE,

    -- Answer (flexible — could be int for stars, text for text, 'yes'/'no' for yesno)
    answer TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_answers_review ON review_answers(review_id);
CREATE INDEX IF NOT EXISTS idx_review_answers_question ON review_answers(question_id);

-- ============================================================
-- Update reviews table to track more metadata
-- ============================================================

ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS review_token VARCHAR(100) UNIQUE,  -- one-time token for review link
    ADD COLUMN IF NOT EXISTS token_used BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS review_method VARCHAR(20) DEFAULT 'text',  -- 'text' | 'voice'
    ADD COLUMN IF NOT EXISTS original_voice_text TEXT,
    ADD COLUMN IF NOT EXISTS published_to_site BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS photo_added_to_gallery BOOLEAN DEFAULT false;

-- ============================================================
-- Insert default review questions for new businesses
-- ============================================================

-- NOTE: Trigger or application code should insert default questions when a business signs up
-- Default questions (can be customized per business):
-- 1. How was the boat condition? (stars)
-- 2. How was the check-in experience? (stars)
-- 3. Would you recommend us to a friend? (yesno)
-- 4. What could we improve? (text)
-- 5. How was the staff friendliness? (stars)

-- ====== 10-media-blocks.sql ======
-- ============================================================
-- Migration 10: media_library + availability_blocks tables
-- Run in Supabase SQL Editor
-- ============================================================

-- Media library (photos/videos per business)
CREATE TABLE IF NOT EXISTS media_library (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     TEXT NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    caption     TEXT,
    type        TEXT DEFAULT 'image', -- image | video
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_library_site ON media_library(site_id, sort_order);

-- RLS: business owner can manage their media
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_library_owner ON media_library
    USING (site_id IN (SELECT site_id FROM users WHERE id = auth.uid()));

-- Allow service role full access
CREATE POLICY media_library_service ON media_library
    USING (auth.role() = 'service_role');

-- ============================================================
-- Availability blocks (owner-blocked dates/times)
-- ============================================================
CREATE TABLE IF NOT EXISTS availability_blocks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     TEXT NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    block_date  DATE NOT NULL,
    start_time  TIME,            -- null = whole day
    end_time    TIME,
    fleet_type_id TEXT,          -- null = all fleet types
    reason      TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avail_blocks_site_date ON availability_blocks(site_id, block_date);

ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY avail_blocks_owner ON availability_blocks
    USING (site_id IN (SELECT site_id FROM users WHERE id = auth.uid()));
CREATE POLICY avail_blocks_service ON availability_blocks
    USING (auth.role() = 'service_role');

-- ============================================================
-- Tourist tables (for GCR SMS loyalty)
-- ============================================================
CREATE TABLE IF NOT EXISTS tourist_sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT,
    phone        TEXT,
    interests    TEXT[],
    visitor_type TEXT,
    checkin      DATE,
    checkout     DATE,
    session_id   UUID UNIQUE DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tourist_conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES tourist_sessions(session_id),
    role       TEXT NOT NULL, -- user | assistant
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tourist_conv_session ON tourist_conversations(session_id, created_at);

-- ====== 11-waitlist-locations.sql ======
-- ============================================================
-- Migration 11: waitlist + waitlist_settings + locations
-- Run in Supabase SQL Editor
-- ============================================================

-- Waitlist entries (customers waiting for an open slot)
CREATE TABLE IF NOT EXISTS waitlist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         TEXT NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    customer_name   TEXT NOT NULL,
    customer_email  TEXT,
    customer_phone  TEXT,
    preferred_date  DATE,
    preferred_slot  TEXT,           -- e.g. "Half Day AM", "All Day"
    fleet_type_id   UUID REFERENCES fleet_types(id),
    party_size      INTEGER DEFAULT 1,
    status          TEXT DEFAULT 'waiting', -- waiting | notified | booked | removed
    notified_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_site ON waitlist(site_id, status, created_at);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlist_owner ON waitlist
    USING (site_id IN (SELECT site_id FROM users WHERE id = auth.uid()));
CREATE POLICY waitlist_service ON waitlist
    USING (auth.role() = 'service_role');

-- Waitlist settings per business
CREATE TABLE IF NOT EXISTS waitlist_settings (
    site_id         TEXT PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    enabled         BOOLEAN DEFAULT true,
    max_size        INTEGER DEFAULT 20,
    auto_notify     BOOLEAN DEFAULT true,
    sms_message     TEXT DEFAULT 'Great news, {{customer_name}}! A spot just opened up for {{date}} ({{time_slot}}). Book now: {{booking_link}}',
    updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE waitlist_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlist_settings_owner ON waitlist_settings
    USING (site_id IN (SELECT site_id FROM users WHERE id = auth.uid()));
CREATE POLICY waitlist_settings_service ON waitlist_settings
    USING (auth.role() = 'service_role');

-- ============================================================
-- Locations (pickup/launch points per business)
-- ============================================================
CREATE TABLE IF NOT EXISTS locations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     TEXT NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    address     TEXT,
    city        TEXT,
    state       TEXT,
    zip         TEXT,
    lat         DECIMAL(10,7),
    lng         DECIMAL(10,7),
    phone       TEXT,
    notes       TEXT,
    is_primary  BOOLEAN DEFAULT false,
    active      BOOLEAN DEFAULT true,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_site ON locations(site_id, sort_order);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY locations_owner ON locations
    USING (site_id IN (SELECT site_id FROM users WHERE id = auth.uid()));
CREATE POLICY locations_service ON locations
    USING (auth.role() = 'service_role');

-- ====== 12-gcr-business-fields.sql ======
-- ============================================================
-- Migration 12: Add GCR display fields to businesses table
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS emoji          VARCHAR(10)  DEFAULT '🏪',
  ADD COLUMN IF NOT EXISTS tagline        TEXT,
  ADD COLUMN IF NOT EXISTS featured       BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags           TEXT[]       DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS price_range    VARCHAR(5),     -- $, $$, $$$, $$$$
  ADD COLUMN IF NOT EXISTS rating         DECIMAL(3,1),
  ADD COLUMN IF NOT EXISTS review_count   INTEGER      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS happy_hour     TEXT,           -- e.g. "Daily 3–5pm"
  ADD COLUMN IF NOT EXISTS kids_friendly  BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS pet_friendly   BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_music     BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS outdoor        BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS reservations   BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS alcohol        BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_required BOOLEAN    DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery       BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS takeout        BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order     INTEGER      DEFAULT 0;

-- Index for GCR queries
CREATE INDEX IF NOT EXISTS idx_businesses_gcr ON businesses(gcr_listed, featured, type);
CREATE INDEX IF NOT EXISTS idx_businesses_featured ON businesses(featured) WHERE featured = true;

-- ====== 13-website-content-columns.sql ======
-- Add missing content columns to site_content table
-- These are website sections editable from the dashboard

ALTER TABLE site_content
  ADD COLUMN IF NOT EXISTS whats_included JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS footer JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS links_page JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS locations JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS group_rate JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS docks JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS hero_cta_text VARCHAR(100) DEFAULT 'Book Now',
  ADD COLUMN IF NOT EXISTS hero_cta_url TEXT DEFAULT '#rentals';

-- Seed Circle Boats data (site_id = 22222222-2222-2222-2222-222222222222)
UPDATE site_content SET
  whats_included = '["Life Jacket","Safety Briefing","Full Battery Charge","5-Speed Motor","Paddle","Whistle","Cup Holders"]'::jsonb,
  steps = '[{"step":1,"title":"Book Online","description":"Choose your boat, pick your date, and reserve in seconds.","image":""},{"step":2,"title":"Show Up","description":"Head to our Orange Beach location on Canal Road.","image":""},{"step":3,"title":"Quick Briefing","description":"5-minute safety walkthrough. No license needed.","image":""},{"step":4,"title":"Hit the Water","description":"Cruise at your own pace and make memories.","image":""}]'::jsonb,
  features = '[{"icon":"⚡","title":"Electric & Eco-Friendly","description":"35lb thrust electric motors. Zero emissions, zero noise pollution.","image":""},{"icon":"💪","title":"Stable & Safe","description":"Low center of gravity, incredibly stable. Life jackets included.","image":""},{"icon":"🛶","title":"Portable","description":"Inflatable design. We can bring boats to your event or private dock.","image":""},{"icon":"🏋","title":"No License Needed","description":"Anyone can drive. No boating license required. We teach you in 5 min.","image":""},{"icon":"🌊","title":"Gulf Coast Views","description":"Explore Orange Beach coastline and intercoastal waterways.","image":""},{"icon":"🎉","title":"Perfect for Events","description":"Birthdays, date nights, bachelor parties, team outings.","image":""}]'::jsonb,
  footer = '{"businessName":"Beachside Circle Boats","tagline":"Beachside Circle Boat Rentals and Sales LLC. Eco-friendly circle boat rentals in Orange Beach, Alabama.","links":[{"label":"Rentals & Pricing","href":"#rentals"},{"label":"How It Works","href":"#how"},{"label":"About","href":"#about"},{"label":"Gallery","href":"#gallery"}],"services":["Single Seater Rental","Double Seater Rental","Docks","Add-ons"]}'::jsonb,
  links_page = '{"links":[{"id":"booking","enabled":true,"icon":"📅","label":"Book Now","sub":"Check availability & reserve"},{"id":"fleet","enabled":true,"icon":"🚤","label":"Rental Packages & Pricing","sub":"Single, Double & Dock Add-ons"},{"id":"gallery","enabled":true,"icon":"📸","label":"View Photos","sub":"Our boats on the water"},{"id":"reviews","enabled":true,"icon":"⭐","label":"Customer Reviews","sub":"See what customers say"},{"id":"about","enabled":true,"icon":"ℹ️","label":"About Us","sub":"Our story & what we offer"},{"id":"website","enabled":true,"icon":"🌐","label":"Visit Full Website","sub":"beachsidecircleboats.com","url":"index.html"}]}'::jsonb,
  locations = '[{"id":"loc1","name":"Main Launch — Canal Road","address":"25856 Canal Road, Unit A, Orange Beach, AL 36561","description":"Our main launch site. Easy parking, quick access to the intercoastal waterway.","mapUrl":"https://maps.google.com/?q=25856+Canal+Road+Orange+Beach+AL+36561"}]'::jsonb,
  group_rate = '{"title":"Group Rates Available","description":"Rent 5 or more single seaters and save. No group rate on doubles. Call to book.","price":200,"priceLabel":"each / All Day","ctaText":"Call to Book","ctaUrl":"tel:6013251205"}'::jsonb,
  docks = '[{"name":"Mini Dock","badge":"Most Popular","size":"8'\''4\" x 44\"","capacity":"100 lb","description":"The full-size floating platform. Tow it behind your GoBoat for extra room to sunbathe, do yoga, spread out a picnic, or store all your beach gear.","image":"images/goboat/mini-dock-tow.jpg","halfDay":25,"allDay":50,"features":["Large flat platform for lounging & sunbathing","Holds coolers, chairs, bags & umbrellas","EVA foam non-slip surface","Quick-connect tow rope included"]},{"name":"X Dock","badge":null,"size":"5'\'' x 5'\''","capacity":"75 lb","description":"The compact square dock built for utility. Designed to hold a full-size cooler (up to 58 quarts), tackle boxes, or a portable grill.","image":"","halfDay":25,"allDay":50,"features":["Holds a 58-qt cooler with room to spare","Square shape — stable & stackable","Raised edge rails prevent items from sliding","Lightweight & easy to tow"]},{"name":"Doggie Dock","badge":"Pet Friendly","size":"5'\''4\" x 43\"","capacity":"85 lb","description":"Built for your four-legged crew. Features a weighted mesh ramp so dogs can climb in and out of the water on their own.","image":"","halfDay":25,"allDay":50,"features":["Weighted mesh entry/exit ramp for dogs","Non-slip grip surface for wet paws","Stable — won'\''t flip when dogs jump on/off","Pairs great with our Pup Pack add-on"]}]'::jsonb,
  hero_cta_text = 'Book Now',
  hero_cta_url = '#rentals'
WHERE site_id = '22222222-2222-2222-2222-222222222222';
