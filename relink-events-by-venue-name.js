#!/usr/bin/env node
/**
 * RELINK EVENTS BY VENUE NAME
 * Matches events to entities using venue_location field
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

function similarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;

  // Levenshtein-ish: count matching words
  const words1 = s1.split(/\W+/);
  const words2 = s2.split(/\W+/);
  const matches = words1.filter(w => words2.includes(w)).length;
  return matches / Math.max(words1.length, words2.length);
}

async function main() {
  console.log('🔗 RELINKING EVENTS BY VENUE NAME\n');

  // Get all entities
  const { data: entities } = await supabase
    .from('entity')
    .select('id, name')
    .eq('is_active', true);

  const activeIds = new Set((entities || []).map(e => e.id));

  // Get all orphaned events
  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name, venue_location');

  let relinked = 0;
  let stillOrphan = 0;
  const attempts = [];

  for (const event of events || []) {
    // Skip if already tied to active entity
    if (activeIds.has(event.entity_id)) continue;

    if (!event.venue_location) {
      stillOrphan++;
      continue;
    }

    // Find best matching entity by venue name
    let bestMatch = null;
    let bestScore = 0.5; // Require at least 50% similarity

    (entities || []).forEach(entity => {
      const score = similarity(event.venue_location, entity.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entity;
      }
    });

    if (bestMatch) {
      const { error } = await supabase
        .from('entity_events')
        .update({ entity_id: bestMatch.id })
        .eq('id', event.id);

      if (!error) {
        relinked++;
        attempts.push({
          event: event.event_name.substring(0, 40),
          venue: event.venue_location,
          matched: bestMatch.name,
          score: bestScore.toFixed(2)
        });
      }
    } else {
      stillOrphan++;
    }
  }

  console.log(`✓ Relinked: ${relinked}`);
  console.log(`✗ Still orphaned: ${stillOrphan}\n`);

  if (attempts.length > 0) {
    console.log('Sample relinks:');
    attempts.slice(0, 5).forEach(a => {
      console.log(`  "${a.event}" @ "${a.venue}"`);
      console.log(`    → ${a.matched} (${a.score})`);
    });
  }
}

main().catch(console.error);
