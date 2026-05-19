#!/usr/bin/env node
/**
 * Match events to entities by venue name (fuzzy matching)
 * Uses string similarity to find best match for each event
 */

require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

// Simple Levenshtein distance for fuzzy matching
function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;

  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / parseFloat(longer.length);
}

function levenshtein(s1, s2) {
  const costs = [];
  for (let k = 0; k <= s1.length; k++) costs[k] = k;
  for (let k = 0; k <= s2.length; k++) costs[s2.length + k] = k;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        costs[j * (s1.length + 1) + i] = costs[(j - 1) * (s1.length + 1) + (i - 1)];
      } else {
        costs[j * (s1.length + 1) + i] = 1 + Math.min(
          costs[(j - 1) * (s1.length + 1) + i],
          costs[j * (s1.length + 1) + (i - 1)],
          costs[(j - 1) * (s1.length + 1) + (i - 1)]
        );
      }
    }
  }
  return costs[s2.length * (s1.length + 1) + s1.length];
}

async function main() {
  console.log('=== Match Events to Entities ===\n');

  // Load events
  const events = JSON.parse(fs.readFileSync('/Users/owner/tools/gulfmusiclive/output/events-all-with-dates-and-places.json', 'utf-8'));
  console.log(`Loaded ${events.length} events`);

  // Load entities
  const { data: entities } = await db.from('entity').select('id, name, place_id').eq('is_active', true);
  console.log(`Loaded ${entities.length} entities\n`);

  // Normalize string for matching
  const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  // Match each event to best entity
  let matched = 0;
  let alreadyHasPlaceId = 0;

  events.forEach(event => {
    // Skip if already has place_id and it matches an entity
    if (event.place_id && event.entity_id) {
      alreadyHasPlaceId++;
      return;
    }

    const eventVenue = normalize(event.venueName);

    // Find best matching entity
    let bestMatch = null;
    let bestScore = 0.6; // Minimum threshold

    entities.forEach(entity => {
      const entityName = normalize(entity.name);
      const score = similarity(eventVenue, entityName);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = entity;
      }
    });

    if (bestMatch) {
      event.entity_id = bestMatch.id;
      event.matched_entity_name = bestMatch.name;
      event.match_score = bestScore;
      matched++;
    }
  });

  console.log(`Events matched to entities: ${matched}`);
  console.log(`Events already had place_id: ${alreadyHasPlaceId}`);

  // Count by status
  const withEntityId = events.filter(e => e.entity_id).length;
  const withDate = events.filter(e => e.event_date && e.event_date.trim()).length;
  const importable = events.filter(e => e.entity_id && e.event_date && e.event_date.trim()).length;

  console.log(`\nTotal importable (has entity_id + date): ${importable}`);
  console.log(`Total with entity_id: ${withEntityId}`);
  console.log(`Total with date: ${withDate}\n`);

  // Save enriched events
  const outPath = '/Users/owner/tools/gulfmusiclive/output/events-matched-to-entities.json';
  fs.writeFileSync(outPath, JSON.stringify(events, null, 2));
  console.log(`Saved to: events-matched-to-entities.json\n`);

  // Show samples
  console.log('Sample matches:');
  events.filter(e => e.entity_id && e.event_date).slice(0, 5).forEach(e => {
    console.log(`  - ${e.artist} @ ${e.venueName}`);
    console.log(`    → ${e.matched_entity_name} (score: ${(e.match_score * 100).toFixed(0)}%)`);
    console.log(`    Date: ${e.event_date}`);
  });
}

main().catch(console.error);
