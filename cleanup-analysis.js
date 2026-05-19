require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    console.log('=== CLEANUP ANALYSIS ===\n');

    // Check specials with missing price/discount
    const { data: specials } = await gcrDb
      .from('entity_specials')
      .select('id, title, price, discount, is_active');

    const withPrice = specials.filter(s => s.price || s.discount).length;
    const withoutPrice = specials.filter(s => !s.price && !s.discount).length;

    console.log('SPECIALS:');
    console.log(`  Total: ${specials.length}`);
    console.log(`  With price/discount: ${withPrice}`);
    console.log(`  Missing price/discount: ${withoutPrice}`);

    // Check which tables are empty
    const tables = [
      'happy_hour_items',
      'happy_hour_sections',
      'menu_sub_sections',
      'drink_items_old',
      'menu_items_old'
    ];

    console.log('\nEMPTY TABLES:');
    for (const table of tables) {
      try {
        const { count } = await gcrDb
          .from(table)
          .select('id', { count: 'exact' });
        console.log(`  ${table}: ${count || 0} records`);
      } catch (e) {
        // Table doesn't exist
      }
    }

    // Check key tables with data
    console.log('\nKEY DATA TABLES:');
    const keyTables = [
      'entity_happy_hours',
      'entity_specials',
      'entity_events',
      'menu_items',
      'drink_items',
      'section_items'
    ];

    for (const table of keyTables) {
      const { count } = await gcrDb
        .from(table)
        .select('id', { count: 'exact' });
      console.log(`  ${table}: ${count} records`);
    }

  } catch (e) {
    console.error('Error:', e.message);
  }
})();
