require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    const { data: validEntities } = await gcrDb.from('entity').select('id');
    const validIds = new Set(validEntities.map(e => e.id));
    
    const { data: allSections } = await gcrDb
      .from('entity_sections')
      .select('id, entity_id');

    const orphaned = allSections.filter(s => !validIds.has(s.entity_id));
    const orphanEntityIds = [...new Set(orphaned.map(s => s.entity_id))];

    console.log(`93 orphaned location sections reference ${orphanEntityIds.length} non-existent entities`);
    console.log('\nOrphaned entity IDs:');
    orphanEntityIds.forEach(id => {
      const count = orphaned.filter(s => s.entity_id === id).length;
      console.log(`  ${id} (${count} sections)`);
    });
    
    // Save to file
    fs.writeFileSync('orphaned-entity-ids.json', JSON.stringify(orphanEntityIds, null, 2));
    console.log('\n✓ Saved to orphaned-entity-ids.json');
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
