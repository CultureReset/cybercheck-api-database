#!/usr/bin/env node
/**
 * Import events with place_ids into entity_events table
 * Events are matched to entities by place_id
 * Usage:
 *   node import-events-with-places.js --dry-run
 *   node import-events-with-places.js
 */

require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`IMPORT EVENTS WITH PLACE_IDS${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}\n`);

  // Load events with place_ids
  const allEvents = JSON.parse(fs.readFileSync('/Users/owner/tools/gulfmusiclive/output/events-all-with-dates-and-places.json', 'utf-8'));
  console.log(`Loaded ${allEvents.length} events`);

  // Load entities from database
  const { data: entities, error: entErr } = await db
    .from('entity')
    .select('id, place_id, name')
    .eq('is_active', true);

  if (entErr) {
    console.error('Failed to load entities:', entErr.message);
    process.exit(1);
  }
  console.log(`Loaded ${entities.length} entities from database\n`);

  // Build place_id → entity_id map
  const placeIdMap = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdMap[e.place_id] = e.id;
  });
  console.log(`Entities with place_id: ${Object.keys(placeIdMap).length}\n`);

  // Prepare events for import
  const eventsToImport = [];
  let noDate = 0;
  let noPlaceId = 0;
  let noEntityMatch = 0;
  let matched = 0;

  allEvents.forEach(event => {
    // Skip events without dates
    if (!event.event_date || !event.event_date.trim()) {
      noDate++;
      return;
    }

    // Skip events without place_id
    if (!event.place_id) {
      noPlaceId++;
      return;
    }

    // Find matching entity by place_id
    const entity_id = placeIdMap[event.place_id];
    if (!entity_id) {
      noEntityMatch++;
      return;
    }

    eventsToImport.push({
      entity_id,
      event_name: event.name || 'Event',
      artist_name: event.artist || null,
      event_date: event.event_date,
      start_time: event.start_time || null,
      description: null,
      event_type: 'live_music_or_event',
      day_of_week: null,
      recurring: false,
      venue_location: event.venueName,
      cover_charge: null,
      is_active: true,
    });
    matched++;
  });

  console.log(`Total events loaded: ${allEvents.length}`);
  console.log(`  No date: ${noDate}`);
  console.log(`  No place_id: ${noPlaceId}`);
  console.log(`  No entity match: ${noEntityMatch}`);
  console.log(`  Matched to entities: ${matched}\n`);

  if (DRY_RUN) {
    console.log('Sample 5 events to import:');
    eventsToImport.slice(0, 5).forEach(e => {
      console.log(`  - ${e.artist_name} @ ${e.venue_location} on ${e.event_date} (entity_id: ${e.entity_id})`);
    });
    console.log('\n(Run without --dry-run to import)\n');
    return;
  }

  if (eventsToImport.length === 0) {
    console.log('❌ No events to import\n');
    return;
  }

  // Delete old events
  console.log('Deleting old entity_events...');
  const { error: delErr } = await db.from('entity_events').delete().gte('id', 0);
  if (delErr) {
    console.error('Error deleting old events:', delErr.message);
    process.exit(1);
  }
  console.log(`Deleted all old events\n`);

  // Import in batches
  console.log(`Importing ${eventsToImport.length} events in batches...`);
  let imported = 0;
  const batchSize = 500;

  for (let i = 0; i < eventsToImport.length; i += batchSize) {
    const batch = eventsToImport.slice(i, i + batchSize);
    const { error: insErr } = await db.from('entity_events').insert(batch);

    if (insErr) {
      console.error(`Error importing batch ${Math.floor(i / batchSize) + 1}:`, insErr.message);
      process.exit(1);
    }

    imported += batch.length;
    process.stdout.write(`\r  ${imported}/${eventsToImport.length} imported`);
  }

  console.log(`\n\n✅ Import complete! ${imported} events imported to entity_events table\n`);
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
