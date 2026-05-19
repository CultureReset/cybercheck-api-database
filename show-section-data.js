require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get a business with sections
    const { data: biz } = await gcrDb
      .from('entity')
      .select('id, slug, name')
      .eq('is_active', true)
      .limit(1)
      .single();

    const eid = biz.id;
    console.log(`\n=== BUSINESS: ${biz.name} ===\n`);

    // Get all sections for this business
    const { data: sections } = await gcrDb
      .from('entity_sections')
      .select('id, section_type, section_label, sort_order')
      .eq('entity_id', eid)
      .order('sort_order');

    console.log(`SECTIONS (${sections.length} total):\n`);

    for (const section of sections) {
      console.log(`\n━━━ ${section.section_type.toUpperCase()} ━━━`);
      console.log(`Label: ${section.section_label}`);

      // Get items in this section
      const { data: items, count } = await gcrDb
        .from('section_items')
        .select('*', { count: 'exact' })
        .eq('section_id', section.id)
        .order('sort_order')
        .limit(2);

      console.log(`Items: ${count}`);

      if (items && items.length > 0) {
        const item = items[0];
        console.log(`\nSample item columns:`);
        Object.keys(item).forEach(key => {
          const val = item[key];
          if (val !== null && val !== undefined) {
            const display = typeof val === 'string' && val.length > 60 
              ? val.substring(0, 60) + '...' 
              : val;
            console.log(`  ${key}: ${display}`);
          }
        });
      }
    }

  } catch (e) {
    console.error('Error:', e.message);
  }
})();
