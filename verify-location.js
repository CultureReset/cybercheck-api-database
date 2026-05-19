require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    const testIds = [
      'a44e10e7-cb29-4b86-a16d-c7646a48d00f',
      '7bad78a4-23d6-45c1-8eb9-d634c659c269'
    ];

    console.log('Checking if these entity IDs exist...\n');
    
    for (const id of testIds) {
      const { data, count } = await gcrDb
        .from('entity')
        .select('id, name', { count: 'exact' })
        .eq('id', id);
      
      console.log(`ID: ${id}`);
      console.log(`  Found: ${data.length > 0 ? 'YES - ' + data[0].name : 'NO'}`);
    }

    // Also check if the location sections reference valid entities
    console.log('\n--- Checking all location sections ---');
    const { data: validEntities } = await gcrDb.from('entity').select('id');
    const validIds = validEntities.map(e => e.id);
    
    const { data: allSections } = await gcrDb
      .from('entity_sections')
      .select('id, entity_id, section_type');

    const locationSects = allSections.filter(s => s.section_type === 'location');
    const orphanedLocs = locationSects.filter(s => !validIds.includes(s.entity_id));
    
    console.log(`Total location sections: ${locationSects.length}`);
    console.log(`Orphaned location sections: ${orphanedLocs.length}`);
    console.log(`Valid location sections: ${locationSects.length - orphanedLocs.length}`);
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
