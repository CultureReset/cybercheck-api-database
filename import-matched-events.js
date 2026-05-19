#!/usr/bin/env node
/**
 * Import all matched events to entity_events table
 * Usage:
 *   node import-matched-events.js --dry-run
 *   node import-matched-events.js
 */

require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`IMPORT MATCHED EVENTS${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}\n`);

  // Load matched events
  const allEvents = JSON.parse(fs.readFileSync('/Users/owner/tools/gulfmusiclive/output/events-matched-to-entities.json', 'utf-8'));
  console.log(`Loaded ${allEvents.length} events from events-matched-to-entities.json`);

  // Prepare events for import
  const eventsToImport = [];
  let noEntityId = 0;
  let withDate = 0;
  let withoutDate = 0;

  allEvents.forEach(event => {
    if (!event.entity_id) {
      noEntityId++;
      return;
    }

    if (event.event_date && event.event_date.trim()) {
      withDate++;
    } else {
      withoutDate++;
    }

    eventsToImport.push({
      entity_id: event.entity_id,
      event_name: event.name || 'Event',
      artist_name: event.artist || null,
      event_date: event.event_date || null,
      start_time: event.start_time || null,
      description: null,
      event_type: 'live_music_or_event',
      day_of_week: null,
      recurring: false,
      venue_location: event.venueName,
      cover_charge: null,
      is_active: true,
    });
  });

  console.log(`Total events with entity_id: ${eventsToImport.length}`);
  console.log(`  With dates: ${withDate}`);
  console.log(`  Without dates: ${withoutDate}`);
  console.log(`  No entity_id (skipped): ${noEntityId}\n`);

  if (DRY_RUN) {
    console.log('Sample 5 events to import:');
    eventsToImport.slice(0, 5).forEach(e => {
      const dateStr = e.event_date ? ` on ${e.event_date}` : ' (no date)';
      console.log(`  - ${e.artist_name} @ ${e.venue_location}${dateStr}`);
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
  const { error: delErr, count: delCount } = await db.from('entity_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.error('Error deleting old events:', delErr.message);
    process.exit(1);
  }
  console.log(`Deleted ${delCount} old events\n`);

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
