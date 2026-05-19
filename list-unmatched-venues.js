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
  const { data: entities } = await supabase
    .from('entity')
    .select('id, name')
    .eq('is_active', true);

  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name');

  const activeIds = new Set((entities || []).map(e => e.id));
  const orphaned = (events || []).filter(e => !activeIds.has(e.entity_id));

  const venueCount = new Map();
  orphaned.forEach(event => {
    const parts = event.event_name.split('|').map(p => p.trim());
    if (parts.length >= 2) {
      const venue = parts[1];
      venueCount.set(venue, (venueCount.get(venue) || 0) + 1);
    }
  });

  console.log(`Unmatched venues and best matches:\n`);
  
  Array.from(venueCount.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([venue, count]) => {
      let bestMatch = null;
      let bestScore = 0;

      (entities || []).forEach(entity => {
        const score = similarity(venue, entity.name);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entity;
        }
      });

      console.log(`"${venue}" (${count} events)`);
      if (bestMatch) {
        console.log(`  → Best match: ${bestMatch.name} (${bestScore.toFixed(2)})`);
      } else {
        console.log(`  → No match found`);
      }
    });
}

main().catch(console.error);
