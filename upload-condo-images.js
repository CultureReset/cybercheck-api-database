#!/usr/bin/env node
/**
 * Upload ONLY condo/vacation/rental images to Supabase
 * Matches by property name (not place_id)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const IMAGE_DIRS = [
  '/Users/owner/condos_images',
  '/Users/owner/vacationhomes_images',
  '/Users/owner/tripshock_images',
];

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`UPLOAD CONDO/VACATION/RENTAL IMAGES ONLY${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}\n`);

  // Load all entities
  const { data: entities, error: entErr } = await db
    .from('entity')
    .select('id, name')
    .eq('is_active', true);

  if (entErr) {
    console.error('Failed to load entities:', entErr.message);
    process.exit(1);
  }

  console.log(`Loaded ${entities.length} entities\n`);

  let uploadedCount = 0;
  let noMatchCount = 0;

  for (const imageDir of IMAGE_DIRS) {
    if (!fs.existsSync(imageDir)) {
      console.log(`⚠️  Directory not found: ${imageDir}`);
      continue;
    }

    const folders = fs.readdirSync(imageDir).filter(f => {
      return fs.statSync(path.join(imageDir, f)).isDirectory();
    });

    console.log(`📁 ${path.basename(imageDir)}: ${folders.length} properties`);

    for (const folder of folders) {
      // Match by normalized name
      const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const folderKey = normalize(folder);

      const entity = (entities || []).find(e => {
        return normalize(e.name).includes(folderKey) || folderKey.includes(normalize(e.name));
      });

      if (!entity) {
        noMatchCount++;
        continue;
      }

      const imageFolder = path.join(imageDir, folder);
      const imageFiles = fs.readdirSync(imageFolder)
        .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
        .sort();

      if (imageFiles.length === 0) {
        continue;
      }

      if (DRY_RUN) {
        console.log(`  ✓ ${entity.name}: ${imageFiles.length} images`);
        uploadedCount++;
        continue;
      }

      // Upload all images for this entity
      try {
        const imageUrls = [];

        for (const imageFile of imageFiles) {
          const imagePath = path.join(imageFolder, imageFile);
          const fileData = fs.readFileSync(imagePath);
          const timestamp = Date.now() + Math.random();
          const ext = path.extname(imageFile);
          const fileName = `${entity.id}_${timestamp}${ext}`;
          const storagePath = `entity-images/${entity.id}/${fileName}`;

          const { error: uploadErr } = await db.storage
            .from('entity-images')
            .upload(storagePath, fileData, { upsert: false });

          if (uploadErr) {
            console.error(`    Warning: Failed to upload ${imageFile}`);
            continue;
          }

          const { data: urlData } = db.storage
            .from('entity-images')
            .getPublicUrl(storagePath);

          imageUrls.push(urlData.publicUrl);
        }

        if (imageUrls.length === 0) {
          continue;
        }

        const { error: updateErr } = await db
          .from('entity')
          .update({
            hero_image_url: imageUrls[0],
            _extra_photos: imageUrls.slice(1),
          })
          .eq('id', entity.id);

        if (updateErr) {
          console.error(`  ✗ ${entity.name}: Update failed`);
          continue;
        }

        console.log(`  ✓ ${entity.name}: ${imageUrls.length} images`);
        uploadedCount++;
      } catch (e) {
        console.error(`  ✗ ${entity.name}: ${e.message}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Uploaded: ${uploadedCount}`);
  console.log(`No match: ${noMatchCount}`);
  console.log(`${'='.repeat(80)}\n`);

  if (DRY_RUN) {
    console.log('(Run without --dry-run to upload)\n');
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
