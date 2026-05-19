require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function findOrphans() {
  const db = getGcrDb();
  
  // Get all section_ids from items
  const { data: allItems } = await db.from('section_items').select('section_id');
  const itemSectionIds = new Set(allItems?.map(i => i.section_id) || []);
  
  // Get all valid section ids
  const { data: allSections } = await db.from('entity_sections').select('id');
  const validSectionIds = new Set(allSections?.map(s => s.id) || []);
  
  // Find orphaned
  const orphanedIds = [...itemSectionIds].filter(id => !validSectionIds.has(id));
  
  console.log(`🚨 Found ${orphanedIds.length} orphaned section IDs\n`);
  console.log('Sample orphaned section IDs:');
  orphanedIds.slice(0, 10).forEach(id => console.log(`   ${id}`));
  
  if (orphanedIds.length > 10) {
    console.log(`   ... and ${orphanedIds.length - 10} more`);
  }
  
  // Count items per orphaned section
  console.log(`\n📦 Items in orphaned sections:`);
  let totalOrphanedItems = 0;
  const orphanCounts = {};
  for (const id of orphanedIds.slice(0, 20)) {
    const { count } = await db.from('section_items').select('id', { count: 'exact' }).eq('section_id', id);
    orphanCounts[id] = count || 0;
    totalOrphanedItems += count || 0;
  }
  
  Object.entries(orphanCounts)
    .sort((a,b) => b[1] - a[1])
    .forEach(([id, count]) => {
      console.log(`   ${id}: ${count} items`);
    });
  
  console.log(`\n⚠️  Total orphaned items: ${totalOrphanedItems} (estimated: ${orphanedIds.length * (totalOrphanedItems / 20)})`);
}

findOrphans().catch(console.error);
