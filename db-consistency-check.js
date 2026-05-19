require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const gcrDb = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

(async () => {
  try {
    const { data: validEntities } = await gcrDb.from('entity').select('id');
    const validIds = new Set(validEntities.map(e => e.id));
    
    console.log('Total valid entities:', validIds.size);

    // Get ALL sections and check their validity
    const { data: allSections } = await gcrDb
      .from('entity_sections')
      .select('id, entity_id, section_type');

    const sections = {
      valid: [],
      orphaned: []
    };

    allSections.forEach(s => {
      if (validIds.has(s.entity_id)) {
        sections.valid.push(s);
      } else {
        sections.orphaned.push(s);
      }
    });

    console.log('\n=== FINAL STATUS ===');
    console.log(`Valid sections: ${sections.valid.length}`);
    console.log(`Orphaned sections: ${sections.orphaned.length}`);
    
    if (sections.orphaned.length > 0) {
      console.log('\nOrphaned by type:');
      const byType = {};
      sections.orphaned.forEach(s => {
        byType[s.section_type] = (byType[s.section_type] || 0) + 1;
      });
      Object.entries(byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
