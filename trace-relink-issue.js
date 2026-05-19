require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  // Get one special
  const { data: special } = await supabase
    .from('entity_specials')
    .select('*')
    .limit(1)
    .single();

  console.log('SAMPLE SPECIAL:');
  console.log(`  ID: ${special.id}`);
  console.log(`  Entity ID: ${special.entity_id}`);
  console.log(`  Place ID: ${special.place_id}`);
  console.log(`  Type: ${typeof special.place_id}`);

  // Try to find entity by that place_id
  const { data: entity } = await supabase
    .from('entity')
    .select('id, name, place_id')
    .eq('place_id', special.place_id)
    .single();

  console.log('\nFOUND ENTITY:');
  console.log(`  ID: ${entity?.id}`);
  console.log(`  Name: ${entity?.name}`);
  console.log(`  Place ID: ${entity?.place_id}`);
  console.log(`  Type: ${typeof entity?.place_id}`);

  console.log('\nMATCH TEST:');
  console.log(`  Special place_id === Entity place_id: ${special.place_id === entity?.place_id}`);

  // Debug: show exact values
  console.log('\nEXACT VALUES:');
  console.log(`  Special.place_id: "${special.place_id}"`);
  console.log(`  Entity.place_id: "${entity?.place_id}"`);
  console.log(`  Bytes: ${Buffer.from(special.place_id).toString('hex')} vs ${Buffer.from(entity?.place_id || '').toString('hex')}`);
}

check().catch(e => console.error(e.message));
