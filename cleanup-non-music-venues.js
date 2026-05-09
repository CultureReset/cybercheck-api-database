/**
 * Remove gas stations, chain franchises, and shopping venues from GCR
 * Usage:
 *   node cleanup-non-music-venues.js --dry-run    # preview what would be deleted
 *   node cleanup-non-music-venues.js               # delete for real
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const DRY_RUN = process.argv.includes('--dry-run');

const FRANCHISES = [
  'walmart', 'walgreens', 'cvs', 'target', 'home depot', 'best buy',
  'lowes', 'kroger', 'publix', 'winn-dixie', 'whole foods',
  'mcdonalds', 'burger king', 'wendys', 'subway', 'taco bell',
  'starbucks', 'dunkin', 'chipotle', 'panera', 'chick-fil-a',
  'amazon', 'ups store', 'fedex', 'post office',
];

const CATEGORIES_TO_DELETE = [
  'shopping', 'retail', 'store', 'gas', 'station', 'pharmacy',
  'gift shop', 'clothing store',
  'coffee shop', 'bakery', 'ice cream', 'donut shop',
];

// EXCLUDE these (keep them)
const EXCLUDE = ['liquor'];

function shouldDelete(entity) {
  const name = (entity.name || '').toLowerCase();
  const type = (entity.entity_type || '').toLowerCase();
  const subtype = (entity.entity_subtype || '').toLowerCase();

  // Check EXCLUDE list first
  for (const ex of EXCLUDE) {
    if (name.includes(ex) || type.includes(ex) || subtype.includes(ex)) return false;
  }

  // Gas stations
  if (subtype.includes('gas') || type.includes('gas')) return true;

  // Major franchises by name
  for (const franchise of FRANCHISES) {
    if (name.includes(franchise)) return true;
  }

  // Shopping/retail categories
  for (const cat of CATEGORIES_TO_DELETE) {
    if (type.includes(cat) || subtype.includes(cat)) return true;
  }

  return false;
}

async function main() {
  console.log(`=== Cleanup Non-Music Venues${DRY_RUN ? ' (DRY RUN)' : ''} ===\n`);

  const { data: entities } = await db.from('entity').select('id, name, city, entity_type, entity_subtype, is_active');

  const toDelete = entities.filter(shouldDelete);
  const toKeep = entities.filter(e => !shouldDelete(e));

  console.log(`Total entities: ${entities.length}`);
  console.log(`To delete: ${toDelete.length}`);
  console.log(`To keep: ${toKeep.length}\n`);

  // Show top 20 by category
  const byType = {};
  toDelete.forEach(e => {
    const key = `${e.entity_type}/${e.entity_subtype}`;
    byType[key] = (byType[key] || 0) + 1;
  });

  console.log('By type/subtype:');
  Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${v}x ${k}`);
  });

  // Show samples
  console.log('\nSample venues to delete (first 20):');
  toDelete.slice(0, 20).forEach(e => {
    console.log(`  ${e.name} (${e.city}) [${e.entity_type}/${e.entity_subtype}]`);
  });

  if (DRY_RUN) {
    console.log('\n--- DRY RUN COMPLETE ---');
    console.log('Re-run without --dry-run to delete for real.\n');
    return;
  }

  // Delete for real
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
  console.log(`\n\nDone — deleted ${deleted} entities\n`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
