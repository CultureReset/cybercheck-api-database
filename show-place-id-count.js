require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  const { count: specialsTotal } = await supabase
    .from('entity_specials')
    .select('*', { count: 'exact', head: true });

  const { count: specialsWithPlace } = await supabase
    .from('entity_specials')
    .select('*', { count: 'exact', head: true })
    .not('place_id', 'is', null);

  const { count: hhTotal } = await supabase
    .from('entity_happy_hours')
    .select('*', { count: 'exact', head: true });

  const { count: hhWithPlace } = await supabase
    .from('entity_happy_hours')
    .select('*', { count: 'exact', head: true })
    .not('place_id', 'is', null);

  console.log('Specials: ' + specialsWithPlace + ' / ' + specialsTotal + ' have place_id');
  console.log('Happy Hours: ' + hhWithPlace + ' / ' + hhTotal + ' have place_id');
}

check().catch(console.error);
