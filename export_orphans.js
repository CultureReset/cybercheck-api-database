require('dotenv').config();
const getGcrDb = require('./gcr-db');
const fs = require('fs');

async function exportOrphans() {
  const db = getGcrDb();
  
  console.log(`📥 Exporting orphaned items...\n`);
  
  // Get all section_ids from items
  const { data: allItems } = await db.from('section_items').select('section_id');
  const itemSectionIds = new Set(allItems?.map(i => i.section_id) || []);
  
  // Get all valid section ids
  const { data: allSections } = await db.from('entity_sections').select('id');
  const validSectionIds = new Set(allSections?.map(s => s.id) || []);
  
  // Find orphaned
  const orphanedIds = [...itemSectionIds].filter(id => !validSectionIds.has(id));
  
  console.log(`Found ${orphanedIds.length} orphaned section IDs`);
  
  // Get ALL orphaned items
  const { data: orphanItems } = await db
    .from('section_items')
    .select('*')
    .in('section_id', orphanedIds)
    .order('section_id');
  
  console.log(`Found ${orphanItems?.length} orphaned items\n`);
  
  // Also get orphaned bullets
  const { data: orphanBullets } = await db
    .from('section_bullets')
    .select('*')
    .in('section_id', orphanedIds)
    .order('section_id');
  
  console.log(`Found ${orphanBullets?.length} orphaned bullets\n`);
  
  // Export to file
  const exportData = {
    timestamp: new Date().toISOString(),
    summary: {
      orphaned_section_ids: orphanedIds.length,
      orphaned_items: orphanItems?.length || 0,
      orphaned_bullets: orphanBullets?.length || 0,
      total_orphaned_records: (orphanItems?.length || 0) + (orphanBullets?.length || 0)
    },
    orphaned_section_ids: orphanedIds,
    items: orphanItems || [],
    bullets: orphanBullets || []
  };
  
  const filename = 'ORPHANED-ITEMS-BACKUP.json';
  fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
  
  console.log(`✅ Exported to ${filename}`);
  console.log(`\nFile contains:`);
  console.log(`  • ${orphanedIds.length} orphaned section IDs`);
  console.log(`  • ${orphanItems?.length || 0} orphaned items (menu/products)`);
  console.log(`  • ${orphanBullets?.length || 0} orphaned bullets`);
}

exportOrphans().catch(console.error);
