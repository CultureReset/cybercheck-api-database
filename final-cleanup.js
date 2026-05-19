require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get valid entity IDs
    const { data: validEntities } = await gcrDb.from('entity').select('id');
    const validIds = validEntities.map(e => e.id);

    // Get orphaned sections
    const { data: allSections } = await gcrDb.from('entity_sections').select('id, entity_id, section_type');
    const orphanIds = allSections.filter(s => !validIds.includes(s.entity_id)).map(s => s.id);

    console.log('Deleting', orphanIds.length, 'orphaned sections...');

    const { count, error } = await gcrDb
      .from('entity_sections')
      .delete()
      .in('id', orphanIds);

    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }

    console.log('✓ Deleted', count || orphanIds.length, 'orphaned sections');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
