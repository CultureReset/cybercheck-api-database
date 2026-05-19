#!/usr/bin/env node
/**
 * APPLY VENUE MAPPINGS TO EVENTS
 * Uses fuzzy match results to relink orphaned events to entities
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function main() {
  console.log('📍 APPLYING VENUE MAPPINGS\n');

  // Read the CSV mappings
  const csvPath = path.join(__dirname, 'VENUE-ENTITY-MAPPINGS.csv');
  const csv = fs.readFileSync(csvPath, 'utf-8');
  const lines = csv.trim().split('\n');

  // Skip header
  const mappings = lines.slice(1).map(line => {
    const [venue, entityId, entityName, confidence] = line.match(/"([^"]*)"/g).map(m => m.slice(1, -1));
    return { venue, entityId, entityName, confidence };
  });

  console.log(`Found ${mappings.length} venue mappings\n`);

  // Get all events
  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, venue_location');

  const activeIds = new Set();
  const { data: entities } = await supabase
    .from('entity')
    .select('id')
    .eq('is_active', true);

  (entities || []).forEach(e => activeIds.add(e.id));

  let applied = 0;
  let skipped = 0;

  // Apply mappings to events
  for (const mapping of mappings) {
    if (!mapping.entityId || mapping.confidence === 'no_match') {
      skipped++;
      continue;
    }

    // Find all events with this venue location
    const matchingEvents = (events || []).filter(
      e => !activeIds.has(e.entity_id) && e.venue_location === mapping.venue
    );

    for (const event of matchingEvents) {
      const { error } = await supabase
        .from('entity_events')
        .update({ entity_id: mapping.entityId })
        .eq('id', event.id);

      if (!error) {
        applied++;
        if (applied <= 5) {
          console.log(`✓ "${mapping.venue}" → ${mapping.entityName} (${mapping.confidence})`);
        }
      }
    }
  }

  console.log(`\n✅ Applied: ${applied} events`);
  console.log(`⊘ Skipped (no match): ${skipped}\n`);
}

main().catch(console.error);
