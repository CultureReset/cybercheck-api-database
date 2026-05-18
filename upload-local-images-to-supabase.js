#!/usr/bin/env node
/**
 * Upload local images to Supabase storage and link to entities
 * Images are in directories named by place_id (ChIJ...)
 * Usage:
 *   node upload-local-images-to-supabase.js --dry-run
 *   node upload-local-images-to-supabase.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const IMAGE_DIRS = [
  '/Users/owner/cybercheck-api-database/restaurant-photos',
  '/Users/owner/cybercheck-api-database/specialty-photos',
  '/Users/owner/cybercheck-api-database/activity-photos',
  '/Users/owner/cybercheck-api-database/shopping-services-photos',
  '/Users/owner/condos_images',
  '/Users/owner/vacationhomes_images',
  '/Users/owner/tripshock_images',
];

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`UPLOAD LOCAL IMAGES TO SUPABASE${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}\n`);

  // Load all entities with place_ids
  const { data: entities, error: entErr } = await db
    .from('entity')
    .select('id, place_id, name')
    .eq('is_active', true);

  if (entErr) {
    console.error('Failed to load entities:', entErr.message);
    process.exit(1);
  }

  // Build place_id → entity map
  const placeIdMap = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdMap[e.place_id] = e;
  });
  console.log(`Loaded ${entities.length} entities`);
  console.log(`Entities with place_id: ${Object.keys(placeIdMap).length}\n`);

  // Find all local image directories
  let uploadedCount = 0;
  let skippedCount = 0;
  let noMatchCount = 0;

  for (const imageDir of IMAGE_DIRS) {
    if (!fs.existsSync(imageDir)) {
      console.log(`⚠️  Directory not found: ${imageDir}`);
      continue;
    }

    const folders = fs.readdirSync(imageDir).filter(f => {
      return fs.statSync(path.join(imageDir, f)).isDirectory();
    });

    const isByPlaceId = imageDir.includes('restaurant') || imageDir.includes('specialty') ||
                        imageDir.includes('activity') || imageDir.includes('shopping');

    console.log(`\n📁 ${path.basename(imageDir)}: ${folders.length} ${isByPlaceId ? 'place_id' : 'name'} directories`);

    for (const folder of folders) {
      let entity;

      if (isByPlaceId) {
        entity = placeIdMap[folder];
        if (!entity) {
          noMatchCount++;
          continue;
        }
      } else {
        // Match by normalized name for condos/rentals
        const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        const folderKey = normalize(folder);

        entity = (entities || []).find(e => {
          return normalize(e.name).includes(folderKey) || folderKey.includes(normalize(e.name));
        });

        if (!entity) {
          noMatchCount++;
          continue;
        }
      }

      const imageFolder = path.join(imageDir, placeId);
      const imageFiles = fs.readdirSync(imageFolder)
        .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
        .sort();

      if (imageFiles.length === 0) {
        skippedCount++;
        continue;
      }

      // Use first image as hero
      const heroFile = imageFiles[0];
      const heroPath = path.join(imageFolder, heroFile);

      if (DRY_RUN) {
        console.log(`  ✓ ${entity.name}: ${heroFile} (+ ${imageFiles.length - 1} more)`);
        uploadedCount++;
        continue;
      }

      // Upload all images for this entity
      try {
        const imageUrls = [];

        // Upload each image
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

          // Get public URL
          const { data: urlData } = db.storage
            .from('entity-images')
            .getPublicUrl(storagePath);

          imageUrls.push(urlData.publicUrl);
        }

        if (imageUrls.length === 0) {
          console.error(`  ✗ ${entity.name}: No images uploaded`);
          continue;
        }

        // Update entity with all image URLs
        const { error: updateErr } = await db
          .from('entity')
          .update({
            hero_image_url: imageUrls[0],
            _extra_photos: imageUrls.slice(1), // Store additional images
          })
          .eq('id', entity.id);

        if (updateErr) {
          console.error(`  ✗ ${entity.name}: Update failed - ${updateErr.message}`);
          continue;
        }

        console.log(`  ✓ ${entity.name}: ${imageUrls.length} images uploaded`);
        uploadedCount++;
      } catch (e) {
        console.error(`  ✗ ${entity.name}: ${e.message}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Results:`);
  console.log(`  Uploaded: ${uploadedCount}`);
  console.log(`  Skipped (no images): ${skippedCount}`);
  console.log(`  No match in database: ${noMatchCount}`);
  console.log(`${'='.repeat(80)}\n`);

  if (DRY_RUN) {
    console.log('(Run without --dry-run to actually upload)\n');
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
