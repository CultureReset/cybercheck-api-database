require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  // Get all specials with place_id
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('id, entity_id, place_id');

  // Get all entities
  const { data: entities } = await supabase
    .from('entity')
    .select('id, place_id');

  const placeIdToId = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdToId[e.place_id] = e.id;
  });

  let correct = 0;
  let wrong = 0;

  (specials || []).forEach(s => {
    if (!s.place_id) return;
    const correctId = placeIdToId[s.place_id];
    if (s.entity_id === correctId) {
      correct++;
    } else {
      wrong++;
    }
  });

  console.log(`SPECIALS:`);
  console.log(`  Already correct: ${correct}`);
  console.log(`  Need fixing: ${wrong}`);

  // Same for happy hours
  const { data: hh } = await supabase
    .from('entity_happy_hours')
    .select('id, entity_id, place_id');

  correct = 0;
  wrong = 0;

  (hh || []).forEach(h => {
    if (!h.place_id) return;
    const correctId = placeIdToId[h.place_id];
    if (h.entity_id === correctId) {
      correct++;
    } else {
      wrong++;
    }
  });

  console.log(`\nHAPPY HOURS:`);
  console.log(`  Already correct: ${correct}`);
  console.log(`  Need fixing: ${wrong}`);
}

check().catch(console.error);
