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
