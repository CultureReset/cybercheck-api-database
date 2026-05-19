require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  console.log('🔗 CHECKING DATA BINDING\n');

  // Get active entities
  const { data: activeEntities, count: activeCount } = await supabase
    .from('entity')
    .select('id, name', { count: 'exact', head: true })
    .eq('is_active', true);

  console.log(`Active entities: ${activeCount}`);
  
  const activeIds = new Set(activeEntities?.map(e => e.id) || []);

  // Check events - how many are tied to active entities?
  const { data: allEvents } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name');

  const eventsWithEntity = allEvents?.filter(e => activeIds.has(e.entity_id)) || [];
  const eventsOrphan = allEvents?.filter(e => !activeIds.has(e.entity_id)) || [];

  console.log(`\n📅 EVENTS`);
  console.log(`  Total: ${allEvents?.length || 0}`);
  console.log(`  Tied to active entities: ${eventsWithEntity.length}`);
  console.log(`  Orphaned (no active entity): ${eventsOrphan.length}`);

  if (eventsOrphan.length > 0) {
    console.log(`\n  Sample orphaned events:`);
    eventsOrphan.slice(0, 5).forEach(e => {
      console.log(`    - ${e.event_name} (entity_id: ${e.entity_id})`);
    });
  }

  // Check specials
  const { data: allSpecials } = await supabase
    .from('entity_specials')
    .select('id, entity_id, title');

  const specialsWithEntity = allSpecials?.filter(s => activeIds.has(s.entity_id)) || [];
  const specialsOrphan = allSpecials?.filter(s => !activeIds.has(s.entity_id)) || [];

  console.log(`\n🎉 SPECIALS`);
  console.log(`  Total: ${allSpecials?.length || 0}`);
  console.log(`  Tied to active entities: ${specialsWithEntity.length}`);
  console.log(`  Orphaned: ${specialsOrphan.length}`);

  // Check happy hours
  const { data: allHH } = await supabase
    .from('entity_happy_hours')
    .select('id, entity_id, days');

  const hhWithEntity = allHH?.filter(h => activeIds.has(h.entity_id)) || [];
  const hhOrphan = allHH?.filter(h => !activeIds.has(h.entity_id)) || [];

  console.log(`\n🍻 HAPPY HOURS`);
  console.log(`  Total: ${allHH?.length || 0}`);
  console.log(`  Tied to active entities: ${hhWithEntity.length}`);
  console.log(`  Orphaned: ${hhOrphan.length}`);

  // Check sections
  const { data: allSections } = await supabase
    .from('entity_sections')
    .select('id, entity_id, section_label');

  const sectionsWithEntity = allSections?.filter(s => activeIds.has(s.entity_id)) || [];
  const sectionsOrphan = allSections?.filter(s => !activeIds.has(s.entity_id)) || [];

  console.log(`\n📋 SECTIONS`);
  console.log(`  Total: ${allSections?.length || 0}`);
  console.log(`  Tied to active entities: ${sectionsWithEntity.length}`);
  console.log(`  Orphaned: ${sectionsOrphan.length}`);

  console.log(`\n═ SUMMARY ═`);
  console.log(`Data that displays on frontend:`);
  console.log(`  Events: ${eventsWithEntity.length}`);
  console.log(`  Specials: ${specialsWithEntity.length}`);
  console.log(`  Happy Hours: ${hhWithEntity.length}`);
  console.log(`  Sections: ${sectionsWithEntity.length}`);
}

check().catch(e => console.error(e.message));
