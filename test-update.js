require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function test() {
  // Find one special that needs fixing
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('id, entity_id, place_id');

  const { data: entities } = await supabase
    .from('entity')
    .select('id, place_id');

  const placeIdToId = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdToId[e.place_id] = e.id;
  });

  const wrong = specials.find(s => {
    if (!s.place_id) return false;
    return s.entity_id !== placeIdToId[s.place_id];
  });

  if (!wrong) {
    console.log('No wrong specials found to fix');
    return;
  }

  console.log('WRONG SPECIAL:');
  console.log(`  ID: ${wrong.id}`);
  console.log(`  Current entity_id: ${wrong.entity_id}`);
  console.log(`  Should be: ${placeIdToId[wrong.place_id]}`);

  // Try to update
  const { error, data } = await supabase
    .from('entity_specials')
    .update({ entity_id: placeIdToId[wrong.place_id] })
    .eq('id', wrong.id)
    .select();

  if (error) {
    console.log(`\nERROR: ${error.message}`);
  } else {
    console.log(`\n✓ Updated successfully`);
    console.log(JSON.stringify(data, null, 2));
  }
}

test().catch(console.error);
