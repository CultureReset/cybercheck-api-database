#!/usr/bin/env node
/**
 * FUZZY MATCH VENUES TO ENTITIES
 * Uses string similarity to find closest entity matches for mismatched venue names
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

// Levenshtein distance
function levenshtein(s1, s2) {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const m = a.length;
  const n = b.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function similarity(s1, s2) {
  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshtein(s1, s2);
  return 1 - (dist / maxLen);
}

async function main() {
  console.log('🎯 FUZZY MATCHING VENUES TO ENTITIES\n');

  // Get all entities
  const { data: entities } = await supabase
    .from('entity')
    .select('id, name')
    .eq('is_active', true);

  // Get all unique venue locations from events
  const { data: events } = await supabase
    .from('entity_events')
    .select('venue_location')
    .not('venue_location', 'is', null);

  const venueNames = [...new Set((events || []).map(e => e.venue_location))];
  const entityNames = (entities || []).map(e => e.name);

  console.log(`Venues to match: ${venueNames.length}`);
  console.log(`Entities available: ${entityNames.length}\n`);

  const mappings = [];
  const perfect = [];
  const partial = [];
  const nomatch = [];

  for (const venue of venueNames) {
    // Check exact match first
    const exactMatch = (entities || []).find(e => e.name.toLowerCase() === venue.toLowerCase());

    if (exactMatch) {
      perfect.push({ venue, entity: exactMatch.name, score: 1.0, id: exactMatch.id });
      mappings.push({ venue, entity_id: exactMatch.id, entity_name: exactMatch.name, confidence: 'perfect' });
      continue;
    }

    // Find best fuzzy match
    let bestMatch = null;
    let bestScore = 0.6; // Require 60% similarity minimum

    (entities || []).forEach(entity => {
      const score = similarity(venue, entity.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entity;
      }
    });

    if (bestMatch && bestScore > 0.6) {
      partial.push({ venue, entity: bestMatch.name, score: bestScore.toFixed(2), id: bestMatch.id });
      mappings.push({ venue, entity_id: bestMatch.id, entity_name: bestMatch.name, confidence: `${(bestScore * 100).toFixed(0)}%` });
    } else {
      nomatch.push(venue);
      mappings.push({ venue, entity_id: null, entity_name: null, confidence: 'no_match' });
    }
  }

  console.log('═'.repeat(70));
  console.log(`\n✅ PERFECT MATCHES: ${perfect.length}`);
  perfect.forEach(m => {
    console.log(`  ${m.venue} → ${m.entity}`);
  });

  console.log(`\n🟡 FUZZY MATCHES: ${partial.length}`);
  partial.forEach(m => {
    console.log(`  ${m.venue}`);
    console.log(`    → ${m.entity} (${m.score})`);
  });

  console.log(`\n❌ NO MATCH: ${nomatch.length}`);
  nomatch.forEach(v => {
    console.log(`  - ${v}`);
  });

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`\nSummary:`);
  console.log(`  Perfect: ${perfect.length}`);
  console.log(`  Fuzzy (>60%): ${partial.length}`);
  console.log(`  No match: ${nomatch.length}`);

  // Save mappings to CSV
  const csv = [
    'venue_location,entity_id,entity_name,confidence',
    ...mappings.map(m =>
      `"${m.venue}","${m.entity_id || ''}","${m.entity_name || ''}","${m.confidence}"`
    )
  ].join('\n');

  fs.writeFileSync('/Users/owner/cybercheck-api-database/VENUE-ENTITY-MAPPINGS.csv', csv);
  console.log(`\n✓ Saved mappings: VENUE-ENTITY-MAPPINGS.csv`);

  // Show mapping for problematic ones
  console.log(`\nTop fuzzy matches to review:`);
  partial.sort((a, b) => b.score - a.score).slice(0, 10).forEach(m => {
    console.log(`  "${m.venue}" (${m.score}) → "${m.entity}"`);
  });
}

main().catch(console.error);
