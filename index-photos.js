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

  // List all entity folders in entity-images bucket
  const { data: entityFolders, error: listErr } = await db.storage
    .from('entity-images')
    .list('entity-images', { limit: 10000 });

  if (listErr) {
    console.error('Error listing entity folders:', listErr.message);
    process.exit(1);
  }

  console.log(`Found ${entityFolders.length} entity folder(s) in storage\n`);

  for (const folder of entityFolders) {
    const entityId = folder.name;

    if (!entityIds.has(entityId)) {
      skipped++;
      continue;
    }

    // List images in this entity's folder
    const { data: images, error: imgErr } = await db.storage
      .from('entity-images')
      .list(`entity-images/${entityId}`, { limit: 1000 });

    if (imgErr || !images) {
      console.error(`  ✗ ${entityId}: ${imgErr?.message || 'no images'}`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  ✓ ${entityId}: ${images.length} image(s)`);
      indexed += images.length;
      continue;
    }

    try {
      for (const image of images) {
        const storagePath = `entity-images/${entityId}/${image.name}`;
        const publicUrl = `${process.env.GCR_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/entity-images/${storagePath}`;

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
          console.error(`    ✗ ${image.name}: ${insErr.message}`);
          continue;
        }

        indexed++;
      }

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
