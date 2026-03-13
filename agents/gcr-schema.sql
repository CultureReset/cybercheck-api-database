-- ============================================
-- GCR / AI Concierge Schema
-- Run in Supabase SQL Editor AFTER schema.sql + schema-additions.sql
-- ============================================

-- Business personality / AI context
CREATE TABLE IF NOT EXISTS business_details (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    elevator_pitch TEXT,
    vibe TEXT,
    age_restriction TEXT,
    dress_code TEXT,
    insider_tip TEXT,
    best_for TEXT,
    keywords JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE business_details ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "owners_all" ON business_details FOR ALL USING (site_id = auth.site_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public_read" ON business_details FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Parking, directions, accessibility
CREATE TABLE IF NOT EXISTS business_logistics (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    parking TEXT,
    accessibility TEXT,
    directions TEXT,
    public_transit TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE business_logistics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "owners_all" ON business_logistics FOR ALL USING (site_id = auth.site_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public_read" ON business_logistics FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Atmosphere / vibe details
CREATE TABLE IF NOT EXISTS business_atmosphere (
    site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
    music_type TEXT,
    noise_level TEXT,
    indoor_outdoor TEXT,
    seating TEXT,
    reservation_required BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE business_atmosphere ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "owners_all" ON business_atmosphere FOR ALL USING (site_id = auth.site_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public_read" ON business_atmosphere FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pre-trained Q&A pairs for AI
CREATE TABLE IF NOT EXISTS qa_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(50), -- hours, parking, booking, pricing, policy, faq
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qa_pairs_site ON qa_pairs(site_id);
ALTER TABLE qa_pairs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "owners_all" ON qa_pairs FOR ALL USING (site_id = auth.site_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public_read" ON qa_pairs FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AI vector embeddings (requires pgvector extension)
-- Enable with: CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS ai_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_type VARCHAR(50), -- about, service, faq, review, policy, hours
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_chunks_site ON ai_chunks(site_id);
ALTER TABLE ai_chunks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "owners_all" ON ai_chunks FOR ALL USING (site_id = auth.site_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "public_read" ON ai_chunks FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- GCR TRIP PASS — Loyalty Members
-- ============================================

CREATE TABLE IF NOT EXISTS loyalty_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- site_id is NULL for GCR platform-wide members, set for business-specific
    site_id UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    name VARCHAR(255),
    points INT DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'bronze', -- bronze, silver, gold, vip
    interests JSONB DEFAULT '[]',     -- ['food', 'music', 'fishing', 'family']
    member_type VARCHAR(20) DEFAULT 'tourist', -- tourist, snowbird, local
    zip VARCHAR(10),
    sms_opt_in BOOLEAN DEFAULT true,
    personal_code VARCHAR(20) UNIQUE, -- gcr.link/{code} short code
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_phone ON loyalty_members(phone);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_email ON loyalty_members(email);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_code ON loyalty_members(personal_code);

-- Loyalty points earned/redeemed
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
    site_id UUID REFERENCES businesses(site_id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL, -- earn, redeem, bonus, expire
    points INT NOT NULL,       -- positive = earned, negative = redeemed
    description TEXT,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_member ON loyalty_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_site ON loyalty_transactions(site_id);

-- ============================================
-- SEED: Beachside Q&A pairs
-- ============================================

INSERT INTO qa_pairs (site_id, question, answer, category) VALUES
('22222222-2222-2222-2222-222222222222', 'How old do you have to be to rent?', 'You must be at least 18 years old to rent a circle boat. Minors are welcome as passengers with a supervising adult.', 'policy'),
('22222222-2222-2222-2222-222222222222', 'Do I need a license or experience?', 'No license or boating experience is required! The boats are beginner-friendly and we give you a full safety briefing before you launch.', 'policy'),
('22222222-2222-2222-2222-222222222222', 'Can I bring my dog?', 'Yes! We love pets. We recommend adding the Doggie Dock add-on ($50) for extra deck space, and the Pup Pack ($15) includes treats, a water bowl, and a doggie life vest.', 'policy'),
('22222222-2222-2222-2222-222222222222', 'Where are you located?', 'We are at 25856 Canal Road, Unit A, Orange Beach, AL 36561. Look for us along the canal.', 'hours'),
('22222222-2222-2222-2222-222222222222', 'What are your hours?', 'Monday–Saturday 8am–6pm, Sunday 9am–5pm.', 'hours'),
('22222222-2222-2222-2222-222222222222', 'Is there parking?', 'Yes, free parking is available on-site at our Canal Road location.', 'parking'),
('22222222-2222-2222-2222-222222222222', 'How much does it cost?', 'Single Seater: $150 half day, $225 all day. Double Seater: $200 half day, $275 all day. Group of 5+ singles all day: $200 each.', 'pricing'),
('22222222-2222-2222-2222-222222222222', 'What is the weight limit?', 'Single Seater holds up to 300 lbs. Double Seater holds up to 450 lbs combined.', 'policy'),
('22222222-2222-2222-2222-222222222222', 'How fast do the boats go?', 'Up to 5 mph. They are relaxed cruisers, great for exploring canals, fishing, and enjoying the scenery.', 'faq'),
('22222222-2222-2222-2222-222222222222', 'Can I cancel my booking?', 'Please contact us at least 24 hours in advance for cancellations. Reach us at (601) 325-1205.', 'policy')
ON CONFLICT DO NOTHING;

-- Seed business_details for Circle Boats
INSERT INTO business_details (site_id, elevator_pitch, vibe, age_restriction, dress_code, insider_tip, best_for, keywords)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Portable eco-friendly circle boat rentals in Orange Beach. No license needed, just show up and cruise.',
    'Relaxed, family-friendly, outdoor adventure',
    'Must be 18+ to rent. Minors welcome as passengers with adult.',
    'Swimwear and casual clothes. Bring sunscreen!',
    'Book the All Day slot for the best value. Add the Mini Dock for a floating picnic platform.',
    'Families, couples, dog owners, anglers, sunset cruisers',
    '["circle boats", "boat rental", "orange beach", "canal", "eco-friendly", "electric", "no license", "dog friendly"]'
)
ON CONFLICT (site_id) DO NOTHING;

INSERT INTO business_logistics (site_id, parking, accessibility, directions)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Free on-site parking at 25856 Canal Road, Unit A',
    'Ground level access. Contact us for specific accessibility needs.',
    'Take Canal Road in Orange Beach toward the Gulf. Look for Beachside Circle Boats signage along the canal.'
)
ON CONFLICT (site_id) DO NOTHING;

INSERT INTO business_atmosphere (site_id, indoor_outdoor, seating, noise_level, reservation_required)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    'outdoor',
    'On the water — boats seat 1-2 people each',
    'low — peaceful canal setting',
    false
)
ON CONFLICT (site_id) DO NOTHING;
