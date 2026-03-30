```sql
-- Create GCR/AI Tables
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

CREATE TABLE IF NOT EXISTS business_logistics (
  site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  parking TEXT,
  accessibility TEXT,
  directions TEXT,
  public_transit TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_atmosphere (
  site_id UUID PRIMARY KEY REFERENCES businesses(site_id) ON DELETE CASCADE,
  music_type TEXT,
  noise_level TEXT,
  indoor_outdoor TEXT,
  seating TEXT,
  reservation_required BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qa_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
  question TEXT,
  answer TEXT,
  category VARCHAR(50),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_pairs_site_id ON qa_pairs(site_id);
CREATE INDEX IF NOT EXISTS idx_qa_pairs_category ON qa_pairs(category);

CREATE TABLE IF NOT EXISTS ai_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES businesses(site_id) ON DELETE CASCADE,
  content TEXT,
  chunk_type VARCHAR(50),
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chunks_site_id ON ai_chunks(site_id);
CREATE INDEX IF NOT EXISTS idx_ai_chunks_type ON ai_chunks(chunk_type);

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

CREATE INDEX IF NOT EXISTS idx_loyalty_members_site_id ON loyalty_members(site_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_phone ON loyalty_members(phone);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_email ON loyalty_members(email);

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

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_member_id ON loyalty_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_site_id ON loyalty_transactions(site_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_booking_id ON loyalty_transactions(booking_id);

-- Create Missing Functions

CREATE OR REPLACE FUNCTION create_booking_if_available(
  p_site_id UUID,
  p_customer_id UUID,
  p_time_slot_id UUID,
  p_num_guests INT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  booking_id UUID,
  message TEXT
) AS $$
DECLARE
  v_booking_id UUID;
  v_capacity INT;
  v_booked_count INT;
  v_available_slots INT;
  v_slot_datetime TIMESTAMPTZ;
BEGIN
  -- Get time slot details and capacity
  SELECT ts.datetime, b.capacity
  INTO v_slot_datetime, v_capacity
  FROM time_slots ts
  JOIN businesses b ON ts.site_id = b.site_id
  WHERE ts.id = p_time_slot_id AND ts.site_id = p_site_id
  FOR UPDATE;

  IF v_slot_datetime IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Time slot not found'::TEXT;
    RETURN;
  END IF;

  -- Count existing bookings for this slot
  SELECT COALESCE(SUM(num_guests), 0)
  INTO v_booked_count
  FROM bookings
  WHERE time_slot_id = p_time_slot_id
    AND site_id = p_site_id
    AND status IN ('confirmed', 'active');

  v_available_slots := v_capacity - v_booked_count;

  IF p_num_guests > v_available_slots THEN
    RETURN QUERY SELECT false, NULL::UUID, 'Not enough capacity available'::TEXT;
    RETURN;
  END IF;

  -- Create booking
  INSERT INTO bookings (site_id, customer_id, time_slot_id, num_guests, notes, status)
  VALUES (p_site_id, p_customer_id, p_time_slot_id, p_num_guests, p_notes, 'confirmed')
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT true, v_booking_id, 'Booking created successfully'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, ('Error: ' || SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION create_booking_hold(
  p_site_id UUID,
  p_customer_id UUID,
  p_time_slot_id UUID,
  p_num_guests INT,
  p_hold_duration_minutes INT DEFAULT 15
)
RETURNS TABLE(
  success BOOLEAN,
  booking_id UUID,
  expires_at TIMESTAMPTZ,
  message TEXT
) AS $$
DECLARE
  v_booking_id UUID;
  v_capacity INT;
  v_booked_count INT;
  v_available_slots INT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get time slot details and capacity
  SELECT ts.datetime, b.capacity
  INTO v_slot_datetime, v_capacity
  FROM time_slots ts
  JOIN businesses b ON ts.site_id = b.site_id
  WHERE ts.id = p_time_slot_id AND ts.site_id = p_site_id
  FOR UPDATE;

  IF v_slot_datetime IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, 'Time slot not found'::TEXT;
    RETURN;
  END IF;

  -- Count existing holds and confirmed bookings
  SELECT COALESCE(SUM(num_guests), 0)
  INTO v_booked_count
  FROM bookings
  WHERE time_slot_id = p_time_slot_id
    AND site_id = p_site_id
    AND status IN ('confirmed', 'active', 'hold');

  v_available_slots := v_capacity - v_booked_count;

  IF p_num_guests > v_available_slots THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, 'Not enough capacity for hold'::TEXT;
    RETURN;
  END IF;

  v_expires_at := NOW() + (p_hold_duration_minutes || ' minutes')::INTERVAL;

  -- Create hold booking
  INSERT INTO bookings (site_id, customer_id, time_slot_id, num_guests, status, hold_expires_at)
  VALUES (p_site_id, p_customer_id, p_time_slot_id, p_num_guests, 'hold', v_expires_at)
  RETURNING id INTO v_booking_id;

  RETURN QUERY SELECT true, v_booking_id, v_expires_at, 'Hold created successfully'::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, ('Error: ' || SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_customer_bookings(
  p_customer_id UUID,
  p_site_id UUID,
  p_increment INT DEFAULT 1
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE customers
  SET total_bookings = total_bookings + p_increment
  WHERE id = p_customer_id AND site_id = p_site_id;

  RETURN FOUND;

EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION increment_customer_orders(
  p_customer_id UUID,
  p_site_id UUID,
  p_increment INT DEFAULT 1
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE customers
  SET total_orders = total_orders + p_increment
  WHERE id = p_customer_id AND site_id = p_site_id;

  RETURN FOUND;

EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add RLS Policies for GCR/AI Tables

ALTER TABLE business_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_logistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_atmosphere ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "business_details_select" ON business_details
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "business_details_update" ON business_details
    FOR UPDATE USING (
      auth.uid()::uuid IN (
        SELECT user_id FROM business_admins WHERE site_id = business_details.site_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "business_logistics_select" ON business_logistics
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "business_logistics_update" ON business_logistics
    FOR UPDATE USING (
      auth.uid()::uuid IN (
        SELECT user_id FROM business_admins WHERE site_id = business_logistics.site_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "business_atmosphere_select" ON business_atmosphere
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "business_atmosphere_update" ON business_atmosphere
    FOR UPDATE USING (
      auth.uid()::uuid IN (
        SELECT user_id FROM business_admins WHERE site_id = business_atmosphere.site_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "qa_pairs_select" ON qa_pairs
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "qa_pairs_manage" ON qa_pairs
    FOR ALL USING (
      auth.uid()::uuid IN (
        SELECT user_id FROM business_admins WHERE site_id = qa_pairs.site_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "ai_chunks_select" ON ai_chunks
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "ai_chunks_manage" ON ai_chunks
    FOR ALL USING (
      auth.uid()::uuid IN (
        SELECT user_id FROM business_admins WHERE site_id = ai_chunks.site_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "loyalty_members_select" ON loyalty_members
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "loyalty_members_insert" ON loyalty_members
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "loyalty_members_update" ON loyalty_members
    FOR UPDATE USING (
      auth.uid()::uuid IN (
        SELECT user_id FROM business_admins WHERE site_id = loyalty_members.site_id
      )
      OR id = auth.uid()::uuid
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "loyalty_transactions_select" ON loyalty_transactions
    FOR SELECT USING (
      auth.uid()::uuid IN (
        SELECT user_id FROM business_admins WHERE site_id = loyalty_transactions.site_id
      )
      OR member_id IN (SELECT id FROM loyalty_members WHERE id = auth.uid()::uuid)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "loyalty_transactions_insert" ON loyalty_transactions
    FOR INSERT WITH CHECK (
      auth.uid()::uuid IN (
        SELECT user_id FROM business_admins WHERE site_id = loyalty_transactions.site_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```