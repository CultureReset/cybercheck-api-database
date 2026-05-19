require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    console.log('Checking happy hour tables...\n');

    // Check happy_hour_sections
    const { data: hhSections, count: hhSecCount } = await gcrDb
      .from('happy_hour_sections')
      .select('*', { count: 'exact' })
      .limit(1);
    console.log(`happy_hour_sections: ${hhSecCount} records`);

    // Check happy_hour_items
    const { data: hhItems, count: hhItemCount } = await gcrDb
      .from('happy_hour_items')
      .select('*', { count: 'exact' })
      .limit(1);
    console.log(`happy_hour_items: ${hhItemCount} records`);

    // Check entity_happy_hours
    const { data: entityHH, count: entityHHCount } = await gcrDb
      .from('entity_happy_hours')
      .select('*', { count: 'exact' })
      .limit(1);
    console.log(`entity_happy_hours: ${entityHHCount} records`);
    if (entityHH?.length) {
      console.log('  Columns:', Object.keys(entityHH[0]));
      console.log('  Sample:', entityHH[0]);
    }

    // Check entity for hh fields
    const { data: entWithHH } = await gcrDb
      .from('entity')
      .select('id, slug, hh_days, hh_start, hh_end, hh_description')
      .not('hh_days', 'is', null)
      .limit(3);
    console.log(`\nentity with hh_days: ${entWithHH?.length} records`);
    if (entWithHH?.length) {
      entWithHH.forEach(e => {
        console.log(`  ${e.slug}: ${e.hh_days} ${e.hh_start}-${e.hh_end}`);
      });
    }

  } catch (e) {
    console.error('Error:', e.message);
  }
})();
