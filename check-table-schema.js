require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get one happy_hour_item
    const { data: hhItem } = await gcrDb
      .from('happy_hour_items')
      .select('*')
      .limit(1)
      .single();

    console.log('=== HAPPY HOUR ITEM ===');
    console.log('Columns:', Object.keys(hhItem || {}));
    console.log('Sample:', hhItem);

    // Get one special
    const { data: special } = await gcrDb
      .from('entity_specials')
      .select('*')
      .limit(1)
      .single();

    console.log('\n=== ENTITY SPECIAL ===');
    console.log('Columns:', Object.keys(special || {}));
    console.log('Sample:', special);

  } catch (e) {
    console.error('Error:', e.message);
  }
})();
