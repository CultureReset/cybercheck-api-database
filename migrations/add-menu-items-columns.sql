-- Add missing columns to menu_items for AI extraction output
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(50) DEFAULT 'food';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS modifiers JSONB DEFAULT '[]';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS photo_url TEXT;
