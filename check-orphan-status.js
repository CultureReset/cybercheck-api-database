require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get all valid entity IDs
    const { data: validEntities, error: entityErr } = await gcrDb
      .from('entity')
      .select('id');

    if (entityErr) {
      console.error('Error fetching entities:', entityErr);
      process.exit(1);
    }

    const validIds = validEntities.map(e => e.id);
    console.log('Found', validIds.length, 'valid entities');

    // Get sections that reference invalid entities
    const { data: allSections } = await gcrDb
      .from('entity_sections')
      .select('id, entity_id');

    const orphanedSections = allSections.filter(s => !validIds.includes(s.entity_id));
    console.log('Found', orphanedSections.length, 'orphaned sections');
    
    if (orphanedSections.length === 0) {
      console.log('✓ No orphaned sections found - deletion worked!');
      process.exit(0);
    }

    const orphanIds = orphanedSections.map(s => s.id);
    console.log('Sample IDs:', orphanIds.slice(0, 5));

    // Count items in these sections
    const { data: allItems } = await gcrDb.from('section_items').select('id, section_id');
    const orphanItems = allItems.filter(item => orphanIds.includes(item.section_id));
    console.log('Items in orphaned sections:', orphanItems.length);
    
    if (orphanItems.length > 0) {
      console.log('Sample items:', orphanItems.slice(0, 3));
    }
  } catch (e) {
    console.error('Unexpected error:', e.message);
    process.exit(1);
  }
})();
