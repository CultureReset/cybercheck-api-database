-- GCR Site Editor Tables
-- Run in your GCR Supabase instance (SQL Editor)

-- Homepage/site configuration (hero section, quick tags, etc.)
CREATE TABLE IF NOT EXISTS site_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category card configuration (the 11 home page tiles)
CREATE TABLE IF NOT EXISTS category_config (
  category_id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(100),
  description TEXT,
  emoji VARCHAR(20),
  image_url TEXT,
  color_gradient TEXT,
  display_order INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Category page header configuration (title, description, hero image per page)
CREATE TABLE IF NOT EXISTS category_page_config (
  category_id VARCHAR(50) PRIMARY KEY,
  page_title TEXT,
  page_description TEXT,
  hero_image_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity → category page assignments (multi-page + featured ordering)
CREATE TABLE IF NOT EXISTS entity_page_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entity(id) ON DELETE CASCADE,
  category_id VARCHAR(50) NOT NULL,
  sort_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_epa_entity ON entity_page_assignments(entity_id);
CREATE INDEX IF NOT EXISTS idx_epa_category ON entity_page_assignments(category_id, sort_order);
