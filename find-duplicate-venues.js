/**
 * Find multi-location venues (franchises) in GCR database
 * Shows which venues appear multiple times with different locations
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  console.log('Loading entities from GCR database...\n');

  const { data: entities } = await db.from('entity').select('id, name, city, entity_type, entity_subtype');

  // Group by name (case-insensitive)
  const byName = {};
  entities.forEach(e => {
    const key = (e.name || '').toLowerCase();
    if (!byName[key]) byName[key] = [];
    byName[key].push(e);
  });

  // Find franchises (same name in multiple cities or multiple rows with same name)
  const franchises = Object.entries(byName)
    .filter(([name, rows]) => rows.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`=== Multi-Location Venues in GCR (${franchises.length}) ===\n`);

  franchises.forEach(([name, rows]) => {
    console.log(`"${name}" → ${rows.length} entries:`);
    rows.forEach(r => {
      console.log(`  id=${r.id.slice(0, 8)} city=${r.city} type=${r.entity_type}/${r.entity_subtype}`);
    });
    console.log();
  });

  // Summary
  const totalDupes = franchises.reduce((sum, [, rows]) => sum + (rows.length - 1), 0);
  console.log(`\n=== Summary ===`);
  console.log(`Total duplicate/franchise rows: ${totalDupes}`);
  console.log(`\nTo delete a specific entry:`);
  console.log(`  DELETE FROM entity WHERE id = '<entity-id>';\n`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
