-- Add parent-child rental relationship system
-- Allows vacation rentals/condos to have multiple units from different companies

ALTER TABLE entity ADD COLUMN IF NOT EXISTS parent_entity_id UUID REFERENCES entity(id) ON DELETE SET NULL;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS bedrooms INT;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS bathrooms INT;
ALTER TABLE entity ADD COLUMN IF NOT EXISTS rental_company VARCHAR(255);

-- Index for parent lookups
CREATE INDEX IF NOT EXISTS idx_entity_parent ON entity(parent_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_bedrooms ON entity(bedrooms);
CREATE INDEX IF NOT EXISTS idx_entity_bathrooms ON entity(bathrooms);
CREATE INDEX IF NOT EXISTS idx_entity_rental_company ON entity(rental_company);

-- Allow querying children efficiently
CREATE INDEX IF NOT EXISTS idx_entity_parent_active ON entity(parent_entity_id, is_active) WHERE is_active = true;
