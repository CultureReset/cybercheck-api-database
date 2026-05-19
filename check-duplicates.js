require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  console.log('🔍 CHECKING FOR DUPLICATE EVENTS\n');

  // Get all events
  const { data: events, error } = await supabase
    .from('entity_events')
    .select('entity_id, event_name, artist_name, event_date');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  // Group by entity_id + event_name
  const groups = {};
  events.forEach(e => {
    const key = `${e.entity_id}|${e.event_name}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  // Find duplicates
  const dupes = Object.entries(groups)
    .filter(([_, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      count: items.length,
      sample: items[0],
    }));

  if (dupes.length === 0) {
    console.log('✓ No duplicates found!');
    console.log(`Total events: ${events.length}`);
  } else {
    console.log(`⚠️  Found ${dupes.length} duplicate groups:\n`);
    dupes.slice(0, 10).forEach(d => {
      console.log(`  ${d.sample.event_name} (count: ${d.count})`);
    });
  }
}

check().catch(e => console.error(e.message));
