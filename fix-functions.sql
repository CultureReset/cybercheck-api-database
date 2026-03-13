-- ============================================================
-- FIX: Drop wrong function signatures, install correct versions
-- Run this in Supabase SQL Editor
-- ============================================================

-- Drop all wrong versions (any signature)
DROP FUNCTION IF EXISTS create_booking_if_available(UUID, UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS create_booking_if_available(UUID, UUID, UUID, UUID, TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS create_booking_hold(UUID, UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS create_booking_hold(UUID, UUID, UUID, UUID, TIMESTAMPTZ, INT);
DROP FUNCTION IF EXISTS increment_customer_bookings(UUID);

-- ============================================================
-- CORRECT: create_booking_if_available
-- Checks inventory, prevents overbooking, creates booking
-- ============================================================
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
BEGIN
    -- Count total inventory (good-condition fleet items)
    SELECT COUNT(*) INTO v_total_inventory
    FROM fleet_items
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND condition = 'good';

    -- Aggregate booked qty for this slot
    SELECT COALESCE(SUM(qty), 0) INTO v_booked
    FROM bookings
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND status IN ('pending', 'confirmed', 'checked_in');

    -- Count active holds (exclude this session to allow re-hold)
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

    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'available_after', v_available - p_qty
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CORRECT: create_booking_hold
-- Reserves a slot during checkout (10 min hold)
-- ============================================================
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

    -- Aggregate booked qty for this slot
    SELECT COALESCE(SUM(qty), 0) INTO v_booked
    FROM bookings
    WHERE site_id = p_site_id
      AND fleet_type_id = p_fleet_type_id
      AND time_slot_id = p_time_slot_id
      AND booking_date = p_booking_date
      AND status IN ('pending', 'confirmed', 'checked_in');

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

    -- Create the hold (expires in 10 minutes)
    INSERT INTO booking_holds (site_id, fleet_type_id, time_slot_id, booking_date, qty, session_id, expires_at)
    VALUES (p_site_id, p_fleet_type_id, p_time_slot_id, p_booking_date, p_qty, p_session_id, NOW() + INTERVAL '10 minutes')
    RETURNING id INTO v_hold_id;

    RETURN jsonb_build_object(
        'success', true,
        'hold_id', v_hold_id,
        'expires_in_seconds', 600,
        'available_after', v_available - p_qty
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CORRECT: increment_customer_bookings
-- Updates customer totals after booking
-- ============================================================
CREATE OR REPLACE FUNCTION increment_customer_bookings(customer_uuid UUID, amount DECIMAL)
RETURNS void AS $$
BEGIN
    UPDATE customers
    SET total_bookings = COALESCE(total_bookings, 0) + 1,
        total_spent = COALESCE(total_spent, 0) + amount,
        last_visit = NOW(),
        updated_at = NOW()
    WHERE id = customer_uuid;
END;
$$ LANGUAGE plpgsql;
