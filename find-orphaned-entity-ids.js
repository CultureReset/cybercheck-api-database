require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  console.log('🔍 WHAT ARE ORPHANED IDS TIED TO?\n');

  // Get active entity IDs
  const { data: active } = await supabase
    .from('entity')
    .select('id');

  const activeIds = new Set(active?.map(e => e.id) || []);

  // Get unique entity_ids from orphaned events
  const { data: events } = await supabase
    .from('entity_events')
    .select('entity_id')
    .neq('entity_id', null);

  const orphanEventIds = new Set();
  (events || []).forEach(e => {
    if (!activeIds.has(e.entity_id)) orphanEventIds.add(e.entity_id);
  });

  // Get unique entity_ids from orphaned specials
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('entity_id');

  const orphanSpecialIds = new Set();
  (specials || []).forEach(s => {
    if (!activeIds.has(s.entity_id)) orphanSpecialIds.add(s.entity_id);
  });

  // Get unique entity_ids from orphaned happy hours
  const { data: hh } = await supabase
    .from('entity_happy_hours')
    .select('entity_id');

  const orphanHHIds = new Set();
  (hh || []).forEach(h => {
    if (!activeIds.has(h.entity_id)) orphanHHIds.add(h.entity_id);
  });

  // Get unique entity_ids from orphaned sections
  const { data: sections } = await supabase
    .from('entity_sections')
    .select('entity_id');

  const orphanSectionIds = new Set();
  (sections || []).forEach(s => {
    if (!activeIds.has(s.entity_id)) orphanSectionIds.add(s.entity_id);
  });

  // Combine all orphaned IDs
  const allOrphanIds = new Set([
    ...orphanEventIds, 
    ...orphanSpecialIds, 
    ...orphanHHIds, 
    ...orphanSectionIds
  ]);

  console.log(`Total unique orphaned entity_ids: ${allOrphanIds.size}\n`);

  // Try to find those IDs in the entity table (even if inactive)
  if (allOrphanIds.size > 0) {
    const { data: orphanEntities } = await supabase
      .from('entity')
      .select('id, name, is_active, place_id')
      .in('id', [...allOrphanIds])
      .limit(20);

    console.log(`Found in entity table:`);
    if (orphanEntities && orphanEntities.length > 0) {
      orphanEntities.forEach(e => {
        console.log(`  ${e.name}`);
        console.log(`    ID: ${e.id}`);
        console.log(`    Place ID: ${e.place_id}`);
        console.log(`    is_active: ${e.is_active}`);
      });
    } else {
      console.log(`  None found (IDs don't exist in entity table)`);
    }
  }

  // Check if the orphaned entity_ids appear in place_id lookup
  console.log(`\nTrying to match orphaned IDs by place_id...`);
  
  const { data: eventsByPlace } = await supabase
    .from('entity_events')
    .select('place_id, entity_id')
    .neq('entity_id', null)
    .neq('place_id', null)
    .limit(5);

  if (eventsByPlace && eventsByPlace.length > 0) {
    console.log(`Sample events with place_id:`);
    eventsByPlace.forEach(e => {
      console.log(`  Event entity_id: ${e.entity_id}`);
      console.log(`  Event place_id: ${e.place_id}`);
    });
  }
}

check().catch(e => console.error(e.message));
