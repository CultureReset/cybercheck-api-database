#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function main() {
  // Get all events with details
  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name, venue_location, artist_name, event_date');

  const { data: entities } = await supabase
    .from('entity')
    .select('id')
    .eq('is_active', true);

  const activeIds = new Set((entities || []).map(e => e.id));
  const orphaned = (events || []).filter(e => !activeIds.has(e.entity_id));

  console.log(`Total orphaned events: ${orphaned.length}\n`);

  // Check what data they have
  const withVenue = orphaned.filter(e => e.venue_location).length;
  const withEvent = orphaned.filter(e => e.event_name).length;
  const withArtist = orphaned.filter(e => e.artist_name).length;

  console.log(`With venue_location: ${withVenue}`);
  console.log(`With event_name: ${withEvent}`);
  console.log(`With artist_name: ${withArtist}\n`);

  console.log(`Sample orphaned events (showing event_name and artist_name):`);
  orphaned.slice(0, 10).forEach(e => {
    console.log(`  Event: "${e.event_name}"`);
    if (e.artist_name) console.log(`  Artist: "${e.artist_name}"`);
    console.log();
  });
}

main().catch(console.error);
