#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

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
  console.log('🎵 RELINKING EVENTS BY EXTRACTED VENUE FROM EVENT NAME\n');

  // Get all entities
  const { data: entities } = await supabase
    .from('entity')
    .select('id, name')
    .eq('is_active', true);

  // Get all orphaned events
  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name');

  const activeIds = new Set((entities || []).map(e => e.id));
  const orphaned = (events || []).filter(e => !activeIds.has(e.entity_id));

  console.log(`Orphaned events to process: ${orphaned.length}\n`);

  let relinked = 0;
  let perfect = 0;
  let fuzzy = 0;

  for (const event of orphaned) {
    // Extract venue from event_name (format: "Artist | Venue | Location")
    const parts = event.event_name.split('|').map(p => p.trim());
    if (parts.length < 2) continue;

    const venueName = parts[1]; // Middle part is venue
    if (!venueName) continue;

    // Try exact match first
    const exactMatch = (entities || []).find(e => e.name.toLowerCase() === venueName.toLowerCase());
    if (exactMatch) {
      const { error } = await supabase
        .from('entity_events')
        .update({ entity_id: exactMatch.id })
        .eq('id', event.id);

      if (!error) {
        relinked++;
        perfect++;
        if (perfect <= 3) {
          console.log(`✓ PERFECT: "${venueName}" → ${exactMatch.name}`);
        }
      }
      continue;
    }

    // Try fuzzy match
    let bestMatch = null;
    let bestScore = 0.6;

    (entities || []).forEach(entity => {
      const score = similarity(venueName, entity.name);
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
        fuzzy++;
        if (fuzzy <= 3) {
          console.log(`🟡 FUZZY: "${venueName}" → ${bestMatch.name} (${bestScore.toFixed(2)})`);
        }
      }
    }
  }

  console.log(`\n📊 SUMMARY:`);
  console.log(`  Perfect matches: ${perfect}`);
  console.log(`  Fuzzy matches: ${fuzzy}`);
  console.log(`  Total relinked: ${relinked}/${orphaned.length}`);
}

main().catch(console.error);
