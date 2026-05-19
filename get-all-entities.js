require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    console.log('Fetching all entities...');
    
    let allEntities = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await gcrDb
        .from('entity')
        .select('id')
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error('Error:', error);
        break;
      }

      if (data.length === 0) break;
      allEntities = allEntities.concat(data);
      console.log(`  Fetched ${allEntities.length} total...`);
      offset += pageSize;
    }

    console.log(`\n✓ Total entities: ${allEntities.length}`);

    // Now check for orphaned sections
    const validIds = new Set(allEntities.map(e => e.id));
    const { data: allSections } = await gcrDb.from('entity_sections').select('id, entity_id');

    const orphaned = allSections.filter(s => !validIds.has(s.entity_id));
    console.log(`✓ Orphaned sections: ${orphaned.length}`);

    if (orphaned.length > 0) {
      console.log('\nOrphaned by type:');
      const { data: sectionDetails } = await gcrDb
        .from('entity_sections')
        .select('id, entity_id, section_type')
        .in('id', orphaned.map(s => s.id));

      const byType = {};
      sectionDetails.forEach(s => {
        byType[s.section_type] = (byType[s.section_type] || 0) + 1;
      });

      Object.entries(byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }
  } catch (e) {
    console.error('Unexpected error:', e.message);
  }
})();
