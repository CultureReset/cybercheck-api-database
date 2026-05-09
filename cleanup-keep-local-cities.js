/**
 * Backup and delete all venues NOT in your local cities
 * Usage:
 *   node cleanup-keep-local-cities.js --dry-run     # preview
 *   node cleanup-keep-local-cities.js               # backup + delete
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

const KEEP_CITIES = [
  'Gulf Coast',
  'Gulf Shores',
  'Orange Beach',
  'Pensacola',
  'Foley',
  'Perdido Key',
  'AL 36542',
  'Elberta',
  'Orange',
];

async function main() {
  console.log(`=== Cleanup: Keep Only Local Cities${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

  const { data: entities } = await db.from('entity').select('*');

  const toKeep = entities.filter(e => KEEP_CITIES.includes(e.city));
  const toDelete = entities.filter(e => !KEEP_CITIES.includes(e.city));

  console.log(`Total entities: ${entities.length}`);
  console.log(`To keep (${KEEP_CITIES.length} cities): ${toKeep.length}`);
  console.log(`To delete: ${toDelete.length}\n`);

  console.log('Keep cities:');
  KEEP_CITIES.forEach(c => {
    const cnt = toKeep.filter(e => e.city === c).length;
    console.log(`  ${cnt.toString().padStart(3)} | ${c}`);
  });

  console.log('\nCities to delete:');
  const deleteByCity = {};
  toDelete.forEach(e => {
    deleteByCity[e.city] = (deleteByCity[e.city] || 0) + 1;
  });
  Object.entries(deleteByCity)
    .sort((a, b) => b[1] - a[1])
    .forEach(([city, cnt]) => {
      console.log(`  ${cnt.toString().padStart(3)} | ${city}`);
    });

  if (DRY_RUN) {
    console.log('\n--- DRY RUN ---\n');
    return;
  }

  // Backup to JSON
  const backupFile = path.join(__dirname, `backup-deleted-venues-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(backupFile, JSON.stringify(toDelete, null, 2));
  console.log(`\nBackup saved: ${backupFile}`);

  // Delete
  console.log(`\nDeleting ${toDelete.length} entities...`);
  const ids = toDelete.map(e => e.id);
  const CHUNK = 100;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { error } = await db.from('entity').delete().in('id', chunk);
    if (error) {
      console.error(`  Batch ${i} error:`, error.message);
    } else {
      deleted += chunk.length;
      process.stdout.write(`\r  ${Math.min(i + CHUNK, ids.length)}/${ids.length} deleted`);
    }
  }
  console.log(`\n\nDone — deleted ${deleted} entities`);
  console.log(`Backup file: ${backupFile}\n`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
