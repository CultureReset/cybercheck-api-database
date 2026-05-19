#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function main() {
  const missingVenues = [
    "Tiki & Raw Bar by Barometer",
    "Pink Pony Pub",
    "Shipp's Dockside Grill"
  ];

  for (const venue of missingVenues) {
    console.log(`\nSearching for "${venue}":`);

    // Search in active entities
    const { data: active } = await supabase
      .from('entity')
      .select('id, name, is_active')
      .ilike('name', `%${venue}%`);

    if (active && active.length > 0) {
      console.log(`  Found ${active.length} active match(es):`);
      active.forEach(e => console.log(`    - ${e.name}`));
    }

    // Search in ALL entities (including inactive)
    const { data: all } = await supabase
      .from('entity')
      .select('id, name, is_active')
      .ilike('name', `%${venue.split('&')[0].trim()}%`);

    if (all && all.length > 0) {
      console.log(`  Found ${all.length} entities with partial match:`);
      all.forEach(e => console.log(`    - ${e.name} (active: ${e.is_active})`));
    }
  }

  // Check if "Barometer" exists
  console.log(`\n\nSearching for "Barometer":`);
  const { data: barometer } = await supabase
    .from('entity')
    .select('id, name, is_active')
    .ilike('name', '%Barometer%');

  if (barometer && barometer.length > 0) {
    console.log(`Found ${barometer.length} matches:`);
    barometer.forEach(e => console.log(`  - ${e.name} (active: ${e.is_active})`));
  }

  // Check if "Pony" exists
  console.log(`\n\nSearching for "Pony":`);
  const { data: pony } = await supabase
    .from('entity')
    .select('id, name, is_active')
    .ilike('name', '%Pony%');

  if (pony && pony.length > 0) {
    console.log(`Found ${pony.length} matches:`);
    pony.forEach(e => console.log(`  - ${e.name} (active: ${e.is_active})`));
  }
}

main().catch(console.error);
