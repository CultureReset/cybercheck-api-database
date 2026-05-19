require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function checkLinked() {
  const db = getGcrDb();
  
  console.log('🔗 DATA LINKAGE CHECK\n');
  
  // Get sections with items
  const { data: sectionsWithItems } = await db
    .from('section_items')
    .select('section_id')
    .then(async (r) => {
      const sectionIds = [...new Set((r.data || []).map(x => x.section_id))];
      console.log(`📌 Sections with items: ${sectionIds.length}`);
      
      // Get those sections and their entities
      const { data: sections } = await db
        .from('entity_sections')
        .select('id, entity_id, section_label, section_type')
        .in('id', sectionIds)
        .limit(10);
      
      console.log(`\n🔍 Sample sections with items:`);
      sections?.forEach(s => {
        console.log(`   ${s.section_label} (${s.section_type}) → entity: ${s.entity_id?.substring(0, 8)}...`);
      });
      
      // Count items per section
      const { data: itemCounts } = await db
        .from('section_items')
        .select('section_id')
        .in('section_id', sectionIds);
      
      const counts = {};
      itemCounts?.forEach(i => {
        counts[i.section_id] = (counts[i.section_id] || 0) + 1;
      });
      
      console.log(`\n📦 Items per section (top 10):`);
      Object.entries(counts)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([secId, count]) => {
          console.log(`   Section ${secId.substring(0, 8)}...: ${count} items`);
        });
      
      return r;
    });
  
  // Check if items are orphaned (section doesn't exist)
  const { data: allItems } = await db.from('section_items').select('section_id');
  const validSectionIds = new Set();
  const { data: allSections } = await db.from('entity_sections').select('id');
  allSections?.forEach(s => validSectionIds.add(s.id));
  
  const orphanedItems = allItems?.filter(i => !validSectionIds.has(i.section_id)).length || 0;
  console.log(`\n⚠️  Orphaned items (section doesn't exist): ${orphanedItems}`);
  
  // Check entities - do they have at least one section?
  const { data: entityIds } = await db.from('entity').select('id').eq('is_active', true).limit(5);
  console.log(`\n🏢 Sample entities (first 5):`);
  for (const e of entityIds || []) {
    const { count: secs } = await db.from('entity_sections').select('id', { count: 'exact' }).eq('entity_id', e.id);
    const { count: items } = await db.from('section_items').select('id', { count: 'exact' }).in('section_id', 
      (await db.from('entity_sections').select('id').eq('entity_id', e.id)).data?.map(s => s.id) || []
    );
    console.log(`   Entity ${e.id.substring(0, 8)}...: ${secs} sections, ${items} items`);
  }
}

checkLinked().catch(console.error);
