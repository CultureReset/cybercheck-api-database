require('dotenv').config();
const getGcrDb = require('./gcr-db');

async function auditData() {
  const db = getGcrDb();
  
  console.log('📊 GCR DATA AUDIT\n');
  
  // 1. Total entities
  const { count: entityCount } = await db.from('entity').select('id', { count: 'exact' }).eq('is_active', true);
  console.log(`✅ Total Active Entities: ${entityCount}`);
  
  // 2. Entities with sections
  const { data: entitiesWithSections } = await db
    .from('entity_sections')
    .select('entity_id', { count: 'exact' })
    .then(r => db.from('entity_sections').select('entity_id').then(res => ({
      count: new Set(res.data?.map(x => x.entity_id)).size
    })));
  const { data: entWithSec } = await db.from('entity_sections').select('distinct entity_id');
  console.log(`✅ Entities WITH sections: ${entWithSec?.length || 0}`);
  
  // 3. Sections
  const { count: sectionCount } = await db.from('entity_sections').select('id', { count: 'exact' });
  console.log(`✅ Total sections: ${sectionCount}`);
  
  // 4. Section items
  const { count: itemCount } = await db.from('section_items').select('id', { count: 'exact' });
  console.log(`✅ Total section_items: ${itemCount}`);
  
  // 5. Items by section (are they linked?)
  const { data: itemsPerSection } = await db.from('section_items').select('section_id');
  const linkedSections = new Set(itemsPerSection?.map(x => x.section_id) || []);
  console.log(`✅ Sections WITH items: ${linkedSections.size}`);
  
  // 6. Orphaned sections (no items, no other content)
  const { data: allSections } = await db.from('entity_sections').select('id');
  const orphaned = allSections?.filter(s => !linkedSections.has(s.id)).length || 0;
  console.log(`⚠️  Orphaned empty sections: ${orphaned}`);
  
  // 7. Menu-type sections breakdown
  const { data: sectionTypes } = await db.from('entity_sections').select('section_type');
  const typeCount = {};
  sectionTypes?.forEach(s => {
    typeCount[s.section_type] = (typeCount[s.section_type] || 0) + 1;
  });
  console.log(`\n📋 Section Types:`);
  Object.entries(typeCount).sort((a,b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });
  
  // 8. Check specials & events
  const { count: specialCount } = await db.from('entity_specials').select('id', { count: 'exact' }).eq('is_active', true);
  const { count: eventCount } = await db.from('entity_events').select('id', { count: 'exact' }).eq('is_active', true);
  console.log(`\n✅ Active specials: ${specialCount}`);
  console.log(`✅ Active events: ${eventCount}`);
  
  // 9. Check for unlinked items (items with entity_id that don't exist in entity table)
  const { data: menuItems } = await db.from('menu_items').select('entity_id').limit(5);
  const { data: drinkItems } = await db.from('drink_items').select('entity_id').limit(5);
  console.log(`\n⚠️  Old menu_items count: ${menuItems?.length || 0}`);
  console.log(`⚠️  Old drink_items count: ${drinkItems?.length || 0}`);
}

auditData().catch(console.error);
