require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

function normalize(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

async function check() {
  console.log('📞 MATCHING ORPHANED DATA BY PHONE NUMBER\n');

  // Get all entities with phones
  const { data: entities } = await supabase
    .from('entity')
    .select('id, name, phone')
    .eq('is_active', true)
    .not('phone', 'is', null);

  const phoneMap = {};
  (entities || []).forEach(e => {
    const normalized = normalize(e.phone);
    if (normalized) phoneMap[normalized] = e.id;
  });

  console.log(`Entities with phone numbers: ${Object.keys(phoneMap).length}\n`);

  // Get all events with venue_location
  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name, venue_location');

  let eventMatches = 0;
  const eventOrphans = [];

  for (const event of events || []) {
    const activeIds = new Set(entities.map(e => e.id));
    
    // If already tied to active entity, skip
    if (activeIds.has(event.entity_id)) continue;

    // Try to find entity by venue_location matching entity name
    const foundEntity = (entities || []).find(e => 
      e.name.toLowerCase().includes(event.venue_location?.toLowerCase()) ||
      event.venue_location?.toLowerCase().includes(e.name.toLowerCase())
    );

    if (foundEntity) {
      eventMatches++;
    } else {
      eventOrphans.push(event);
    }
  }

  console.log(`EVENTS:`);
  console.log(`  Can be matched by venue name: ${eventMatches}`);
  console.log(`  Still orphaned: ${eventOrphans.length}`);

  if (eventOrphans.length > 0) {
    console.log(`\n  Sample orphaned events:`);
    eventOrphans.slice(0, 5).forEach(e => {
      console.log(`    - ${e.event_name} @ ${e.venue_location}`);
    });
  }

  // Get all specials with place_id
  const { data: specials } = await supabase
    .from('entity_specials')
    .select('id, entity_id, title, place_id');

  let specialMatches = 0;
  const specialOrphans = [];

  const placeIdMap = {};
  (entities || []).forEach(e => {
    // Try to find this entity's place_id
  });

  for (const special of specials || []) {
    const activeIds = new Set(entities.map(e => e.id));
    if (activeIds.has(special.entity_id)) continue;

    // Check if place_id matches
    const foundEntity = Object.values(phoneMap).find(id => 
      entities.find(e => e.id === id)
    );

    if (special.place_id) {
      specialMatches++;
    } else {
      specialOrphans.push(special);
    }
  }

  console.log(`\nSPECIALS:`);
  console.log(`  With place_id: ${(specials || []).filter(s => s.place_id).length}`);
  console.log(`  Without place_id: ${(specials || []).filter(s => !s.place_id).length}`);
}

check().catch(console.error);
