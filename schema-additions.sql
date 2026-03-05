-- ============================================
-- ADDITIONAL TABLES (run in Supabase SQL Editor)
-- These tables are needed by the API routes
-- ============================================

-- Add password_hash and reset fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;

-- ============================================
-- REVIEWS
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
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, published, rejected
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_site ON reviews(site_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(site_id, status);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON reviews FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "public_read" ON reviews FOR SELECT USING (status = 'published');
CREATE POLICY "public_insert" ON reviews FOR INSERT WITH CHECK (true);

-- ============================================
-- FAQS
-- ============================================
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_site ON faqs(site_id);
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON faqs FOR ALL USING (site_id = auth.site_id());
CREATE POLICY "public_read" ON faqs FOR SELECT USING (true);

-- ============================================
-- COUPONS
-- ============================================
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- percentage, fixed
    amount DECIMAL(10,2) NOT NULL,
    min_order DECIMAL(10,2) DEFAULT 0,
    max_uses INT,
    uses_count INT DEFAULT 0,
    expires_at TIMESTAMPTZ,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_site ON coupons(site_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(site_id, code);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON coupons FOR ALL USING (site_id = auth.site_id());

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- booking, payment, review, message, system, contact_form, sms_received
    title VARCHAR(255) NOT NULL,
    body TEXT,
    metadata JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_site ON notifications(site_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(site_id, read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON notifications FOR ALL USING (site_id = auth.site_id());

-- ============================================
-- ACTIVITY LOG (per business)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- booking.created, review.submitted, profile.updated, etc.
    entity_type VARCHAR(50), -- booking, review, customer, service, etc.
    entity_id UUID,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_site ON activity_log(site_id);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON activity_log FOR ALL USING (site_id = auth.site_id());

-- ============================================
-- AUDIT LOG (admin actions — platform-wide)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- impersonate, suspend, create_business, etc.
    target_type VARCHAR(50), -- business, user, app, template
    target_id TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(admin_id);

-- ============================================
-- TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(50), -- general, restaurant, salon, service, rental, retail
    description TEXT,
    thumbnail_url TEXT,
    html_content TEXT,
    css_content TEXT,
    js_content TEXT,
    price DECIMAL(10,2) DEFAULT 0, -- 0 = free
    status VARCHAR(20) DEFAULT 'active', -- active, draft, disabled
    usage_count INT DEFAULT 0,
    template_type VARCHAR(20) DEFAULT 'website', -- website, linktree
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUPPORT TICKETS
-- ============================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high
    status VARCHAR(20) DEFAULT 'open', -- open, in_progress, resolved, closed
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_site ON support_tickets(site_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners_all" ON support_tickets FOR ALL USING (site_id = auth.site_id());

-- ============================================
-- HELPER FUNCTION: Increment customer bookings
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
-- HELPER FUNCTION: Increment customer orders
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
-- SMS & MESSAGING (run in Supabase SQL Editor)
-- ============================================

-- Messaging settings per business (templates, toggles)
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS messaging_settings JSONB DEFAULT '{}';

-- SMS opt-out tracking (TCPA compliance)
CREATE TABLE IF NOT EXISTS sms_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    site_id UUID REFERENCES businesses(site_id),
    opted_out_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phone, site_id)
);

CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_phone ON sms_opt_outs(phone);

-- SMS campaigns
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

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_site ON sms_campaigns(site_id);

-- Add metadata column to sms_log if not present
ALTER TABLE sms_log ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ============================================
-- BOOKING HOLDS (temporary reservation during checkout)
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

CREATE INDEX IF NOT EXISTS idx_booking_holds_lookup
    ON booking_holds(site_id, fleet_type_id, time_slot_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_booking_holds_expiry ON booking_holds(expires_at);

-- ============================================
-- ATOMIC BOOKING FUNCTION (prevents overbooking)
-- Checks availability + inserts in a single transaction with row locking
-- ============================================
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
    -- Count total inventory (good-condition fleet items) with advisory lock
    SELECT COUNT(*) INTO v_total_inventory
    FROM fleet_items
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND condition = 'good';

    -- Count already booked qty for this slot+date (lock the rows to prevent race conditions)
    SELECT COALESCE(SUM(qty), 0) INTO v_booked
    FROM bookings
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND status IN ('pending', 'confirmed', 'checked_in')
    FOR UPDATE;

    -- Count active holds (exclude this session's hold if converting)
    SELECT COALESCE(SUM(qty), 0) INTO v_held
    FROM booking_holds
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND expires_at > NOW()
      AND (p_hold_session_id IS NULL OR session_id != p_hold_session_id);

    v_available := v_total_inventory - v_booked - v_held;

    -- Check if enough inventory
    IF v_available < p_qty THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not enough availability. Only ' || v_available || ' unit(s) remaining.',
            'available', v_available,
            'requested', p_qty
        );
    END IF;

    -- Insert the booking
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

    -- Delete the hold if converting from a hold
    IF p_hold_session_id IS NOT NULL THEN
        DELETE FROM booking_holds
        WHERE session_id = p_hold_session_id
          AND site_id = p_site_id;
    END IF;

    -- Return success with the booking id
    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'available_after', v_available - p_qty
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HOLD CREATION FUNCTION (reserves slot during checkout)
-- ============================================
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
    -- Clean up expired holds first
    DELETE FROM booking_holds WHERE expires_at < NOW();

    -- Count total inventory
    SELECT COUNT(*) INTO v_total_inventory
    FROM fleet_items
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND condition = 'good';

    -- Count booked
    SELECT COALESCE(SUM(qty), 0) INTO v_booked
    FROM bookings
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND status IN ('pending', 'confirmed', 'checked_in')
    FOR UPDATE;

    -- Count existing holds (exclude this session to allow re-hold)
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

    -- Remove any existing hold for this session
    DELETE FROM booking_holds
    WHERE session_id = p_session_id AND site_id = p_site_id;

    -- Create the hold
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
