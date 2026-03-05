-- ============================================================
-- CyberCheck Platform — Seed Data
-- Part 3: Apps Catalog + Beachside Circle Boats + Demo Bakery
-- Run this THIRD in Supabase SQL Editor
-- ============================================================

-- ============================================
-- PLATFORM ADMIN ACCOUNT
-- ============================================

-- Admin "business" (platform container)
INSERT INTO businesses (site_id, name, type, subdomain, plan, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CyberCheck Platform', 'platform', 'admin', 'enterprise', 'active')
ON CONFLICT (site_id) DO NOTHING;

-- Admin user (password: CyberAdmin2026!)
INSERT INTO users (site_id, email, name, role, password_hash) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@cybercheck.com', 'admin', 'admin',
 '$2b$12$LqGnE8V8F1jKLR1qVJ8nHO6N5gYVpEL8R9K1v5wA7bZ7q3E6k.5mS')
ON CONFLICT DO NOTHING;

-- ============================================
-- MARKETPLACE APPS CATALOG
-- These are the apps businesses can subscribe to.
-- ============================================
INSERT INTO apps (app_id, name, description, category, business_types, monthly_price, icon) VALUES
('restaurant-menu',      'Restaurant Menu',       'Full menu with categories, specials, allergens',           'menu',      '["restaurant"]',           0,     '🍽️'),
('bakery-menu',          'Bakery Menu',           'Bakery items with custom orders, pickup dates',            'menu',      '["bakery"]',               0,     '🧁'),
('retail-products',      'Product Catalog',       'Products with variants, inventory, images',                'menu',      '["retail"]',               0,     '🛍️'),
('charter-booking',      'Charter Booking',       'Trip packages, capacity, gear add-ons',                    'booking',   '["charter"]',              19.99, '🎣'),
('salon-booking',        'Salon Booking',         'Stylist selection, service types, time slots',             'booking',   '["salon"]',                19.99, '💇'),
('rental-booking',       'Rental Booking',        'Fleet management, time slots, add-ons, group rates',      'booking',   '["rental"]',               19.99, '🚤'),
('service-booking',      'Service Booking',       'Appointments, service types, staff assignment',            'booking',   '["service"]',              19.99, '📅'),
('restaurant-ordering',  'Online Ordering',       'Cart, checkout, pickup times',                             'ordering',  '["restaurant","bakery"]',  29.99, '🛒'),
('basic-crm',           'Customer Manager',       'Customer list, history, notes',                            'crm',       '["restaurant","bakery","salon","charter","rental","retail","service"]', 14.99, '👥'),
('sms-notifications',   'SMS Notifications',      'Automated SMS for bookings and orders',                    'marketing', '["restaurant","bakery","salon","charter","rental","retail","service"]', 0.10,  '💬'),
('review-requests',     'Review Requests',        'Automatic review requests after service',                  'marketing', '["restaurant","bakery","salon","charter","rental","retail","service"]', 9.99,  '⭐'),
('social-feed',         'Social Feed',            'Display social media feeds on website',                    'marketing', '["restaurant","bakery","salon","charter","rental","retail","service"]', 9.99,  '📱'),
('analytics',           'Analytics Dashboard',    'Revenue, bookings, customer insights',                     'analytics', '["restaurant","bakery","salon","charter","rental","retail","service"]', 19.99, '📊'),
('loyalty',             'Loyalty Rewards',        'Points, punch cards, rewards program',                     'marketing', '["restaurant","bakery","salon","charter","rental","retail","service"]', 14.99, '🎁'),
('qr-menu',            'QR Menu Pro',            'QR code menu for dine-in customers',                       'menu',      '["restaurant","bakery"]',  9.99,  '📲'),
('social-manager',      'Social Media Manager',  'Post scheduling, cross-platform publishing',               'marketing', '["restaurant","bakery","salon","charter","rental","retail","service"]', 24.99, '📣');

-- ============================================
-- PLATFORM CONFIG
-- ============================================
INSERT INTO platform_config (key, value) VALUES
('ai_server_url', 'https://your-server.com/api/webhook/data-change'),
('platform_name', 'CyberCheck'),
('platform_domain', 'cybercheck.com');

-- ============================================
-- BEACHSIDE CIRCLE BOATS — Real Production Data
-- ============================================

-- Business
INSERT INTO businesses (site_id, domain, subdomain, name, type, plan, status, gcr_listed) VALUES
('22222222-2222-2222-2222-222222222222', NULL, 'beachside-circle-boats', 'Beachside Circle Boats', 'rental', 'pro', 'active', true);

-- Owner account (password: BeachBoats2026!)
INSERT INTO users (site_id, email, name, role, password_hash) VALUES
('22222222-2222-2222-2222-222222222222', 'beachsideboats@myyahoo.com', 'Beachside Owner', 'owner',
 '$2b$12$nqSo.LIoLqwvg5NpMp3NYeySsPttrx/PKrVME5Lb7RxwM21goKABK');

-- Site content (website data)
INSERT INTO site_content (
    site_id, hero_text, hero_subtext, hero_video_url,
    about_text, contact_phone, contact_email, website_url,
    address, city, state, zip,
    hours, gallery, social_links,
    theme_color, seo_title, seo_description
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'The Easiest Way to Get on the Water',
    'Rent a portable, eco-friendly circle boat. No license needed, no experience required. Just show up and cruise.',
    'https://www.youtube.com/embed/CI4qVeBE36Q',
    'Beachside Circle Boats offers eco-friendly, portable circle boat rentals in Orange Beach, Alabama. Powered by electric motors with zero emissions.',
    '(601) 325-1205',
    'beachsideboats@myyahoo.com',
    'https://beachsidecircleboats.com',
    '25856 Canal Road, Unit A',
    'Orange Beach',
    'AL',
    '36561',
    '{"monday":{"open":"08:00","close":"18:00","closed":false},"tuesday":{"open":"08:00","close":"18:00","closed":false},"wednesday":{"open":"08:00","close":"18:00","closed":false},"thursday":{"open":"08:00","close":"18:00","closed":false},"friday":{"open":"08:00","close":"18:00","closed":false},"saturday":{"open":"08:00","close":"18:00","closed":false},"sunday":{"open":"09:00","close":"17:00","closed":false}}',
    '[{"url":"images/goboat/goboat-hero.jpg","caption":"GoBoat on the water"},{"url":"images/goboat/goboat-bumpers.jpg","caption":"Double Seater"},{"url":"images/goboat/goboat-onwater1.jpg","caption":"Cruising"},{"url":"images/goboat/goboat-beach.jpg","caption":"Beach setup"},{"url":"images/goboat/goboat-woody.jpg","caption":"Woody edition"},{"url":"images/goboat/goboat-fishing.jpg","caption":"Fishing"},{"url":"images/goboat/goboat-motor.jpg","caption":"Electric motor"},{"url":"images/goboat/mini-dock-tow.jpg","caption":"Mini Dock"}]',
    '{"facebook":"#","instagram":"#","tiktok":"#"}',
    '#00ada8',
    'Beachside Circle Boats — Orange Beach, AL | Rentals',
    'Portable inflatable circle boat rentals in Orange Beach, Alabama. Eco-friendly electric boats for singles and doubles.'
);

-- Installed apps
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

-- Fleet inventory (physical boats)
INSERT INTO fleet_items (site_id, fleet_type_id, unit_name, condition) VALUES
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Single #1', 'good'),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Single #2', 'good'),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Single #3', 'good'),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Single #4', 'good'),
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Single #5', 'good'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Double #1', 'good'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Double #2', 'good'),
('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Double #3', 'good');

-- Rental time slots
INSERT INTO rental_time_slots (id, site_id, name, start_time, end_time, sort_order) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccc01', '22222222-2222-2222-2222-222222222222', 'Half Day AM', '09:00', '13:00', 1),
('cccccccc-cccc-cccc-cccc-cccccccccc02', '22222222-2222-2222-2222-222222222222', 'Half Day PM', '14:00', '18:00', 2),
('cccccccc-cccc-cccc-cccc-cccccccccc03', '22222222-2222-2222-2222-222222222222', 'All Day',     '09:00', '18:00', 3);

-- Pricing (fleet type x time slot)
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
('22222222-2222-2222-2222-222222222222', 'Mini Dock',          '8''4" x 44" platform for gear, yoga, sunbathing',    50.00, 'dock',   '🛟', 'per day',      1),
('22222222-2222-2222-2222-222222222222', 'X Dock',             '5'' x 5'' floating dock, holds a 58-qt cooler',       50.00, 'dock',   '🛟', 'per day',      2),
('22222222-2222-2222-2222-222222222222', 'Doggie Dock',        '5''4" x 43" with weighted mesh ramp for pets',        50.00, 'dock',   '🐕', 'per day',      3),
('22222222-2222-2222-2222-222222222222', 'Cooler Pack',        'Loaded cooler with ice, water, and your choice',      35.00, 'food',   '🍺', 'per cooler',   4),
('22222222-2222-2222-2222-222222222222', 'Drink & Ice',        'Water, Gatorade, sodas, juice. Bag of ice included.', 15.00, 'food',   '🧊', '6 drinks + ice', 5),
('22222222-2222-2222-2222-222222222222', 'Snack Pack',         'Chips, trail mix, granola bars, fruit snacks',        20.00, 'food',   '🍟', 'per pack',     6),
('22222222-2222-2222-2222-222222222222', 'Pup Pack',           'Dog treats, water bowl, and a doggie life vest',      15.00, 'food',   '🐶', 'per pup',      7),
('22222222-2222-2222-2222-222222222222', 'Bluetooth Speaker',  'Waterproof JBL speaker to set the vibe',              15.00, 'gear',   '🎵', 'per trip',     8),
('22222222-2222-2222-2222-222222222222', 'GoPro Rental',       'GoPro Hero with waterproof mount',                    30.00, 'gear',   '📷', 'per trip',     9),
('22222222-2222-2222-2222-222222222222', 'Fishing Gear',       'Rod, reel, tackle, and bait. Everything included.',   25.00, 'gear',   '🎣', 'per person',   10),
('22222222-2222-2222-2222-222222222222', 'Sun & Safety Kit',   'Reef-safe sunscreen, hat, dry bag, first aid kit',    10.00, 'safety', '☀️', 'per kit',      11);

-- Customers
INSERT INTO customers (site_id, name, phone, email, total_bookings, total_spent) VALUES
('22222222-2222-2222-2222-222222222222', 'Sarah Johnson',  '(251) 555-0101', 'sarah@example.com',  3, 525.00),
('22222222-2222-2222-2222-222222222222', 'Mike Davis',     '(251) 555-0102', 'mike@example.com',   1, 275.00),
('22222222-2222-2222-2222-222222222222', 'Emily Carter',   '(251) 555-0103', 'emily@example.com',  5, 1100.00),
('22222222-2222-2222-2222-222222222222', 'James Wilson',   '(251) 555-0104', 'james@example.com',  2, 400.00);

-- Bookings
INSERT INTO bookings (
    site_id, fleet_type_id, time_slot_id, booking_date, qty, addons,
    subtotal, total, status, payment_status,
    customer_name, customer_phone, customer_email, booking_token
) VALUES
('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc03',
 CURRENT_DATE + 1, 2, '[{"name":"Cooler Pack","price":35},{"name":"Bluetooth Speaker","price":15}]',
 500.00, 500.00, 'confirmed', 'paid', 'Sarah Johnson', '(251) 555-0101', 'sarah@example.com', 'bk_' || substr(md5(random()::text), 1, 10)),

('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccc01',
 CURRENT_DATE + 2, 1, '[]',
 200.00, 200.00, 'pending', 'unpaid', 'Mike Davis', '(251) 555-0102', 'mike@example.com', 'bk_' || substr(md5(random()::text), 1, 10)),

('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccc01',
 CURRENT_DATE + 3, 5, '[{"name":"Mini Dock","price":50}]',
 1050.00, 1050.00, 'confirmed', 'deposit_paid', 'Emily Carter', '(251) 555-0103', 'emily@example.com', 'bk_' || substr(md5(random()::text), 1, 10));

-- Staff
INSERT INTO staff (site_id, name, phone, role) VALUES
('22222222-2222-2222-2222-222222222222', 'Beach Attendant 1', '(251) 555-0201', 'attendant'),
('22222222-2222-2222-2222-222222222222', 'Beach Attendant 2', '(251) 555-0202', 'attendant');

-- FAQs
INSERT INTO faqs (site_id, question, answer, sort_order) VALUES
('22222222-2222-2222-2222-222222222222', 'Do I need a boating license?', 'No! Our circle boats are classified as personal watercraft and require no license or experience.', 1),
('22222222-2222-2222-2222-222222222222', 'How fast do the boats go?', 'Up to 5 mph with the 5-speed electric motor. Perfect for a relaxing cruise!', 2),
('22222222-2222-2222-2222-222222222222', 'Can I bring my dog?', 'Absolutely! We even offer a Doggie Dock and Pup Pack add-on. Life vests included.', 3),
('22222222-2222-2222-2222-222222222222', 'What if it rains?', 'We monitor weather closely. If conditions are unsafe, we will reschedule or fully refund your booking.', 4),
('22222222-2222-2222-2222-222222222222', 'Where do I launch?', 'We meet you at 25856 Canal Road, Unit A, Orange Beach, AL 36561. Right on the canal!', 5);


-- ============================================
-- MAGGIE'S CAKES AND MORE — Real Production Data
-- ============================================

INSERT INTO businesses (site_id, domain, subdomain, name, type, status) VALUES
('11111111-1111-1111-1111-111111111111', NULL, 'maggies-bakery', 'Maggie''s Cakes and More', 'bakery', 'active');

INSERT INTO users (site_id, email, name, role) VALUES
('11111111-1111-1111-1111-111111111111', 'maggie@example.com', 'Maggie Thompson', 'owner');

INSERT INTO site_content (
    site_id, hero_text, hero_subtext, about_text,
    contact_phone, contact_email, address, city, state, zip, hours
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Maggie''s Cakes and More',
    'Handcrafted cakes, cupcakes, and pastries made fresh daily',
    'Welcome to Maggie''s Cakes and More! We''ve been serving the Gulf Coast community with handcrafted cakes, cupcakes, and pastries since 2018.',
    '(251) 555-0199',
    'maggie@maggiescakes.com',
    '123 Main Street', 'Gulf Shores', 'AL', '36542',
    '{"monday":{"open":"07:00","close":"18:00"},"tuesday":{"open":"07:00","close":"18:00"},"wednesday":{"open":"07:00","close":"18:00"},"thursday":{"open":"07:00","close":"18:00"},"friday":{"open":"07:00","close":"20:00"},"saturday":{"open":"08:00","close":"20:00"},"sunday":{"closed":true}}'
);

INSERT INTO site_apps (site_id, app_id) VALUES
('11111111-1111-1111-1111-111111111111', 'bakery-menu'),
('11111111-1111-1111-1111-111111111111', 'restaurant-ordering'),
('11111111-1111-1111-1111-111111111111', 'basic-crm'),
('11111111-1111-1111-1111-111111111111', 'sms-notifications');

-- Menu categories for bakery
INSERT INTO menu_categories (id, site_id, name, time_start, time_end, sort_order) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-1111-1111-111111111111', 'All Day',    '07:00', '20:00', 1),
('dddddddd-dddd-dddd-dddd-dddddddddd02', '11111111-1111-1111-1111-111111111111', 'Breakfast',  '07:00', '11:00', 2);

-- Menu subcategories
INSERT INTO menu_subcategories (id, site_id, category_id, name, sort_order) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'Cupcakes',  1),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'Cookies',   2),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'Cakes',     3),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', '11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'Pastries',  1);

-- Menu items (now linked to categories + subcategories)
INSERT INTO menu_items (site_id, category_id, subcategory_id, name, description, price, tags, available) VALUES
('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'Red Velvet Cupcake',      'Classic red velvet with cream cheese frosting',                4.50,  '["popular"]',       true),
('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'Chocolate Fudge Cupcake', 'Rich chocolate cake with fudge frosting',                      4.50,  '["popular"]',       true),
('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'Vanilla Bean Cupcake',    'Light vanilla cake with buttercream',                          4.00,  '[]',                true),
('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02', 'Chocolate Chip Cookie',   'Crispy edges, chewy center, sea salt finish',                  3.00,  '["popular"]',       true),
('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03', 'Custom Layer Cake',       'Choose your flavors, fillings, and decorations. Serves 12-16', 65.00, '["custom-order"]',  true),
('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', 'Croissant',               'Buttery, flaky, baked fresh every morning',                    3.50,  '[]',                true),
('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee04', 'Cinnamon Roll',           'Warm cinnamon roll with cream cheese icing',                   5.00,  '["popular"]',       true);

INSERT INTO customers (site_id, name, phone, email, total_orders, total_spent) VALUES
('11111111-1111-1111-1111-111111111111', 'Sarah Johnson', '(251) 555-0101', 'sarah@example.com', 5, 127.50),
('11111111-1111-1111-1111-111111111111', 'Mike Davis',    '(251) 555-0102', 'mike@example.com',  3, 89.00),
('11111111-1111-1111-1111-111111111111', 'Emily Carter',  '(251) 555-0103', 'emily@example.com', 8, 234.00);
