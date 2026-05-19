require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function matchOrphans() {
  const db = getGcrDb();
  
  console.log(`🔗 MATCHING ORPHANED ITEMS TO ENTITIES\n`);
  
  // Get all section_ids from items
  const { data: allItems } = await db.from('section_items').select('section_id');
  const itemSectionIds = new Set(allItems?.map(i => i.section_id) || []);
  
  // Get all valid section ids
  const { data: allSections } = await db.from('entity_sections').select('id');
  const validSectionIds = new Set(allSections?.map(s => s.id) || []);
  
  // Find orphaned
  const orphanedIds = [...itemSectionIds].filter(id => !validSectionIds.has(id));
  
  // Get unique item names from orphaned sections
  const { data: orphanItems } = await db
    .from('section_items')
    .select('item_name')
    .in('section_id', orphanedIds)
    .limit(50);
  
  console.log(`Sample item names from orphaned sections:`);
  orphanItems?.slice(0, 15).forEach(i => {
    console.log(`  • ${i.item_name}`);
  });
  
  // Try to match to entities by name patterns
  console.log(`\n🔍 Searching for matching entities...\n`);
  
  const keywords = ['Jack', 'Yuzu', 'Sweet Tea', 'Alabama'];
  
  for (const keyword of keywords) {
    const { data: entities } = await db
      .from('entity')
      .select('id, name, slug')
      .ilike('name', `%${keyword}%`)
      .limit(5);
    
    if (entities?.length) {
      console.log(`✅ Found "${keyword}":`);
      entities.forEach(e => {
        console.log(`   ${e.name} (${e.slug})`);
      });
    }
  }
  
  console.log(`\n⚠️  These items were probably uploaded without proper section/entity assignment.`);
  console.log(`They need to be either:`);
  console.log(`  1. Linked to the correct entity_sections`);
  console.log(`  2. Or deleted if they're duplicates`);
}

matchOrphans().catch(console.error);
