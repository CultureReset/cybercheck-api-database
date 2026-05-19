require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    // Get valid entity IDs
    const { data: validEntities } = await gcrDb.from('entity').select('id');
    const validIds = validEntities.map(e => e.id);

    // Get all sections
    const { data: allSections } = await gcrDb
      .from('entity_sections')
      .select('*');

    const orphanedSections = allSections.filter(s => !validIds.includes(s.entity_id));
    
    console.log('\n=== ORPHANED SECTIONS ===');
    console.log(`Total: ${orphanedSections.length}\n`);
    
    if (orphanedSections.length === 0) {
      console.log('✓ No orphaned sections found!');
      process.exit(0);
    }

    // Group by section_type
    const byType = {};
    orphanedSections.forEach(s => {
      if (!byType[s.section_type]) byType[s.section_type] = [];
      byType[s.section_type].push(s);
    });

    Object.entries(byType).forEach(([type, sections]) => {
      console.log(`${type}: ${sections.length}`);
    });

    // Check section_items
    const orphanIds = orphanedSections.map(s => s.id);
    const { data: allItems } = await gcrDb
      .from('section_items')
      .select('*');

    const orphanItems = allItems.filter(item => orphanIds.includes(item.section_id));
    
    console.log(`\nOrphaned section_items: ${orphanItems.length}`);
    console.log('\nSample orphaned items:');
    orphanItems.slice(0, 10).forEach(item => {
      console.log(`  - title: "${item.title || 'no title'}"`);
      console.log(`    content: "${item.content?.substring(0, 60) || 'none'}"`);
    });

  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
