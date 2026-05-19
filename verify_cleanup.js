require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function verify() {
  const db = getGcrDb();
  
  // Get all section_ids from items
  const { data: allItems } = await db.from('section_items').select('section_id');
  const itemSectionIds = new Set(allItems?.map(i => i.section_id) || []);
  
  // Get all valid section ids
  const { data: allSections } = await db.from('entity_sections').select('id');
  const validSectionIds = new Set(allSections?.map(s => s.id) || []);
  
  // Find orphaned
  const orphanedIds = [...itemSectionIds].filter(id => !validSectionIds.has(id));
  
  console.log(`✅ VERIFICATION:\n`);
  console.log(`Remaining orphaned section IDs: ${orphanedIds.length}`);
  
  if (orphanedIds.length === 0) {
    console.log(`✅ ALL ORPHANED ITEMS DELETED!`);
  } else {
    console.log(`⚠️  Still have ${orphanedIds.length} orphaned sections`);
    
    // Check how many items are still orphaned
    const { data: remainingItems } = await db
      .from('section_items')
      .select('id')
      .in('section_id', orphanedIds);
    
    console.log(`⚠️  Still have ${remainingItems?.length} orphaned items`);
  }
}

verify().catch(console.error);
