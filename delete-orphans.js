require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get valid entities
    const { data: validEntities } = await gcrDb.from('entity').select('id');
    const validIds = validEntities.map(e => e.id);

    // Get orphaned section IDs
    const { data: allSections } = await gcrDb.from('entity_sections').select('id, entity_id');
    const orphanIds = allSections.filter(s => !validIds.includes(s.entity_id)).map(s => s.id);

    console.log('Deleting items from', orphanIds.length, 'orphaned sections...');

    // Delete items in batches
    const batchSize = 50;
    let totalDeleted = 0;

    for (let i = 0; i < orphanIds.length; i += batchSize) {
      const batch = orphanIds.slice(i, i + batchSize);
      const { count, error } = await gcrDb
        .from('section_items')
        .delete()
        .in('section_id', batch);

      if (error) {
        console.error('Error deleting batch:', error);
        continue;
      }
      console.log(`Batch ${i / batchSize + 1}: deleted ${count} items`);
      totalDeleted += count || 0;
    }

    console.log('Total items deleted:', totalDeleted);

    // Now delete the orphaned sections
    console.log('\nDeleting', orphanIds.length, 'orphaned sections...');
    const { count: sectionCount, error: sectError } = await gcrDb
      .from('entity_sections')
      .delete()
      .in('id', orphanIds);

    if (sectError) {
      console.error('Error deleting sections:', sectError);
      process.exit(1);
    }

    console.log('Deleted', sectionCount, 'orphaned sections');
    console.log('\n✓ Cleanup complete!');
  } catch (e) {
    console.error('Unexpected error:', e.message);
    process.exit(1);
  }
})();
