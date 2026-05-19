require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function fix() {
  console.log('🔧 FIXING WRONG LINKS\n');

  // Get all entities
  const { data: entities } = await supabase
    .from('entity')
    .select('id, place_id');

  const placeIdToId = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdToId[e.place_id] = e.id;
  });

  // Fix specials
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('id, entity_id, place_id');

  let specialsFixed = 0;
  for (const s of specials || []) {
    if (!s.place_id) continue;
    const correctId = placeIdToId[s.place_id];
    if (!correctId || s.entity_id === correctId) continue;

    const { error } = await supabase
      .from('entity_specials')
      .update({ entity_id: correctId })
      .eq('id', s.id);

    if (!error) specialsFixed++;
  }

  console.log(`✓ Specials fixed: ${specialsFixed}`);

  // Fix happy hours
  const { data: hh } = await supabase
    .from('entity_happy_hours')
    .select('id, entity_id, place_id');

  let hhFixed = 0;
  for (const h of hh || []) {
    if (!h.place_id) continue;
    const correctId = placeIdToId[h.place_id];
    if (!correctId || h.entity_id === correctId) continue;

    const { error } = await supabase
      .from('entity_happy_hours')
      .update({ entity_id: correctId })
      .eq('id', h.id);

    if (!error) hhFixed++;
  }

  console.log(`✓ Happy hours fixed: ${hhFixed}`);

  console.log(`\n✅ Total fixed: ${specialsFixed + hhFixed}`);
}

fix().catch(console.error);
