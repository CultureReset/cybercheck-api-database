#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

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
  console.log('🎵 RELINKING WITH LOWER THRESHOLD (0.50)\n');

  const { data: entities } = await supabase
    .from('entity')
    .select('id, name')
    .eq('is_active', true);

  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name');

  const activeIds = new Set((entities || []).map(e => e.id));
  const orphaned = (events || []).filter(e => !activeIds.has(e.entity_id));

  console.log(`Orphaned events to process: ${orphaned.length}\n`);

  let relinked = 0;
  const unmatched = [];

  for (const event of orphaned) {
    const parts = event.event_name.split('|').map(p => p.trim());
    if (parts.length < 2) continue;

    const venueName = parts[1];
    if (!venueName) continue;

    // Fuzzy match with 0.50 threshold
    let bestMatch = null;
    let bestScore = 0.5;

    (entities || []).forEach(entity => {
      const score = similarity(venueName, entity.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entity;
      }
    });

    if (bestMatch && bestScore > 0.5) {
      const { error } = await supabase
        .from('entity_events')
        .update({ entity_id: bestMatch.id })
        .eq('id', event.id);

      if (!error) {
        relinked++;
      }
    } else {
      unmatched.push({ venue: venueName, score: bestScore, match: bestMatch?.name });
    }
  }

  console.log(`✅ Relinked: ${relinked}`);
  console.log(`❌ Still unmatched: ${unmatched.length}\n`);

  if (unmatched.length > 0) {
    console.log(`Sample unmatched venues:`);
    unmatched.slice(0, 10).forEach(u => {
      console.log(`  "${u.venue}" (best: ${u.match} at ${u.score.toFixed(2)})`);
    });
  }
}

main().catch(console.error);
