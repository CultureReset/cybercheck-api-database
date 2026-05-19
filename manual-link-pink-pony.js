#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function main() {
  console.log('🍹 LINKING PINK PONY PUB EVENTS\n');

  // Get Pink Pony Pub entity
  const { data: entity } = await supabase
    .from('entity')
    .select('id, name')
    .ilike('name', 'Pink Pony Pub')
    .eq('is_active', true);

  if (!entity || entity.length === 0) {
    console.log('❌ Pink Pony Pub entity not found');
    return;
  }

  const ponyId = entity[0].id;
  console.log(`✓ Found Pink Pony Pub: ${ponyId}\n`);

  // Get all events with "Pink Pony Pub" in the name that are orphaned
  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name');

  const activeIds = new Set();
  const { data: activeEntities } = await supabase
    .from('entity')
    .select('id')
    .eq('is_active', true);

  (activeEntities || []).forEach(e => activeIds.add(e.id));

  const orphanedPonyEvents = (events || []).filter(
    e => !activeIds.has(e.entity_id) && e.event_name.includes('Pink Pony Pub')
  );

  console.log(`Found ${orphanedPonyEvents.length} orphaned Pink Pony Pub events\n`);

  let updated = 0;
  for (const event of orphanedPonyEvents) {
    const { error } = await supabase
      .from('entity_events')
      .update({ entity_id: ponyId })
      .eq('id', event.id);

    if (!error) {
      updated++;
      if (updated <= 3) {
        console.log(`✓ ${event.event_name}`);
      }
    }
  }

  console.log(`\n✅ Updated ${updated} events`);
}

main().catch(console.error);
