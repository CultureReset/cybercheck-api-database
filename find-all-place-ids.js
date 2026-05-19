require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  // Get ALL place_ids from specials
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('place_id');

  const specialPlaceIds = [...new Set(specials?.map(s => s.place_id) || [])];
  console.log(`Unique place_ids in SPECIALS: ${specialPlaceIds.length}`);

  // Check if ANY exist in entity table
  const { data: foundEntities } = await supabase
    .from('entity')
    .select('id, name, is_active, place_id')
    .in('place_id', specialPlaceIds);

  console.log(`Found in entity table: ${foundEntities?.length || 0}\n`);

  if (foundEntities && foundEntities.length > 0) {
    console.log('Sample found:');
    foundEntities.slice(0, 5).forEach(e => {
      console.log(`  ${e.name} - is_active: ${e.is_active}`);
    });
  } else {
    console.log('⚠️  NO ENTITIES FOUND for specials place_ids');
    console.log('\nSample place_ids from specials:');
    specialPlaceIds.slice(0, 5).forEach(p => {
      console.log(`  ${p}`);
    });
  }
}

check().catch(console.error);
