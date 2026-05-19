require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function checkContent() {
  const db = getGcrDb();
  
  // Get all section_ids from items
  const { data: allItems } = await db.from('section_items').select('section_id');
  const itemSectionIds = new Set(allItems?.map(i => i.section_id) || []);
  
  // Get all valid section ids
  const { data: allSections } = await db.from('entity_sections').select('id');
  const validSectionIds = new Set(allSections?.map(s => s.id) || []);
  
  // Find orphaned
  const orphanedIds = [...itemSectionIds].filter(id => !validSectionIds.has(id));
  
  console.log(`📋 WHAT ARE THE ORPHANED ITEMS?\n`);
  console.log(`Sample of actual items in orphaned sections:\n`);
  
  // Get sample items from orphaned sections
  const { data: sampleItems } = await db
    .from('section_items')
    .select('id, item_name, item_description, price_text, section_id')
    .in('section_id', orphanedIds.slice(0, 5))
    .limit(20);
  
  sampleItems?.forEach((item, idx) => {
    console.log(`${idx + 1}. "${item.item_name}"`);
    if (item.item_description) console.log(`   Description: ${item.item_description.substring(0, 60)}...`);
    if (item.price_text) console.log(`   Price: ${item.price_text}`);
    console.log(`   Section ID: ${item.section_id.substring(0, 8)}...`);
    console.log();
  });
  
  console.log(`\n📊 Summary of orphaned items:`);
  const { data: orphanItems } = await db
    .from('section_items')
    .select('item_name')
    .in('section_id', orphanedIds);
  
  console.log(`Total: ${orphanItems?.length || 0} items`);
  console.log(`\nThey are MENU/PRODUCT ITEMS that were uploaded to sections that no longer exist.`);
  console.log(`They can't display because their parent sections are gone.`);
}

checkContent().catch(console.error);
