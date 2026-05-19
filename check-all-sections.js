require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get all unique section types
    const { data: types } = await gcrDb
      .from('entity_sections')
      .select('section_type', { count: 'exact' })
      .order('section_type');

    const uniqueTypes = {};
    types.forEach(t => {
      uniqueTypes[t.section_type] = (uniqueTypes[t.section_type] || 0) + 1;
    });

    console.log('\n=== ALL SECTION TYPES IN DATABASE ===\n');
    Object.entries(uniqueTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`${type}: ${count} sections`);
    });

    // Get one example of EACH type
    console.log('\n=== EXAMPLE OF EACH TYPE ===\n');
    for (const [sectionType] of Object.entries(uniqueTypes).sort((a, b) => b[1] - a[1])) {
      const { data: example } = await gcrDb
        .from('entity_sections')
        .select('id, section_type, section_label, section_key')
        .eq('section_type', sectionType)
        .limit(1)
        .single();

      if (example) {
        console.log(`\n${sectionType.toUpperCase()}`);
        console.log(`  Label: ${example.section_label}`);
        
        // Get items in this section
        const { data: items, count } = await gcrDb
          .from('section_items')
          .select('*', { count: 'exact' })
          .eq('section_id', example.id);

        console.log(`  Items in this section: ${count}`);
        if (items && items.length > 0) {
          const item = items[0];
          console.log(`  Sample item columns: ${Object.keys(item).join(', ')}`);
          console.log(`  Sample data: ${JSON.stringify(item).substring(0, 150)}...`);
        }
      }
    }

  } catch (e) {
    console.error('Error:', e.message);
  }
})();
