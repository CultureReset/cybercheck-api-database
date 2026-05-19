#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function main() {
  // Get orphaned events
  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, venue_location');

  const { data: entities } = await supabase
    .from('entity')
    .select('id')
    .eq('is_active', true);

  const activeIds = new Set((entities || []).map(e => e.id));

  const orphaned = (events || []).filter(e => !activeIds.has(e.entity_id));

  // Get unique venue names from orphaned events
  const venues = [...new Set(orphaned.map(e => e.venue_location).filter(v => v))];

  console.log(`Orphaned events: ${orphaned.length}`);
  console.log(`Unique venues in orphaned events: ${venues.length}\n`);

  // Read CSV mappings
  const csv = fs.readFileSync('/Users/owner/cybercheck-api-database/VENUE-ENTITY-MAPPINGS.csv', 'utf-8');
  const lines = csv.trim().split('\n').slice(1);

  const csvVenues = lines.map(line => {
    const match = line.match(/"([^"]*)"/);
    return match ? match[1] : null;
  }).filter(v => v);

  console.log(`Venues in CSV mappings: ${csvVenues.length}\n`);

  // Check overlap
  const overlap = venues.filter(v => csvVenues.includes(v));
  console.log(`Venues that match CSV: ${overlap.length}`);
  if (overlap.length > 0) {
    overlap.slice(0, 5).forEach(v => {
      const count = orphaned.filter(e => e.venue_location === v).length;
      console.log(`  "${v}" (${count} events)`);
    });
  }

  // Show first few orphaned venues
  console.log(`\nFirst 10 orphaned event venues:`);
  venues.slice(0, 10).forEach(v => {
    const count = orphaned.filter(e => e.venue_location === v).length;
    console.log(`  "${v}" (${count} events)`);
  });
}

main().catch(console.error);
