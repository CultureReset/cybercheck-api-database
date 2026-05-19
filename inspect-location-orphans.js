require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    const { data: validEntities } = await gcrDb.from('entity').select('id');
    const validIds = validEntities.map(e => e.id);

    const { data: allSections } = await gcrDb
      .from('entity_sections')
      .select('id, entity_id, section_type');

    const orphanedLocs = allSections.filter(s => s.section_type === 'location' && !validIds.includes(s.entity_id));
    
    console.log('Orphaned location sections:', orphanedLocs.length);
    console.log('\nSample orphaned location section entity_ids:');
    
    // Get unique entity IDs
    const uniqueIds = [...new Set(orphanedLocs.map(s => s.entity_id))];
    uniqueIds.slice(0, 10).forEach(id => {
      console.log(`  - ${id}`);
    });
    
    // Check if these entity IDs exist
    if (uniqueIds.length > 0) {
      const { data: foundEntities } = await gcrDb
        .from('entity')
        .select('id')
        .in('id', uniqueIds.slice(0, 5));
      
      console.log('\nChecking first 5 entity IDs in entity table...');
      console.log('Found:', foundEntities.length);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
