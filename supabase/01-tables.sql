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
CREATE TABLE businesses (
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
CREATE TABLE users (
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
CREATE TABLE site_content (
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
CREATE TABLE site_pages (
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
CREATE TABLE apps (
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
CREATE TABLE site_apps (
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
CREATE TABLE connections (
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
CREATE TABLE customers (
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
CREATE TABLE menu_categories (
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
CREATE TABLE menu_subcategories (
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
CREATE TABLE menu_items (
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
CREATE TABLE specials (
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
CREATE TABLE events (
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
CREATE TABLE services (
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
CREATE TABLE availability (
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
CREATE TABLE fleet_types (
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
CREATE TABLE fleet_items (
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
CREATE TABLE rental_time_slots (
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
CREATE TABLE rental_pricing (
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
CREATE TABLE rental_group_rates (
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
CREATE TABLE rental_addons (
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
CREATE TABLE bookings (
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
CREATE TABLE orders (
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
CREATE TABLE waivers (
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
CREATE TABLE reviews (
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
CREATE TABLE staff (
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
CREATE TABLE media (
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
CREATE TABLE sms_log (
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
CREATE TABLE faqs (
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
CREATE TABLE coupons (
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
CREATE TABLE notifications (
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
CREATE TABLE activity_log (
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
CREATE TABLE audit_log (
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
CREATE TABLE templates (
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
CREATE TABLE support_tickets (
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
CREATE TABLE platform_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 35. CUSTOM DOMAINS (DNS management per business)
-- ============================================
CREATE TABLE domains (
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
