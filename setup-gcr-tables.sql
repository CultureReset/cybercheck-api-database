-- MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS gcr_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  section VARCHAR(100),
  dietary_tags JSONB DEFAULT '[]',
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gcr_menu_items_entity ON gcr_menu_items(entity_id);

-- HAPPY HOURS TABLE
CREATE TABLE IF NOT EXISTS gcr_happy_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  day_of_week VARCHAR(10) NOT NULL,
  start_time TIME,
  end_time TIME,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gcr_happy_hours_entity ON gcr_happy_hours(entity_id);

-- HAPPY HOUR ITEMS TABLE (drinks, food, etc)
CREATE TABLE IF NOT EXISTS gcr_happy_hour_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  happy_hour_id UUID NOT NULL REFERENCES gcr_happy_hours(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  category VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gcr_happy_hour_items_hh ON gcr_happy_hour_items(happy_hour_id);
