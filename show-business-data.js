require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get a business with data
    const { data: biz } = await gcrDb
      .from('entity')
      .select('id, slug, name')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!biz) {
      console.log('No businesses found');
      process.exit(0);
    }

    console.log(`\n=== BUSINESS: ${biz.name} (${biz.slug}) ===\n`);

    const eid = biz.id;

    // Check all possible data sources
    const checks = [
      { table: 'entity_sections', filter: { entity_id: eid } },
      { table: 'section_items', filter: { section_id: null }, note: 'Will check by section_id' },
      { table: 'entity_happy_hours', filter: { entity_id: eid } },
      { table: 'entity_specials', filter: { entity_id: eid } },
      { table: 'entity_events', filter: { entity_id: eid } },
      { table: 'menu_sections', filter: { entity_id: eid } },
      { table: 'menu_items', filter: { entity_id: eid } },
      { table: 'drink_sections', filter: { entity_id: eid } },
      { table: 'drink_items', filter: { entity_id: eid } },
      { table: 'happy_hour_sections', filter: { entity_id: eid } },
      { table: 'happy_hour_items', filter: { entity_id: null }, note: 'Empty table' },
    ];

    for (const check of checks) {
      let query = gcrDb.from(check.table).select('*', { count: 'exact' });
      
      for (const [key, val] of Object.entries(check.filter)) {
        if (val !== null) query = query.eq(key, val);
      }

      const { count, data, error } = await query.limit(2);
      
      if (error) {
        console.log(`${check.table}: ❌ ERROR - ${error.message}`);
        continue;
      }

      console.log(`${check.table}: ${count} records${check.note ? ` (${check.note})` : ''}`);
      if (data && data.length > 0) {
        console.log(`  Sample:`, JSON.stringify(data[0]).substring(0, 120) + '...');
      }
    }

    // Now check section_items for this business's sections
    const { data: sections } = await gcrDb
      .from('entity_sections')
      .select('id, section_type')
      .eq('entity_id', eid);

    if (sections && sections.length > 0) {
      const sectionIds = sections.map(s => s.id);
      const { data: items, count } = await gcrDb
        .from('section_items')
        .select('*', { count: 'exact' })
        .in('section_id', sectionIds);

      console.log(`\nsection_items for this business's sections: ${count} records`);
      if (items && items.length > 0) {
        console.log(`  Sample:`, JSON.stringify(items[0]).substring(0, 120) + '...');
      }
    }

  } catch (e) {
    console.error('Error:', e.message);
  }
})();
