require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  console.log('🔍 DEBUGGING PLACE_ID MISMATCH\n');

  // Active entity place_ids
  const { data: activeEntities } = await supabase
    .from('entity')
    .select('place_id')
    .eq('is_active', true)
    .not('place_id', 'is', null);

  const activePlaceIds = new Set(activeEntities?.map(e => e.place_id) || []);
  console.log(`Active entities with place_id: ${activePlaceIds.size}\n`);

  // Specials place_ids
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('place_id');

  const specialPlaceIds = new Set(specials?.map(s => s.place_id).filter(Boolean) || []);
  console.log(`Specials with place_id: ${specialPlaceIds.size}`);

  // Check if they overlap
  const matchingSpecials = [...specialPlaceIds].filter(p => activePlaceIds.has(p));
  const mismatchSpecials = [...specialPlaceIds].filter(p => !activePlaceIds.has(p));

  console.log(`  Matching: ${matchingSpecials.length}`);
  console.log(`  Mismatched: ${mismatchSpecials.length}`);

  if (mismatchSpecials.length > 0) {
    console.log(`\n  Sample mismatched place_ids from specials:`);
    mismatchSpecials.slice(0, 5).forEach(p => {
      console.log(`    ${p}`);
    });
  }

  // Happy hours place_ids
  const { data: hh } = await supabase
    .from('entity_happy_hours')
    .select('place_id');

  const hhPlaceIds = new Set(hh?.map(h => h.place_id).filter(Boolean) || []);
  console.log(`\nHappy hours with place_id: ${hhPlaceIds.size}`);

  const matchingHH = [...hhPlaceIds].filter(p => activePlaceIds.has(p));
  const mismatchHH = [...hhPlaceIds].filter(p => !activePlaceIds.has(p));

  console.log(`  Matching: ${matchingHH.length}`);
  console.log(`  Mismatched: ${mismatchHH.length}`);

  if (mismatchHH.length > 0) {
    console.log(`\n  Sample mismatched place_ids from HH:`);
    mismatchHH.slice(0, 5).forEach(p => {
      console.log(`    ${p}`);
    });
  }

  // Sample active entity place_ids
  console.log(`\n  Sample active entity place_ids:`);
  [...activePlaceIds].slice(0, 5).forEach(p => {
    console.log(`    ${p}`);
  });
}

check().catch(e => console.error(e.message));
