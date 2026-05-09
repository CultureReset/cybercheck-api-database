/**
 * Fix AM times that should be PM on imported GML events
 * 12:00 AM → 12:00 PM, 1:00 AM → 1:00 PM, etc.
 * Usage:
 *   node fix-event-times.js --dry-run
 *   node fix-event-times.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

function fixTime(t) {
  if (!t) return t;
  // Replace AM with PM in times like "12:00 AM", "1:00 AM - 3:00 AM"
  return t.replace(/(\d{1,2}:\d{2})\s*AM/g, '$1 PM');
}

async function main() {
  console.log(`=== Fix Event Times${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

  // Load all events with AM times
  let all = [], from = 0;
  while (true) {
    const { data } = await db.from('entity_events').select('id, start_time, end_time').range(from, from + 999);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  // Only fix events where start_time is AM
  // end_time AM is legitimate (show ends after midnight, e.g. 11 PM - 2 AM)
  const toFix = all.filter(e => e.start_time && e.start_time.includes('AM'));

  console.log(`Total events: ${all.length}`);
  console.log(`Events with AM start times to fix: ${toFix.length}\n`);

  if (DRY_RUN) {
    console.log('Sample fixes:');
    toFix.slice(0, 20).forEach(e => {
      console.log(`  start: "${e.start_time}" → "${fixTime(e.start_time)}"  end: "${e.end_time}"`);
    });
    return;
  }

  let fixed = 0;
  for (const e of toFix) {
    const { error } = await db.from('entity_events').update({
      start_time: fixTime(e.start_time),
    }).eq('id', e.id);
    if (error) console.error(`  Error on ${e.id}:`, error.message);
    else fixed++;
    if (fixed % 100 === 0) process.stdout.write(`\r  ${fixed}/${toFix.length} fixed`);
  }

  console.log(`\n\nDone — fixed ${fixed} events`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
