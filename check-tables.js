const { createClient } = require('@supabase/supabase-js');

const gcrUrl = 'https://adpnhipmdefutkzzltbs.supabase.co';
const gcrKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG5oaXBtZGVmdXRrenpsdGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg2MDA3NCwiZXhwIjoyMDkwNDM2MDc0fQ.qxMRoAuU22Kd6NyVXZsK4iSFFi-_20BUuN5yQfr7oUY';

const gcrDb = createClient(gcrUrl, gcrKey);

const tables = [
  'entity',
  'entity_tags',
  'entity_features',
  'entity_photos',
  'entity_hours',
  'entity_sections',
  'section_rich_text',
  'happy_hour_sections',
  'happy_hour_items',
  'entity_specials',
  'entity_events',
  'menu_items',
  'menu_categories',
  'businesses',
  'site_content'
];

(async () => {
  console.log('Checking which tables exist in GCR Supabase:\n');
  for (const table of tables) {
    try {
      const { count, error } = await gcrDb
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1);
      
      if (error) {
        if (error.message.includes('not found')) {
          console.log(`  ✗ ${table}`);
        } else {
          console.log(`  ? ${table} (error: ${error.message.split('\n')[0]})`);
        }
      } else {
        console.log(`  ✓ ${table} (${count} rows)`);
      }
    } catch (e) {
      console.log(`  ? ${table} (${e.message.split('\n')[0]})`);
    }
  }
})();
