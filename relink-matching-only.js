require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function main() {
  console.log('🔗 RELINKING MATCHING SPECIALS & HAPPY HOURS\n');

  // Get entity place_id map
  const { data: entities } = await supabase
    .from('entity')
    .select('id, place_id')
    .eq('is_active', true)
    .not('place_id', 'is', null);

  const placeIdMap = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdMap[e.place_id] = e.id;
  });

  // Relink specials
  console.log('🎉 RELINKING SPECIALS...\n');
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('id, entity_id, place_id')
    .not('place_id', 'is', null);

  let specialsRelinked = 0;
  let specialsMatched = 0;
  const unmatchedSpecials = [];

  for (const special of specials || []) {
    specialsMatched++;
    const correctId = placeIdMap[special.place_id];
    
    if (!correctId) {
      unmatchedSpecials.push({ title: special.id, place_id: special.place_id });
      continue;
    }

    if (special.entity_id === correctId) continue;

    const { error } = await supabase
      .from('entity_specials')
      .update({ entity_id: correctId })
      .eq('id', special.id);

    if (!error) specialsRelinked++;
  }

  console.log(`✓ Relinked: ${specialsRelinked}/${specialsMatched}\n`);

  // Relink happy hours
  console.log('🍻 RELINKING HAPPY HOURS...\n');
  const { data: hh } = await supabase
    .from('entity_happy_hours')
    .select('id, entity_id, place_id')
    .not('place_id', 'is', null);

  let hhRelinked = 0;
  let hhMatched = 0;
  const unmatchedHH = [];

  for (const h of hh || []) {
    hhMatched++;
    const correctId = placeIdMap[h.place_id];
    
    if (!correctId) {
      unmatchedHH.push({ id: h.id, place_id: h.place_id });
      continue;
    }

    if (h.entity_id === correctId) continue;

    const { error } = await supabase
      .from('entity_happy_hours')
      .update({ entity_id: correctId })
      .eq('id', h.id);

    if (!error) hhRelinked++;
  }

  console.log(`✓ Relinked: ${hhRelinked}/${hhMatched}\n`);

  console.log('═'.repeat(60));
  console.log(`\n✅ COMPLETE`);
  console.log(`\nSpecials relinked: ${specialsRelinked}`);
  console.log(`Happy Hours relinked: ${hhRelinked}`);

  if (unmatchedSpecials.length > 0) {
    console.log(`\n⚠️  ${unmatchedSpecials.length} specials have no matching venue`);
  }
  if (unmatchedHH.length > 0) {
    console.log(`⚠️  ${unmatchedHH.length} happy hours have no matching venue`);
  }
}

main().catch(console.error);
