require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  console.log('📊 DATABASE STATE CHECK\n');

  // Count entities
  const { count: entityCount } = await supabase
    .from('entity')
    .select('*', { count: 'exact', head: true });

  // Count menus
  const { count: menuCount } = await supabase
    .from('entity_sections')
    .select('*', { count: 'exact', head: true })
    .eq('section_type', 'grouped_items');

  // Count events
  const { count: eventCount } = await supabase
    .from('entity_events')
    .select('*', { count: 'exact', head: true });

  // Count specials
  const { count: specialCount } = await supabase
    .from('entity_specials')
    .select('*', { count: 'exact', head: true });

  // Count happy hours
  const { count: hhCount } = await supabase
    .from('entity_happy_hours')
    .select('*', { count: 'exact', head: true });

  console.log(`Entities: ${entityCount}`);
  console.log(`Menu sections: ${menuCount}`);
  console.log(`Events: ${eventCount}`);
  console.log(`Specials: ${specialCount}`);
  console.log(`Happy hours: ${hhCount}`);

  // Sample entity
  const { data: sample } = await supabase
    .from('entity')
    .select('id, name, place_id, slug')
    .limit(1)
    .single();

  if (sample) {
    console.log(`\nSample entity: ${sample.name}`);
  }
}

check().catch(e => console.error(e.message));
