-- VERIFY ALL DATA IS CONNECTED TO BUSINESSES

-- 1. Check for orphaned sections (sections with no entity_id)
SELECT 'ORPHANED SECTIONS' as check_type, COUNT(*) as count
FROM entity_sections
WHERE entity_id IS NULL;

-- 2. Check for orphaned section items (items with no section_id)
SELECT 'ORPHANED SECTION ITEMS' as check_type, COUNT(*) as count
FROM section_items
WHERE section_id IS NULL;

-- 3. Check for orphaned events (events with no entity_id)
SELECT 'ORPHANED EVENTS' as check_type, COUNT(*) as count
FROM entity_events
WHERE entity_id IS NULL;

-- 4. Check for orphaned specials (specials with no entity_id)
SELECT 'ORPHANED SPECIALS' as check_type, COUNT(*) as count
FROM entity_specials
WHERE entity_id IS NULL;

-- 5. Summary of all connections
SELECT 'SECTION → ENTITY LINKS' as connection_type, COUNT(*) as count
FROM entity_sections
WHERE entity_id IS NOT NULL
UNION ALL
SELECT 'ITEMS → SECTION LINKS', COUNT(*)
FROM section_items
WHERE section_id IS NOT NULL
UNION ALL
SELECT 'EVENTS → ENTITY LINKS', COUNT(*)
FROM entity_events
WHERE entity_id IS NOT NULL
UNION ALL
SELECT 'SPECIALS → ENTITY LINKS', COUNT(*)
FROM entity_specials
WHERE entity_id IS NOT NULL
ORDER BY connection_type;
