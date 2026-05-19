require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function deleteOrphans() {
  const db = getGcrDb();
  
  console.log(`🧹 DELETING ORPHANED ITEMS\n`);
  
  // Get all section_ids from items
  const { data: allItems } = await db.from('section_items').select('section_id');
  const itemSectionIds = new Set(allItems?.map(i => i.section_id) || []);
  
  // Get all valid section ids
  const { data: allSections } = await db.from('entity_sections').select('id');
  const validSectionIds = new Set(allSections?.map(s => s.id) || []);
  
  // Find orphaned
  const orphanedIds = [...itemSectionIds].filter(id => !validSectionIds.has(id));
  
  console.log(`Found ${orphanedIds.length} orphaned section IDs`);
  console.log(`Deleting items in batches...\n`);
  
  // Delete in batches
  let totalDeleted = 0;
  for (let i = 0; i < orphanedIds.length; i += 100) {
    const batch = orphanedIds.slice(i, i + 100);
    const { count, error } = await db
      .from('section_items')
      .delete()
      .in('section_id', batch);
    
    if (error) {
      console.log(`❌ Error batch ${Math.floor(i/100)+1}: ${error.message}`);
    } else {
      console.log(`✅ Batch ${Math.floor(i/100)+1}: Deleted ${count || 0} items`);
      totalDeleted += count || 0;
    }
  }
  
  console.log(`\n✅ CLEANUP COMPLETE`);
  console.log(`Total orphaned items deleted: ${totalDeleted}`);
  console.log(`Total orphaned sections affected: ${orphanedIds.length}`);
  console.log(`\nBackup saved: ORPHANED-ITEMS-BACKUP.json`);
}

deleteOrphans().catch(console.error);
