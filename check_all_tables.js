require('dotenv').config();
const getGcrDb = require('./gcr-db');

const tables = [
  'menu_items', 'menu_sections', 'drink_items', 'drink_sections',
  'happy_hour_items', 'happy_hour_sections',
  'section_items', 'section_rich_text', 'section_photos', 'section_bullets',
  'entity_specials', 'entity_events', 'entity_sections'
];

async function checkTables() {
  const db = getGcrDb();
  
  for (const table of tables) {
    try {
      const { count, error } = await db
        .from(table)
        .select('id', { count: 'exact' })
        .limit(1);
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: ${count || 0} rows`);
      }
    } catch (e) {
      console.log(`⚠️  ${table}: ${e.message}`);
    }
  }
}

checkTables().catch(console.error);
