-- ============================================================
-- CyberCheck Platform — Security Layer
-- Part 2: RLS Policies + Helper Functions
-- Run this SECOND in Supabase SQL Editor
-- ============================================================

-- ============================================
-- HELPER: Get current user's site_id from JWT
-- Uses SECURITY DEFINER to bypass RLS when
-- looking up the users table (avoids circular dep)
-- NOTE: Lives in public schema (Supabase blocks auth schema writes)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_site_id() RETURNS UUID AS $$
  SELECT site_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================
-- HELPER: Auto-update updated_at on row change
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_site_content_updated BEFORE UPDATE ON site_content FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_site_pages_updated BEFORE UPDATE ON site_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_connections_updated BEFORE UPDATE ON connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fleet_types_updated BEFORE UPDATE ON fleet_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fleet_items_updated BEFORE UPDATE ON fleet_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER: Increment customer bookings
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

-- ============================================
-- HELPER: Increment customer orders
-- ============================================
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

-- ============================================
-- ENABLE RLS ON ALL TENANT TABLES
-- ============================================
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_subcategories ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;

-- ============================================
-- OWNER POLICIES
-- Business owners see ONLY their own data.
-- This is the core security — Business A can
-- NEVER read, write, or delete Business B's data.
-- ============================================

-- Businesses: owners see only their own business
CREATE POLICY "owner_read_own_business" ON businesses
    FOR SELECT USING (site_id = public.get_site_id());
CREATE POLICY "owner_update_own_business" ON businesses
    FOR UPDATE USING (site_id = public.get_site_id());

-- Users: owners see their own team
CREATE POLICY "owner_all_users" ON users
    FOR ALL USING (site_id = public.get_site_id());

-- Site content: full CRUD on own content
CREATE POLICY "owner_all_site_content" ON site_content
    FOR ALL USING (site_id = public.get_site_id());

-- Site pages: full CRUD on own pages
CREATE POLICY "owner_all_site_pages" ON site_pages
    FOR ALL USING (site_id = public.get_site_id());

-- Site apps: see own installed apps
CREATE POLICY "owner_all_site_apps" ON site_apps
    FOR ALL USING (site_id = public.get_site_id());

-- Connections: manage own OAuth connections
CREATE POLICY "owner_all_connections" ON connections
    FOR ALL USING (site_id = public.get_site_id());

-- Customers: full CRUD on own customers
CREATE POLICY "owner_all_customers" ON customers
    FOR ALL USING (site_id = public.get_site_id());

-- Menu categories (Breakfast, Lunch, Dinner, etc.)
CREATE POLICY "owner_all_menu_categories" ON menu_categories
    FOR ALL USING (site_id = public.get_site_id());

-- Menu subcategories (Appetizers, Seafood, Burgers, etc.)
CREATE POLICY "owner_all_menu_subcategories" ON menu_subcategories
    FOR ALL USING (site_id = public.get_site_id());

-- Menu items
CREATE POLICY "owner_all_menu_items" ON menu_items
    FOR ALL USING (site_id = public.get_site_id());

-- Specials
CREATE POLICY "owner_all_specials" ON specials
    FOR ALL USING (site_id = public.get_site_id());

-- Events
CREATE POLICY "owner_all_events" ON events
    FOR ALL USING (site_id = public.get_site_id());

-- Services
CREATE POLICY "owner_all_services" ON services
    FOR ALL USING (site_id = public.get_site_id());

-- Availability
CREATE POLICY "owner_all_availability" ON availability
    FOR ALL USING (site_id = public.get_site_id());

-- Fleet types
CREATE POLICY "owner_all_fleet_types" ON fleet_types
    FOR ALL USING (site_id = public.get_site_id());

-- Fleet items
CREATE POLICY "owner_all_fleet_items" ON fleet_items
    FOR ALL USING (site_id = public.get_site_id());

-- Rental time slots
CREATE POLICY "owner_all_time_slots" ON rental_time_slots
    FOR ALL USING (site_id = public.get_site_id());

-- Rental pricing
CREATE POLICY "owner_all_pricing" ON rental_pricing
    FOR ALL USING (site_id = public.get_site_id());

-- Rental group rates
CREATE POLICY "owner_all_group_rates" ON rental_group_rates
    FOR ALL USING (site_id = public.get_site_id());

-- Rental add-ons
CREATE POLICY "owner_all_addons" ON rental_addons
    FOR ALL USING (site_id = public.get_site_id());

-- Bookings
CREATE POLICY "owner_all_bookings" ON bookings
    FOR ALL USING (site_id = public.get_site_id());

-- Orders
CREATE POLICY "owner_all_orders" ON orders
    FOR ALL USING (site_id = public.get_site_id());

-- Waivers
CREATE POLICY "owner_all_waivers" ON waivers
    FOR ALL USING (site_id = public.get_site_id());

-- Reviews
CREATE POLICY "owner_all_reviews" ON reviews
    FOR ALL USING (site_id = public.get_site_id());

-- Staff
CREATE POLICY "owner_all_staff" ON staff
    FOR ALL USING (site_id = public.get_site_id());

-- Media
CREATE POLICY "owner_all_media" ON media
    FOR ALL USING (site_id = public.get_site_id());

-- SMS Log
CREATE POLICY "owner_all_sms_log" ON sms_log
    FOR ALL USING (site_id = public.get_site_id());

-- FAQs
CREATE POLICY "owner_all_faqs" ON faqs
    FOR ALL USING (site_id = public.get_site_id());

-- Coupons
CREATE POLICY "owner_all_coupons" ON coupons
    FOR ALL USING (site_id = public.get_site_id());

-- Notifications
CREATE POLICY "owner_all_notifications" ON notifications
    FOR ALL USING (site_id = public.get_site_id());

-- Activity Log
CREATE POLICY "owner_all_activity_log" ON activity_log
    FOR ALL USING (site_id = public.get_site_id());

-- Support Tickets
CREATE POLICY "owner_all_support_tickets" ON support_tickets
    FOR ALL USING (site_id = public.get_site_id());

-- Custom Domains
CREATE POLICY "owner_all_domains" ON domains
    FOR ALL USING (site_id = public.get_site_id());

-- ============================================
-- PUBLIC READ POLICIES
-- Customer-facing website reads (anon key, no auth)
-- These are the tables the PUBLIC website can read.
-- Each business's website shows their own data.
-- ============================================

-- Businesses: public can look up active businesses (by subdomain/domain)
CREATE POLICY "public_read_businesses" ON businesses
    FOR SELECT USING (status = 'active');

-- Apps catalog: everyone can see app listings
CREATE POLICY "public_read_apps" ON apps
    FOR SELECT USING (true);

-- Site content: public website reads business info
CREATE POLICY "public_read_site_content" ON site_content
    FOR SELECT USING (true);

-- Site pages: public can see visible pages
CREATE POLICY "public_read_site_pages" ON site_pages
    FOR SELECT USING (visible = true);

-- Fleet types: public booking page shows available fleet
CREATE POLICY "public_read_fleet_types" ON fleet_types
    FOR SELECT USING (available = true);

-- Rental time slots: public booking page shows time options
CREATE POLICY "public_read_time_slots" ON rental_time_slots
    FOR SELECT USING (active = true);

-- Rental pricing: public can see prices
CREATE POLICY "public_read_pricing" ON rental_pricing
    FOR SELECT USING (true);

-- Group rates: public can see group discounts
CREATE POLICY "public_read_group_rates" ON rental_group_rates
    FOR SELECT USING (active = true);

-- Rental add-ons: public can see add-on options
CREATE POLICY "public_read_addons" ON rental_addons
    FOR SELECT USING (available = true);

-- Menu categories: public sees active meal periods
CREATE POLICY "public_read_menu_categories" ON menu_categories
    FOR SELECT USING (active = true);

-- Menu subcategories: public sees active subcategories
CREATE POLICY "public_read_menu_subcategories" ON menu_subcategories
    FOR SELECT USING (active = true);

-- Menu items: public website shows available items
CREATE POLICY "public_read_menu" ON menu_items
    FOR SELECT USING (available = true);

-- Services: public booking page
CREATE POLICY "public_read_services" ON services
    FOR SELECT USING (available = true);

-- Availability: public booking page
CREATE POLICY "public_read_availability" ON availability
    FOR SELECT USING (true);

-- Specials: public website
CREATE POLICY "public_read_specials" ON specials
    FOR SELECT USING (active = true);

-- Events: public website
CREATE POLICY "public_read_events" ON events
    FOR SELECT USING (active = true);

-- Reviews: public can see published reviews
CREATE POLICY "public_read_reviews" ON reviews
    FOR SELECT USING (status = 'published');

-- FAQs: public website
CREATE POLICY "public_read_faqs" ON faqs
    FOR SELECT USING (true);

-- Staff: public website shows team
CREATE POLICY "public_read_staff" ON staff
    FOR SELECT USING (active = true);

-- ============================================
-- PUBLIC INSERT POLICIES
-- Customers can create bookings, submit reviews, etc.
-- No auth needed — these are customer actions.
-- ============================================

CREATE POLICY "public_insert_bookings" ON bookings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "public_insert_customers" ON customers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "public_insert_orders" ON orders
    FOR INSERT WITH CHECK (true);

CREATE POLICY "public_insert_waivers" ON waivers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "public_insert_reviews" ON reviews
    FOR INSERT WITH CHECK (true);
