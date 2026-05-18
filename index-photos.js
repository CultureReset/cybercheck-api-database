#!/usr/bin/env node
/**
 * Index all photos in Supabase storage to entity_photos table
 * Scans entity-media bucket and creates records in entity_photos
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`INDEX PHOTOS TO ENTITY_PHOTOS TABLE${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}\n`);

  // Get all entities
  const { data: entities } = await db.from('entity').select('id');
  const entityIds = new Set((entities || []).map(e => e.id));
  console.log(`Loaded ${entityIds.size} entities\n`);

  let indexed = 0;
  let skipped = 0;

  // List all files in entity-media bucket
  const { data: files, error: listErr } = await db.storage
    .from('entity-media')
    .list('', { limit: 10000 });

  if (listErr) {
    console.error('Error listing files:', listErr.message);
    process.exit(1);
  }

  console.log(`Found ${files.length} file(s) in storage\n`);

  for (const file of files) {
    // Parse path: entity-images/entity-id/filename or update-links/entity-id/filename etc
    const parts = file.name.split('/');
    if (parts.length < 2) {
      skipped++;
      continue;
    }

    const entityId = parts[1];
    if (!entityIds.has(entityId)) {
      skipped++;
      continue;
    }

    // Build full path and public URL
    const storagePath = `${file.name}`;
    const publicUrl = `${process.env.GCR_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/entity-media/${storagePath}`;

    if (DRY_RUN) {
      console.log(`  ✓ ${entityId}: ${file.name}`);
      indexed++;
      continue;
    }

    try {
      // Check if already exists
      const { data: existing } = await db
        .from('entity_photos')
        .select('id')
        .eq('entity_id', entityId)
        .eq('image_url', publicUrl)
        .limit(1);

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Insert
      const { error: insErr } = await db
        .from('entity_photos')
        .insert({ entity_id: entityId, image_url: publicUrl });

      if (insErr) {
        console.error(`  ✗ ${entityId}: ${insErr.message}`);
        continue;
      }

      indexed++;
      if (indexed % 100 === 0) console.log(`  ... ${indexed} indexed`);
    } catch (e) {
      console.error(`  ✗ ${entityId}: ${e.message}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Results:`);
  console.log(`  Indexed: ${indexed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`${'='.repeat(80)}\n`);

  if (DRY_RUN) {
    console.log('(Run without --dry-run to actually index)\n');
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
