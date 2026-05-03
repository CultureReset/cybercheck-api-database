require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

const APPLY = process.argv.includes('--apply');

async function run() {
  console.log(APPLY ? '=== APPLYING ===\n' : '=== DRY RUN (use --apply to commit) ===\n');

  const { data: events } = await supabase
    .from('entity_events')
    .select('id, entity_id, event_name, event_date, day_of_week, start_time, end_time, recurring')
    .eq('is_active', true)
    .order('id', { ascending: true });

  console.log(`Total active events: ${events.length}`);

  // Group by dedupe key (same logic GCR site uses)
  const groups = {};
  events.forEach(e => {
    const key = [
      (e.event_name || '').toLowerCase().trim(),
      e.entity_id || '',
      e.event_date || '',
      (e.day_of_week || '').toLowerCase(),
      e.start_time || ''
    ].join('|');
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  const dupGroups = Object.entries(groups).filter(([k, list]) => list.length > 1);
  const totalToDelete = dupGroups.reduce((s, [, list]) => s + (list.length - 1), 0);

  console.log(`Duplicate groups: ${dupGroups.length}`);
  console.log(`Total duplicates to delete: ${totalToDelete}`);
  console.log(`Events remaining after dedupe: ${events.length - totalToDelete}\n`);

  // Show first 10 examples
  console.log('Examples (keeping oldest, deleting newer dupes):');
  dupGroups.slice(0, 10).forEach(([k, list]) => {
    console.log(`  • "${list[0].event_name}" x${list.length} → keep 1, delete ${list.length - 1}`);
  });

  if (!APPLY) {
    console.log('\nRun with --apply to commit deletions.');
    return;
  }

  // Apply: delete all but the first (oldest) in each group
  let deleted = 0;
  for (const [key, list] of dupGroups) {
    const idsToDelete = list.slice(1).map(e => e.id);
    if (idsToDelete.length === 0) continue;

    const { error } = await supabase
      .from('entity_events')
      .delete()
      .in('id', idsToDelete);

    if (error) {
      console.log(`  ❌ Failed to delete dupes for "${list[0].event_name}": ${error.message}`);
    } else {
      deleted += idsToDelete.length;
    }
  }

  console.log(`\n✅ Deleted ${deleted} duplicate events`);
  console.log(`✅ Events remaining: ${events.length - deleted}`);
}

run().catch(e => { console.error(e); process.exit(1); });
