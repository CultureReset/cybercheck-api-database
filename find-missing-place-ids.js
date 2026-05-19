require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  const { data: entities } = await supabase
    .from('entity')
    .select('place_id');

  const entityPlaceIds = new Set((entities || []).map(e => e.place_id).filter(Boolean));

  // Find specials with place_ids that don't match
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('id, title, place_id, entity_id');

  const missingInSpecials = [];
  (specials || []).forEach(s => {
    if (s.place_id && !entityPlaceIds.has(s.place_id)) {
      missingInSpecials.push(s);
    }
  });

  console.log(`Specials with non-existent place_ids: ${missingInSpecials.length}\n`);
  
  if (missingInSpecials.length > 0) {
    console.log('Sample:');
    missingInSpecials.slice(0, 5).forEach(s => {
      console.log(`  ${s.title || 'no title'}`);
      console.log(`    Place ID: ${s.place_id}`);
    });
  }
}

check().catch(console.error);
