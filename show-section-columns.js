require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get one item from section_items to see all columns
    const { data: items } = await gcrDb
      .from('section_items')
      .select('*')
      .limit(1);

    if (!items || items.length === 0) {
      console.log('No items found');
      process.exit(0);
    }

    const item = items[0];
    console.log('\n=== SECTION_ITEMS COLUMNS ===\n');
    
    Object.keys(item).forEach(key => {
      const val = item[key];
      const type = typeof val;
      const display = val === null ? 'NULL' : 
                     typeof val === 'string' && val.length > 80 ? val.substring(0, 80) + '...' :
                     val;
      console.log(`${key}: ${display}`);
    });

    // Get section info too
    const { data: section } = await gcrDb
      .from('entity_sections')
      .select('*')
      .limit(1)
      .single();

    console.log('\n=== ENTITY_SECTIONS COLUMNS ===\n');
    Object.keys(section).forEach(key => {
      const val = section[key];
      const display = val === null ? 'NULL' : 
                     typeof val === 'string' && val.length > 80 ? val.substring(0, 80) + '...' :
                     val;
      console.log(`${key}: ${display}`);
    });

  } catch (e) {
    console.error('Error:', e.message);
  }
})();
