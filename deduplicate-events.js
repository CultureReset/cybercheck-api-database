#!/usr/bin/env node
/**
 * DEDUPLICATE EVENTS
 * Keeps first instance, deletes duplicates
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

async function main() {
  console.log('🧹 DEDUPLICATING EVENTS\n');

  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name, artist_name')
    .order('created_at', { ascending: true });

  // Group by entity_id + event_name
  const groups = {};
  const toDelete = [];

  events.forEach(e => {
    const key = `${e.entity_id}|${e.event_name}`;
    if (!groups[key]) {
      groups[key] = e.id; // Keep first
    } else {
      toDelete.push(e.id); // Delete duplicates
    }
  });

  console.log(`Found ${toDelete.length} duplicates to delete\n`);

  // Delete in batches
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const { error } = await supabase
      .from('entity_events')
      .delete()
      .in('id', batch);

    if (error) {
      console.error(`Error deleting batch: ${error.message}`);
    } else {
      console.log(`✓ Deleted ${batch.length} events`);
    }
  }

  console.log(`\n✅ Done! ${toDelete.length} duplicates removed`);
}

main().catch(console.error);
