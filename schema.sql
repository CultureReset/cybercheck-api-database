-- CyberCheck Platform Schema
-- Multi-tenant: everything keyed by site_id
-- Run this in Supabase SQL editor

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER DATABASE postgres SET "app.jwt_claim_site_id" = '';

-- ============================================
-- CORE TABLES
-- ============================================

-- Businesses (one row per customer site)
CREATE TABLE businesses (
    site_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE,
    subdomain VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- restaurant, bakery, salon, charter, rental, retail, service
    logo_url TEXT,
    cover_url TEXT,
    plan VARCHAR(20) DEFAULT 'free', -- free, starter, pro, enterprise
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, setup
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (business owners who log in)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE, -- links to Supabase auth.users
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'owner', -- owner, staff, admin (admin = platform super-admin)
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SITE CONTENT (what the website displays)
-- ============================================

CREATE TABLE site_content (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    hero_text TEXT,
    hero_subtext TEXT,
    hero_video_url TEXT,
    about_text TEXT,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(10),
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    hours JSONB DEFAULT '{}',
    gallery JSONB DEFAULT '[]', -- [{url, caption}]
    social_links JSONB DEFAULT '{}', -- {facebook, instagram, tiktok, twitter}
    logo_url TEXT,
    cover_url TEXT,
    theme_color VARCHAR(7) DEFAULT '#00ada8',
    theme_font VARCHAR(50) DEFAULT 'Inter',
    custom_css TEXT,
    seo_title VARCHAR(255),
    seo_description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated website pages
CREATE TABLE site_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    html_content TEXT,
    page_type VARCHAR(50), -- generated, ai_generated, cloned, custom
    visible BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, slug)
);

-- ============================================
-- APPS (pluggable tools attached per business)
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

CREATE TABLE site_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    app_id VARCHAR(50) NOT NULL REFERENCES apps(app_id),
    config JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT true,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, app_id)
);

-- ============================================
-- OAUTH CONNECTIONS
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

-- ============================================
-- CUSTOMERS (basic CRM)
-- ============================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    notes TEXT,
    total_orders INT DEFAULT 0,
    total_bookings INT DEFAULT 0,
    total_spent DECIMAL(10,2) DEFAULT 0,
    last_visit TIMESTAMPTZ,
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MENU / PRODUCTS (restaurant, bakery, retail)
-- ============================================

CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    image_url TEXT,
    tags JSONB DEFAULT '[]',
    allergens JSONB DEFAULT '[]',
    ingredients TEXT,
    available BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE specials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50),
    days JSONB DEFAULT '[]',
    start_time TIME,
    end_time TIME,
    discount_text VARCHAR(255),
    items JSONB DEFAULT '[]',
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- ============================================
-- SERVICES / BOOKING (charter, salon, service)
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

-- ============================================
-- RENTAL-SPECIFIC TABLES
-- ============================================

-- Fleet types (Single Seater, Double Seater, etc.)
CREATE TABLE fleet_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    specs JSONB DEFAULT '{}', -- {weight, max_weight, diameter, motor, speed}
    image_url TEXT,
    sort_order INT DEFAULT 0,
    available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual fleet items (physical inventory)
CREATE TABLE fleet_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID NOT NULL REFERENCES fleet_types(id) ON DELETE CASCADE,
    unit_name VARCHAR(100), -- 'Single #1', 'Single #2', 'Double #1'
    serial_number VARCHAR(100),
    condition VARCHAR(20) DEFAULT 'good', -- good, fair, maintenance, retired
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rental time slots (Half Day AM, Half Day PM, All Day, etc.)
CREATE TABLE rental_time_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'Half Day AM', 'Half Day PM', 'All Day'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    sort_order INT DEFAULT 0,
    active BOOLEAN DEFAULT true
);

-- Rental pricing (fleet_type + time_slot = price)
CREATE TABLE rental_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID NOT NULL REFERENCES fleet_types(id) ON DELETE CASCADE,
    time_slot_id UUID NOT NULL REFERENCES rental_time_slots(id) ON DELETE CASCADE,
    price DECIMAL(10,2) NOT NULL,
    UNIQUE(site_id, fleet_type_id, time_slot_id)
);

-- Group rate rules
CREATE TABLE rental_group_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    fleet_type_id UUID NOT NULL REFERENCES fleet_types(id) ON DELETE CASCADE,
    time_slot_id UUID REFERENCES rental_time_slots(id) ON DELETE CASCADE, -- NULL = applies to all slots
    min_qty INT NOT NULL, -- minimum quantity to trigger group rate
    price_per_unit DECIMAL(10,2) NOT NULL,
    active BOOLEAN DEFAULT true
);

-- Add-ons (docks, coolers, speakers, etc.)
CREATE TABLE rental_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50), -- 'dock', 'food', 'gear', 'safety'
    icon VARCHAR(10),
    image_url TEXT,
    per_unit VARCHAR(50) DEFAULT 'per rental', -- 'per rental', 'per person', 'per day'
    available BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BOOKINGS (universal - works for all types)
-- ============================================

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),

    -- What was booked
    service_id UUID REFERENCES services(id),         -- for service businesses
    fleet_type_id UUID REFERENCES fleet_types(id),   -- for rental businesses
    time_slot_id UUID REFERENCES rental_time_slots(id), -- for rental businesses

    -- When
    booking_date DATE NOT NULL,
    booking_time TIME,
    end_time TIME,
    duration_minutes INT,

    -- Details
    qty INT DEFAULT 1,
    party_size INT DEFAULT 1,
    addons JSONB DEFAULT '[]', -- [{addon_id, name, price, qty}]

    -- Money
    subtotal DECIMAL(10,2),
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2),
    deposit DECIMAL(10,2) DEFAULT 0,
    payment_id VARCHAR(255),
    payment_provider VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- unpaid, deposit_paid, paid, refunded

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, checked_in, completed, cancelled, no_show
    notes TEXT,
    waiver_signed BOOLEAN DEFAULT false,

    -- Customer info (denormalized for quick access)
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_email VARCHAR(255),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDERS (restaurant, bakery, retail)
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

-- ============================================
-- WAIVERS
-- ============================================

CREATE TABLE waivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    signature_data TEXT, -- base64 signature image
    waiver_text TEXT,
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(45)
);

-- ============================================
-- STAFF
-- ============================================

CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    role VARCHAR(50), -- manager, attendant, guide, cashier
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEDIA LIBRARY
-- ============================================

CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    filename VARCHAR(255),
    file_type VARCHAR(50), -- image, video, document
    file_size INT,
    alt_text VARCHAR(255),
    folder VARCHAR(100) DEFAULT 'general',
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SMS / NOTIFICATIONS
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

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_users_site ON users(site_id);
CREATE INDEX idx_users_auth ON users(auth_id);
CREATE INDEX idx_site_content_site ON site_content(site_id);
CREATE INDEX idx_site_pages_site ON site_pages(site_id);
CREATE INDEX idx_site_apps_site ON site_apps(site_id);
CREATE INDEX idx_connections_site ON connections(site_id);
CREATE INDEX idx_connections_provider ON connections(site_id, provider);
CREATE INDEX idx_menu_items_site ON menu_items(site_id);
CREATE INDEX idx_menu_items_category ON menu_items(site_id, category);
CREATE INDEX idx_services_site ON services(site_id);
CREATE INDEX idx_fleet_types_site ON fleet_types(site_id);
CREATE INDEX idx_fleet_items_site ON fleet_items(site_id);
CREATE INDEX idx_fleet_items_type ON fleet_items(fleet_type_id);
CREATE INDEX idx_rental_pricing_site ON rental_pricing(site_id);
CREATE INDEX idx_rental_addons_site ON rental_addons(site_id);
CREATE INDEX idx_rental_time_slots_site ON rental_time_slots(site_id);
CREATE INDEX idx_bookings_site ON bookings(site_id);
CREATE INDEX idx_bookings_date ON bookings(site_id, booking_date);
CREATE INDEX idx_bookings_status ON bookings(site_id, status);
CREATE INDEX idx_orders_site ON orders(site_id);
CREATE INDEX idx_orders_status ON orders(site_id, status);
CREATE INDEX idx_customers_site ON customers(site_id);
CREATE INDEX idx_customers_email ON customers(site_id, email);
CREATE INDEX idx_waivers_site ON waivers(site_id);
CREATE INDEX idx_waivers_booking ON waivers(booking_id);
CREATE INDEX idx_staff_site ON staff(site_id);
CREATE INDEX idx_media_site ON media(site_id);
CREATE INDEX idx_sms_log_site ON sms_log(site_id);
CREATE INDEX idx_businesses_domain ON businesses(domain);
CREATE INDEX idx_businesses_subdomain ON businesses(subdomain);
CREATE INDEX idx_specials_site ON specials(site_id);
CREATE INDEX idx_events_site ON events(site_id);
CREATE INDEX idx_availability_site ON availability(site_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE specials ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_group_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's site_id from JWT
CREATE OR REPLACE FUNCTION auth.site_id() RETURNS UUID AS $$
  SELECT (auth.jwt()->>'site_id')::UUID;
$$ LANGUAGE SQL STABLE;

-- Owner policies: owners see only their business data
-- Pattern: SELECT/INSERT/UPDATE/DELETE where site_id = auth.site_id()

CREATE POLICY "owners_select" ON users FOR SELECT USING (site_id = auth.site_id());
CREATE POLICY "owners_select" ON site_content FOR SELECT USING (site_id = auth.site_id());
CREATE POLICY "owners_update" ON site_content FOR UPDATE USING (site_id = auth.site_id());
CREATE POLICY "owners_select" ON site_pages FOR SELECT USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON site_pages FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_select" ON site_apps FOR SELECT USING (site_id = auth.site_id());
CREATE POLICY "owners_select" ON connections FOR SELECT USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON connections FOR ALL USING (site_id = auth.site_id());

CREATE POLICY "owners_all" ON customers FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON menu_items FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON specials FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON events FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON services FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON availability FOR ALL USING (site_id = auth.site_id());

CREATE POLICY "owners_all" ON fleet_types FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON fleet_items FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON rental_time_slots FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON rental_pricing FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON rental_group_rates FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON rental_addons FOR ALL USING (site_id = auth.site_id());

CREATE POLICY "owners_all" ON bookings FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON orders FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON waivers FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON staff FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON media FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "owners_all" ON sms_log FOR ALL USING (site_id = auth.site_id());

-- Public read policies: customer-facing website reads (no auth needed)
-- These use the anon key and filter by subdomain/domain lookup
CREATE POLICY "public_read" ON site_content FOR SELECT USING (true);
CREATE POLICY "public_read" ON site_pages FOR SELECT USING (visible = true);
CREATE POLICY "public_read" ON fleet_types FOR SELECT USING (available = true);
CREATE POLICY "public_read" ON rental_time_slots FOR SELECT USING (active = true);
CREATE POLICY "public_read" ON rental_pricing FOR SELECT USING (true);
CREATE POLICY "public_read" ON rental_group_rates FOR SELECT USING (active = true);
CREATE POLICY "public_read" ON rental_addons FOR SELECT USING (available = true);
CREATE POLICY "public_read" ON menu_items FOR SELECT USING (available = true);
CREATE POLICY "public_read" ON services FOR SELECT USING (available = true);
CREATE POLICY "public_read" ON availability FOR SELECT USING (true);
CREATE POLICY "public_read" ON specials FOR SELECT USING (active = true);
CREATE POLICY "public_read" ON events FOR SELECT USING (active = true);

-- Public insert: customers can create bookings/orders
CREATE POLICY "public_insert" ON bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "public_insert" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "public_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "public_insert" ON waivers FOR INSERT WITH CHECK (true);

-- ============================================
-- SEED DATA: Default apps
-- ============================================

INSERT INTO apps (app_id, name, description, category, business_types, monthly_price, icon) VALUES
('restaurant-menu', 'Restaurant Menu', 'Full menu with categories, specials, allergens', 'menu', '["restaurant"]', 0, '🍽️'),
('bakery-menu', 'Bakery Menu', 'Bakery items with custom orders, pickup dates', 'menu', '["bakery"]', 0, '🧁'),
('retail-products', 'Product Catalog', 'Products with variants, inventory, images', 'menu', '["retail"]', 0, '🛍️'),
('charter-booking', 'Charter Booking', 'Trip packages, capacity, gear add-ons', 'booking', '["charter"]', 19.99, '🎣'),
('salon-booking', 'Salon Booking', 'Stylist selection, service types, time slots', 'booking', '["salon"]', 19.99, '💇'),
('rental-booking', 'Rental Booking', 'Fleet management, time slots, add-ons, group rates', 'booking', '["rental"]', 19.99, '🚤'),
('service-booking', 'Service Booking', 'Appointments, service types, staff assignment', 'booking', '["service"]', 19.99, '📅'),
('restaurant-ordering', 'Online Ordering', 'Cart, checkout, pickup times', 'ordering', '["restaurant", "bakery"]', 29.99, '🛒'),
('basic-crm', 'Customer Manager', 'Customer list, history, notes', 'crm', '["restaurant","bakery","salon","charter","rental","retail","service"]', 14.99, '👥'),
('sms-notifications', 'SMS Notifications', 'Automated SMS for bookings and orders', 'marketing', '["restaurant","bakery","salon","charter","rental","retail","service"]', 0.10, '💬'),
('review-requests', 'Review Requests', 'Automatic review requests after service', 'marketing', '["restaurant","bakery","salon","charter","rental","retail","service"]', 9.99, '⭐'),
('social-feed', 'Social Feed', 'Display social media feeds on website', 'marketing', '["restaurant","bakery","salon","charter","rental","retail","service"]', 9.99, '📱'),
('analytics', 'Analytics Dashboard', 'Revenue, bookings, customer insights', 'analytics', '["restaurant","bakery","salon","charter","rental","retail","service"]', 19.99, '📊'),
('loyalty', 'Loyalty Rewards', 'Points, punch cards, rewards program', 'marketing', '["restaurant","bakery","salon","charter","rental","retail","service"]', 14.99, '🎁'),
('qr-menu', 'QR Menu Pro', 'QR code menu for dine-in customers', 'menu', '["restaurant","bakery"]', 9.99, '📲'),
('social-manager', 'Social Media Manager', 'Post scheduling, cross-platform publishing', 'marketing', '["restaurant","bakery","salon","charter","rental","retail","service"]', 24.99, '📣');

-- ============================================
-- SEED DATA: Beachside Circle Boats
-- ============================================

INSERT INTO businesses (site_id, domain, subdomain, name, type, plan, status) VALUES
('22222222-2222-2222-2222-222222222222', NULL, 'beachside-circle-boats', 'Beachside Circle Boats', 'rental', 'pro', 'active');

INSERT INTO users (site_id, email, name, role) VALUES
('22222222-2222-2222-2222-222222222222', 'beachsideboats@myyahoo.com', 'Beachside Owner', 'owner');

INSERT INTO site_content (
    site_id, hero_text, hero_subtext, hero_video_url,
    about_text, contact_phone, contact_email,
    address, city, state, zip,
    hours, gallery, social_links, theme_color, seo_title, seo_description
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'The Easiest Way to Get on the Water',
    'Rent a portable, eco-friendly circle boat. No license needed, no experience required. Just show up and cruise.',
    'https://www.youtube.com/embed/CI4qVeBE36Q',
    'Beachside Circle Boats offers eco-friendly, portable circle boat rentals in Orange Beach, Alabama. Powered by electric motors with zero emissions.',
    '(601) 325-1205',
    'beachsideboats@myyahoo.com',
    '25856 Canal Road, Unit A',
    'Orange Beach',
    'AL',
    '36561',
    '{"monday":{"open":"08:00","close":"18:00"},"tuesday":{"open":"08:00","close":"18:00"},"wednesday":{"open":"08:00","close":"18:00"},"thursday":{"open":"08:00","close":"18:00"},"friday":{"open":"08:00","close":"18:00"},"saturday":{"open":"08:00","close":"18:00"},"sunday":{"open":"09:00","close":"17:00"}}',
    '[{"url":"images/goboat/goboat-hero.jpg","caption":"GoBoat on the water"},{"url":"images/goboat/goboat-bumpers.jpg","caption":"Double Seater"},{"url":"images/goboat/goboat-onwater1.jpg","caption":"Cruising"},{"url":"images/goboat/goboat-beach.jpg","caption":"Beach setup"},{"url":"images/goboat/goboat-woody.jpg","caption":"Woody edition"},{"url":"images/goboat/goboat-fishing.jpg","caption":"Fishing"},{"url":"images/goboat/goboat-motor.jpg","caption":"Electric motor"},{"url":"images/goboat/mini-dock-tow.jpg","caption":"Mini Dock"}]',
    '{"facebook":"#","instagram":"#","tiktok":"#"}',
    '#00ada8',
    'Beachside Circle Boats — Orange Beach, AL | Rentals',
    'Portable inflatable circle boat rentals in Orange Beach, Alabama. Eco-friendly electric boats for singles and doubles.'
);

-- Attach apps
INSERT INTO site_apps (site_id, app_id) VALUES
('22222222-2222-2222-2222-222222222222', 'rental-booking'),
('22222222-2222-2222-2222-222222222222', 'basic-crm'),
('22222222-2222-2222-2222-222222222222', 'sms-notifications'),
('22222222-2222-2222-2222-222222222222', 'analytics');

-- Fleet types
INSERT INTO fleet_types (id, site_id, name, description, specs, image_url, sort_order) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
 'Single Seater',
 'Solo cruiser. 57 lbs, portable, 35lb electric motor. Fits one adult up to 300 lbs.',
 '{"weight":"57 lbs","max_weight":"300 lbs","diameter":"70 inches","motor":"35lb thrust 5-speed electric","speed":"up to 5 mph"}',
 'images/goboat/goboat-beach.jpg', 1),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222',
 'Double Seater',
 'Bring a friend. 65 lbs, extra-wide seats, enhanced stability. Fits two adults up to 450 lbs combined.',
 '{"weight":"65 lbs","max_weight":"450 lbs","dimensions":"89 x 70 inches","motor":"35lb thrust 5-speed electric","speed":"up to 5 mph"}',
 'images/goboat/goboat-bumpers.jpg', 2);

-- Fleet inventory (example units)
INSERT INTO fleet_items (site_id, fleet_type_id, unit_name, condition) VALUES
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Single #1', 'good'),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Single #2', 'good'),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Single #3', 'good'),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Single #4', 'good'),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Single #5', 'good'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Double #1', 'good'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Double #2', 'good'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Double #3', 'good');

-- Time slots
INSERT INTO rental_time_slots (id, site_id, name, start_time, end_time, sort_order) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccc01', '22222222-2222-2222-2222-222222222222', 'Half Day AM', '09:00', '13:00', 1),
('cccccccc-cccc-cccc-cccc-cccccccccc02', '22222222-2222-2222-2222-222222222222', 'Half Day PM', '14:00', '18:00', 2),
('cccccccc-cccc-cccc-cccc-cccccccccc03', '22222222-2222-2222-2222-222222222222', 'All Day', '09:00', '18:00', 3);

-- Pricing (fleet_type x time_slot)
INSERT INTO rental_pricing (site_id, fleet_type_id, time_slot_id, price) VALUES
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 150.00),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc02', 150.00),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc03', 225.00),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccc01', 200.00),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccc02', 200.00),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccc03', 275.00);

-- Group rate: 5+ singles all day = $200 each
INSERT INTO rental_group_rates (site_id, fleet_type_id, time_slot_id, min_qty, price_per_unit) VALUES
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc03', 5, 200.00);

-- Add-ons
INSERT INTO rental_addons (site_id, name, description, price, category, icon, per_unit, sort_order) VALUES
('22222222-2222-2222-2222-222222222222', 'Mini Dock', '8''4" x 44" platform for gear, yoga, sunbathing', 50.00, 'dock', '🛟', 'per day', 1),
('22222222-2222-2222-2222-222222222222', 'X Dock', '5'' x 5'' floating dock, holds a 58-qt cooler', 50.00, 'dock', '🛟', 'per day', 2),
('22222222-2222-2222-2222-222222222222', 'Doggie Dock', '5''4" x 43" with weighted mesh ramp for pets', 50.00, 'dock', '🐕', 'per day', 3),
('22222222-2222-2222-2222-222222222222', 'Cooler Pack', 'Loaded cooler with ice, water, and your choice of drinks', 35.00, 'food', '🍺', 'per cooler', 4),
('22222222-2222-2222-2222-222222222222', 'Drink & Ice', 'Water, Gatorade, sodas, juice. Bag of ice included.', 15.00, 'food', '🧊', '6 drinks + ice', 5),
('22222222-2222-2222-2222-222222222222', 'Snack Pack', 'Chips, trail mix, granola bars, fruit snacks', 20.00, 'food', '🍟', 'per pack', 6),
('22222222-2222-2222-2222-222222222222', 'Pup Pack', 'Dog treats, water bowl, and a doggie life vest', 15.00, 'food', '🐶', 'per pup', 7),
('22222222-2222-2222-2222-222222222222', 'Bluetooth Speaker', 'Waterproof JBL speaker to set the vibe', 15.00, 'gear', '🎵', 'per trip', 8),
('22222222-2222-2222-2222-222222222222', 'GoPro Rental', 'GoPro Hero with waterproof mount', 30.00, 'gear', '📷', 'per trip', 9),
('22222222-2222-2222-2222-222222222222', 'Fishing Gear', 'Rod, reel, tackle, and bait. Everything included.', 25.00, 'gear', '🎣', 'per person', 10),
('22222222-2222-2222-2222-222222222222', 'Sun & Safety Kit', 'Reef-safe sunscreen, hat, dry bag, first aid kit', 10.00, 'safety', '☀️', 'per kit', 11);

-- Demo customers
INSERT INTO customers (site_id, name, phone, email, total_bookings, total_spent) VALUES
('22222222-2222-2222-2222-222222222222', 'Sarah Johnson', '(251) 555-0101', 'sarah@example.com', 3, 525.00),
('22222222-2222-2222-2222-222222222222', 'Mike Davis', '(251) 555-0102', 'mike@example.com', 1, 275.00),
('22222222-2222-2222-2222-222222222222', 'Emily Carter', '(251) 555-0103', 'emily@example.com', 5, 1100.00),
('22222222-2222-2222-2222-222222222222', 'James Wilson', '(251) 555-0104', 'james@example.com', 2, 400.00);

-- Demo bookings
INSERT INTO bookings (site_id, fleet_type_id, time_slot_id, booking_date, qty, addons, subtotal, total, status, payment_status, customer_name, customer_phone, customer_email) VALUES
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc03', CURRENT_DATE + 1, 2, '[{"name":"Cooler Pack","price":35},{"name":"Bluetooth Speaker","price":15}]', 500.00, 500.00, 'confirmed', 'paid', 'Sarah Johnson', '(251) 555-0101', 'sarah@example.com'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccc01', CURRENT_DATE + 2, 1, '[]', 200.00, 200.00, 'pending', 'unpaid', 'Mike Davis', '(251) 555-0102', 'mike@example.com'),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc01', CURRENT_DATE + 3, 5, '[{"name":"Mini Dock","price":50}]', 1050.00, 1050.00, 'confirmed', 'deposit_paid', 'Emily Carter', '(251) 555-0103', 'emily@example.com');

-- Staff
INSERT INTO staff (site_id, name, phone, role) VALUES
('22222222-2222-2222-2222-222222222222', 'Beach Attendant 1', '(251) 555-0201', 'attendant'),
('22222222-2222-2222-2222-222222222222', 'Beach Attendant 2', '(251) 555-0202', 'attendant');

-- ============================================
-- SEED DATA: Demo business (Maggie's Bakery)
-- ============================================

INSERT INTO businesses (site_id, domain, subdomain, name, type, status) VALUES
('11111111-1111-1111-1111-111111111111', NULL, 'maggies-bakery', 'Maggie''s Cakes and More', 'bakery', 'active');

INSERT INTO users (site_id, email, name, role) VALUES
('11111111-1111-1111-1111-111111111111', 'maggie@example.com', 'Maggie Thompson', 'owner');

INSERT INTO site_content (site_id, hero_text, hero_subtext, about_text, contact_phone, contact_email, address, city, state, zip, hours) VALUES
('11111111-1111-1111-1111-111111111111',
 'Maggie''s Cakes and More',
 'Handcrafted cakes, cupcakes, and pastries made fresh daily',
 'Welcome to Maggie''s Cakes and More! We''ve been serving the Gulf Coast community with handcrafted cakes, cupcakes, and pastries since 2018.',
 '(251) 555-0199',
 'maggie@maggiescakes.com',
 '123 Main Street',
 'Gulf Shores',
 'AL',
 '36542',
 '{"monday":{"open":"07:00","close":"18:00"},"tuesday":{"open":"07:00","close":"18:00"},"wednesday":{"open":"07:00","close":"18:00"},"thursday":{"open":"07:00","close":"18:00"},"friday":{"open":"07:00","close":"20:00"},"saturday":{"open":"08:00","close":"20:00"},"sunday":{"closed":true}}'
);

INSERT INTO site_apps (site_id, app_id) VALUES
('11111111-1111-1111-1111-111111111111', 'bakery-menu'),
('11111111-1111-1111-1111-111111111111', 'restaurant-ordering'),
('11111111-1111-1111-1111-111111111111', 'basic-crm'),
('11111111-1111-1111-1111-111111111111', 'sms-notifications');

INSERT INTO menu_items (site_id, name, description, price, category, tags, available) VALUES
('11111111-1111-1111-1111-111111111111', 'Red Velvet Cupcake', 'Classic red velvet with cream cheese frosting', 4.50, 'Cupcakes', '["popular"]', true),
('11111111-1111-1111-1111-111111111111', 'Chocolate Fudge Cupcake', 'Rich chocolate cake with fudge frosting', 4.50, 'Cupcakes', '["popular"]', true),
('11111111-1111-1111-1111-111111111111', 'Vanilla Bean Cupcake', 'Light vanilla cake with buttercream', 4.00, 'Cupcakes', '[]', true),
('11111111-1111-1111-1111-111111111111', 'Chocolate Chip Cookie', 'Crispy edges, chewy center, sea salt finish', 3.00, 'Cookies', '["popular"]', true),
('11111111-1111-1111-1111-111111111111', 'Custom Layer Cake', 'Choose your flavors, fillings, and decorations. Serves 12-16', 65.00, 'Cakes', '["custom-order"]', true),
('11111111-1111-1111-1111-111111111111', 'Croissant', 'Buttery, flaky, baked fresh every morning', 3.50, 'Pastries', '[]', true),
('11111111-1111-1111-1111-111111111111', 'Cinnamon Roll', 'Warm cinnamon roll with cream cheese icing', 5.00, 'Pastries', '["popular"]', true);

INSERT INTO customers (site_id, name, phone, email, total_orders, total_spent) VALUES
('11111111-1111-1111-1111-111111111111', 'Sarah Johnson', '(251) 555-0101', 'sarah@example.com', 5, 127.50),
('11111111-1111-1111-1111-111111111111', 'Mike Davis', '(251) 555-0102', 'mike@example.com', 3, 89.00),
('11111111-1111-1111-1111-111111111111', 'Emily Carter', '(251) 555-0103', 'emily@example.com', 8, 234.00);
