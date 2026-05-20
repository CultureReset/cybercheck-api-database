-- Migration: Move old entity text fields to new dedicated tables
-- Purpose: Cosmos and other old businesses have hours/descriptions in entity table text fields
--          New schema uses dedicated tables (entity_hours, entity_about_bullets)
-- Target: All existing businesses that have data in old locations
-- Safety: Only inserts if data doesn't already exist in new tables (idempotent)

-- ==============================================================================
-- 1. Migrate hours_text → entity_hours (structured by day of week)
-- ==============================================================================
-- Parses "Monday: 11:00 AM – 9:30 PM" format into structured rows
INSERT INTO entity_hours (entity_id, day_of_week, open_time, close_time, is_closed)
SELECT
  id,
  CASE
    WHEN hours_text LIKE '%Monday%' THEN 'Monday'
    WHEN hours_text LIKE '%Tuesday%' THEN 'Tuesday'
    WHEN hours_text LIKE '%Wednesday%' THEN 'Wednesday'
    WHEN hours_text LIKE '%Thursday%' THEN 'Thursday'
    WHEN hours_text LIKE '%Friday%' THEN 'Friday'
    WHEN hours_text LIKE '%Saturday%' THEN 'Saturday'
    WHEN hours_text LIKE '%Sunday%' THEN 'Sunday'
  END as day_of_week,
  -- Extract open time (HH:MM before the dash)
  SUBSTRING_INDEX(SUBSTRING_INDEX(hours_text, ':', 2), ' ', -1) || ':' ||
  SUBSTRING_INDEX(SUBSTRING_INDEX(hours_text, ':', 3), ' ', -1),
  -- Extract close time (HH:MM after the dash)
  SUBSTRING_INDEX(SUBSTRING_INDEX(hours_text, '–', -1), ' ', 1) || ':' ||
  SUBSTRING_INDEX(SUBSTRING_INDEX(hours_text, '–', -1), ' ', 2),
  CASE WHEN hours_text LIKE '%Closed%' THEN true ELSE false END as is_closed
FROM entity
WHERE hours_text IS NOT NULL
  AND hours_text != ''
  AND NOT EXISTS (
    SELECT 1 FROM entity_hours eh
    WHERE eh.entity_id = entity.id
  )
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==============================================================================
-- 2. Migrate description → entity_about_bullets (about section content)
-- ==============================================================================
-- Moves entity.description into entity_about_bullets for structured display
INSERT INTO entity_about_bullets (entity_id, bullet_text, sort_order)
SELECT
  id,
  description,
  0 as sort_order
FROM entity
WHERE description IS NOT NULL
  AND description != ''
  AND NOT EXISTS (
    SELECT 1 FROM entity_about_bullets eab
    WHERE eab.entity_id = entity.id
  )
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- ==============================================================================
-- 3. NEW BUSINESSES: Automatically use new schema
-- ==============================================================================
-- Good news: All new API endpoints save directly to new tables:
--   - save_hours() → entity_hours
--   - save_about() → entity_about_bullets
--   - save_photos() → entity_photos
--   - save_tags() → entity_tags
--
-- So Shipp's Dockside and all future businesses will use the NEW schema automatically!
-- No action needed - the migration above handles existing businesses only.
