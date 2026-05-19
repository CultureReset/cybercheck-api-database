require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function check() {
  console.log('🔍 VENUE NAME MISMATCHES\n');

  const { data: entities } = await supabase
    .from('entity')
    .select('id, name')
    .eq('is_active', true);

  const entityNames = new Set((entities || []).map(e => e.name.toLowerCase()));

  const { data: events } = await supabase
    .from('entity_events')
    .select('venue_location')
    .not('venue_location', 'is', null);

  const venueNames = [...new Set((events || []).map(e => e.venue_location))];

  const mismatches = [];
  const matches = [];

  venueNames.forEach(venue => {
    const venueLower = venue.toLowerCase();
    const found = entityNames.has(venueLower);
    
    if (found) {
      matches.push(venue);
    } else {
      mismatches.push(venue);
    }
  });

  console.log(`Venue names in events: ${venueNames.length}`);
  console.log(`Match entities: ${matches.length}`);
  console.log(`Don't match: ${mismatches.length}\n`);

  if (mismatches.length > 0) {
    console.log('VENUES NOT FOUND IN ENTITIES:');
    mismatches.sort().slice(0, 30).forEach(v => {
      console.log(`  - ${v}`);
    });
    if (mismatches.length > 30) {
      console.log(`  ... and ${mismatches.length - 30} more`);
    }
  }

  if (matches.length > 0) {
    console.log(`\nVENUES THAT MATCH:`);
    matches.sort().slice(0, 10).forEach(v => {
      console.log(`  ✓ ${v}`);
    });
    if (matches.length > 10) {
      console.log(`  ... and ${matches.length - 10} more`);
    }
  }
}

check().catch(console.error);
