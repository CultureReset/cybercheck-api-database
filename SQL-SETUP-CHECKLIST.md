# Complete SQL Setup Checklist

## Step 1: Create All Required Tables

Run this in Supabase SQL Editor:

```sql
-- All tables needed for complete business data system
-- See: GCR-DATABASE-SCHEMA.sql for full schema
```

**File to run:** `/Users/owner/cybercheck-api-database/GCR-DATABASE-SCHEMA.sql`

**In Supabase:**
1. Go to SQL Editor
2. Copy entire contents of GCR-DATABASE-SCHEMA.sql
3. Paste into SQL editor
4. Click "Execute"

---

## Step 2: Verify Tables Exist

Run these queries to confirm all tables are created:

```sql
-- Check core tables
SELECT COUNT(*) as total_tables FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verify entity table
SELECT * FROM entity LIMIT 1;

-- Verify entity_sections
SELECT * FROM entity_sections LIMIT 1;

-- Verify section_items
SELECT * FROM section_items LIMIT 1;

-- Verify menu tables (legacy)
SELECT COUNT(*) FROM menu_sections;
SELECT COUNT(*) FROM menu_items;
SELECT COUNT(*) FROM drink_sections;
SELECT COUNT(*) FROM drink_items;

-- Check happy hour tables
SELECT COUNT(*) FROM happy_hour_sections;
SELECT COUNT(*) FROM happy_hour_items;
SELECT COUNT(*) FROM entity_happy_hours;
```

---

## Step 3: Import Cosmos Restaurant Data (Already Done)

**Status:** ✅ Already imported

```bash
# Data already in database
node import-cosmos-menu.js  # Re-run if needed
```

**Verify:**
```sql
-- Check Cosmos exists
SELECT id, name, slug FROM entity WHERE slug = 'cosmos-restaurant-and-bar-orange-beach';

-- Check menu sections
SELECT COUNT(*) as section_count FROM entity_sections 
WHERE entity_id = (SELECT id FROM entity WHERE slug = 'cosmos-restaurant-and-bar-orange-beach');

-- Check menu items  
SELECT COUNT(*) as item_count FROM section_items
WHERE section_id IN (
  SELECT id FROM entity_sections 
  WHERE entity_id = (SELECT id FROM entity WHERE slug = 'cosmos-restaurant-and-bar-orange-beach')
);

-- Should show: 9 sections, 60 items
```

---

## Step 4: Set Happy Hour Times (Already Done)

**Status:** ✅ Already updated

```sql
-- Verify HH times are set
SELECT hh_days, hh_start, hh_end, hh_description 
FROM entity 
WHERE slug = 'cosmos-restaurant-and-bar-orange-beach';

-- Should show:
-- hh_days: Mon-Fri
-- hh_start: 16:00:00
-- hh_end: 18:00:00
```

---

## Step 5: Check Missing Data

Run these queries to identify what's NOT yet populated:

```sql
-- Businesses with NO photos
SELECT id, name, slug FROM entity 
WHERE id NOT IN (SELECT DISTINCT entity_id FROM entity_photos);

-- Businesses with NO events
SELECT id, name, slug FROM entity 
WHERE id NOT IN (SELECT DISTINCT entity_id FROM entity_events);

-- Businesses with NO happy hours
SELECT id, name, slug FROM entity 
WHERE hh_days IS NULL AND id NOT IN (SELECT DISTINCT entity_id FROM entity_happy_hours);

-- Businesses with NO menu
SELECT id, name, slug FROM entity
WHERE id NOT IN (SELECT DISTINCT entity_id FROM entity_sections WHERE section_type = 'menu');

-- Count total items by type
SELECT 'menu_sections' as type, COUNT(*) as count FROM menu_sections
UNION ALL
SELECT 'menu_items', COUNT(*) FROM menu_items
UNION ALL
SELECT 'drink_sections', COUNT(*) FROM drink_sections
UNION ALL
SELECT 'drink_items', COUNT(*) FROM drink_items
UNION ALL
SELECT 'entity_sections', COUNT(*) FROM entity_sections
UNION ALL
SELECT 'section_items', COUNT(*) FROM section_items
UNION ALL
SELECT 'entity_photos', COUNT(*) FROM entity_photos
UNION ALL
SELECT 'entity_events', COUNT(*) FROM entity_events
UNION ALL
SELECT 'entity_specials', COUNT(*) FROM entity_specials;
```

---

## Step 6: Add More Businesses

### Quick Add (Via SQL):
```sql
-- Insert new business
INSERT INTO entity (name, slug, entity_type, entity_subtype, city, state, phone, website_url, is_active)
VALUES (
  'New Restaurant',
  'new-restaurant-slug',
  'food_beverage',
  'Restaurant',
  'Orange Beach',
  'AL',
  '251-XXX-XXXX',
  'https://...',
  true
);

-- Get the entity ID
SELECT id FROM entity WHERE slug = 'new-restaurant-slug';

-- Add menu section
INSERT INTO entity_sections (entity_id, section_key, section_label, section_type, sort_order)
VALUES ('<entity-id>', 'appetizers', 'Appetizers', 'menu', 1);

-- Add menu items
INSERT INTO section_items (section_id, item_name, item_description, price_numeric, sort_order)
VALUES 
  ('<section-id>', 'Shrimp Appetizer', 'Fried shrimp with remoulade', 14.99, 1),
  ('<section-id>', 'Crab Dip', 'Creamy crab with pita chips', 12.99, 2);
```

### Better Way (Via Import Script):
```bash
node import-[restaurant-name].js
```

---

## Step 7: Verify Data Integrity

```sql
-- Check for orphaned section_items (items without section)
SELECT si.id, si.item_name FROM section_items si
WHERE si.section_id NOT IN (SELECT id FROM entity_sections);

-- Check for orphaned menu_items (items without section)
SELECT mi.id, mi.item_name FROM menu_items mi
WHERE mi.menu_section_id NOT IN (SELECT id FROM menu_sections);

-- Check for orphaned entity_sections (sections without entity)
SELECT es.id, es.section_label FROM entity_sections es
WHERE es.entity_id NOT IN (SELECT id FROM entity);

-- Find entities with incomplete data
SELECT 
  e.name,
  e.slug,
  CASE WHEN e.phone IS NULL THEN 'NO PHONE' ELSE '✓' END as phone,
  CASE WHEN e.address_line_1 IS NULL THEN 'NO ADDRESS' ELSE '✓' END as address,
  COALESCE((SELECT COUNT(*) FROM entity_sections WHERE entity_id = e.id), 0) as sections,
  COALESCE((SELECT COUNT(*) FROM entity_photos WHERE entity_id = e.id), 0) as photos,
  COALESCE((SELECT COUNT(*) FROM entity_events WHERE entity_id = e.id), 0) as events
FROM entity e
WHERE e.is_active = true
LIMIT 10;
```

---

## Step 8: Performance Indexes

Verify indexes exist:

```sql
-- List all indexes
SELECT tablename, indexname FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Should include indexes on:
-- - entity.slug
-- - entity.is_active
-- - entity.city
-- - entity_sections.entity_id
-- - section_items.section_id
-- - entity_photos.entity_id
-- - entity_events.entity_id
```

---

## Complete Data Audit Query

Run this to get a full status report:

```sql
SELECT 
  'Total Businesses' as metric,
  COUNT(DISTINCT e.id)::text as value
FROM entity e
WHERE e.is_active = true

UNION ALL

SELECT 'Businesses with Photos', COUNT(DISTINCT ep.entity_id)::text
FROM entity_photos ep

UNION ALL

SELECT 'Businesses with Events', COUNT(DISTINCT ee.entity_id)::text
FROM entity_events ee

UNION ALL

SELECT 'Businesses with Menu', COUNT(DISTINCT es.entity_id)::text
FROM entity_sections es
WHERE es.section_type = 'menu'

UNION ALL

SELECT 'Total Menu Items', COUNT(*)::text
FROM section_items si
WHERE si.section_id IN (SELECT id FROM entity_sections WHERE section_type = 'menu')

UNION ALL

SELECT 'Total Drink Items', COUNT(*)::text
FROM section_items si
WHERE si.section_id IN (SELECT id FROM entity_sections WHERE section_type = 'drinks')

UNION ALL

SELECT 'Total HH Items', COUNT(*)::text
FROM section_items si
WHERE si.section_id IN (SELECT id FROM entity_sections WHERE section_type = 'happy_hour');
```

---

## Quick SQL Summary

| Task | SQL Command |
|------|-----|
| Check all tables exist | `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';` |
| Count businesses | `SELECT COUNT(*) FROM entity WHERE is_active = true;` |
| Count menu items | `SELECT COUNT(*) FROM section_items;` |
| Find missing photos | `SELECT name FROM entity WHERE id NOT IN (SELECT DISTINCT entity_id FROM entity_photos);` |
| Find missing events | `SELECT name FROM entity WHERE id NOT IN (SELECT DISTINCT entity_id FROM entity_events);` |
| Check HH setup | `SELECT slug, hh_days, hh_start, hh_end FROM entity WHERE hh_days IS NOT NULL;` |

---

## What You Currently Have

```
✅ entity table                    — 1+ businesses
✅ entity_sections table           — 9 sections (Cosmos)
✅ section_items table             — 60 items (Cosmos menu/drinks)
✅ entity_photos table             — 0 photos (need to add)
✅ entity_events table             — 0 events (need to add)
✅ entity_specials table           — 0 specials (need to add)
✅ entity_hours table              — Can add hours
✅ entity_tags table               — Can add tags
✅ All menu/drinks/HH tables       — Ready for data
```

---

## Next Steps

1. **Run the schema SQL file** (if not already done)
2. **Verify tables exist** (use queries above)
3. **Add more businesses** (use import scripts or SQL)
4. **Populate photos, events, specials** (as needed)
5. **Monitor data integrity** (use audit queries monthly)

---

## Support

If tables are missing:
```bash
# Re-run schema creation
psql -U postgres -d postgres -f GCR-DATABASE-SCHEMA.sql
```

If you need to reset a business:
```sql
DELETE FROM entity WHERE slug = 'old-business-slug';
-- All child records cascade delete automatically
```

**All tables have CASCADE delete, so removing an entity removes all related data automatically.**
