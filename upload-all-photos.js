#!/usr/bin/env node
/**
 * Upload ALL 5,640 local photos to Supabase and link to entities
 * Matches by place_id (restaurants/activities) or name (condos/rentals)
 *
 * Usage:
 *   node upload-all-photos.js --dry-run
 *   node upload-all-photos.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const IMAGE_DIRS = [
  {
    path: '/Users/owner/cybercheck-api-database/restaurant-photos',
    type: 'place_id',
    category: 'restaurants'
  },
  {
    path: '/Users/owner/cybercheck-api-database/specialty-photos',
    type: 'place_id',
    category: 'specialty'
  },
  {
    path: '/Users/owner/cybercheck-api-database/activity-photos',
    type: 'place_id',
    category: 'activities'
  },
  {
    path: '/Users/owner/cybercheck-api-database/shopping-services-photos',
    type: 'place_id',
    category: 'shopping'
  },
  {
    path: '/Users/owner/condos_images',
    type: 'name',
    category: 'condos'
  },
  {
    path: '/Users/owner/vacationhomes_images',
    type: 'name',
    category: 'vacation homes'
  },
  {
    path: '/Users/owner/tripshock_images',
    type: 'name',
    category: 'activities'
  }
];

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`UPLOAD ALL PHOTOS TO SUPABASE${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}\n`);

  // Load all entities
  console.log('📊 Loading entities...');
  const { data: entities, error: entErr } = await db
    .from('entity')
    .select('id, place_id, name')
    .eq('is_active', true);

  if (entErr) {
    console.error('Failed to load entities:', entErr.message);
    process.exit(1);
  }

  // Build lookup maps
  const placeIdMap = {};
  const nameMap = {};

  (entities || []).forEach(e => {
    if (e.place_id) placeIdMap[e.place_id] = e;
    if (e.name) {
      const normalized = (e.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      if (!nameMap[normalized]) nameMap[normalized] = [];
      nameMap[normalized].push(e);
    }
  });

  console.log(`  ✓ Loaded ${entities.length} entities`);
  console.log(`  ✓ Indexed ${Object.keys(placeIdMap).length} by place_id`);
  console.log(`  ✓ Indexed ${Object.keys(nameMap).length} by name\n`);

  let stats = {
    matched: 0,
    uploaded: 0,
    failed: 0,
    noMatch: 0,
    totalPhotos: 0
  };

  // Process each directory
  for (const imageDir of IMAGE_DIRS) {
    if (!fs.existsSync(imageDir.path)) {
      console.log(`⚠️  Directory not found: ${imageDir.path}`);
      continue;
    }

    const folders = fs.readdirSync(imageDir.path).filter(f => {
      return fs.statSync(path.join(imageDir.path, f)).isDirectory();
    });

    console.log(`📁 ${imageDir.category.toUpperCase()}: ${folders.length} folders`);

    for (const folder of folders) {
      let entity;

      if (imageDir.type === 'place_id') {
        entity = placeIdMap[folder];
        if (!entity) {
          stats.noMatch++;
          continue;
        }
      } else {
        // Match by name
        const normalized = folder.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        const candidates = nameMap[normalized] || [];

        if (candidates.length === 1) {
          entity = candidates[0];
        } else if (candidates.length > 1) {
          // Try fuzzy match - pick the best match
          entity = candidates.find(c =>
            normalized.includes(c.name.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
            c.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalized)
          ) || candidates[0];
        }

        if (!entity) {
          stats.noMatch++;
          continue;
        }
      }

      // Get image files
      const imageFolder = path.join(imageDir.path, folder);
      const imageFiles = fs.readdirSync(imageFolder)
        .filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
        .sort();

      if (imageFiles.length === 0) {
        continue;
      }

      stats.totalPhotos += imageFiles.length;
      stats.matched++;

      if (DRY_RUN) {
        console.log(`  ✓ ${entity.name} (${folder}): ${imageFiles.length} photos`);
        continue;
      }

      // Upload photos
      try {
        const imageUrls = [];

        for (const imageFile of imageFiles) {
          try {
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
              console.error(`    Warning: Failed to upload ${imageFile}: ${uploadErr.message}`);
              continue;
            }

            const { data: urlData } = db.storage
              .from('entity-images')
              .getPublicUrl(storagePath);

            imageUrls.push(urlData.publicUrl);
          } catch (e) {
            console.error(`    Warning: Error processing ${imageFile}: ${e.message}`);
          }
        }

        if (imageUrls.length === 0) {
          console.error(`  ✗ ${entity.name}: No images uploaded`);
          stats.failed++;
          continue;
        }

        // Update entity with photos
        const { error: updateErr } = await db
          .from('entity')
          .update({
            hero_image_url: imageUrls[0],
            _extra_photos: imageUrls.slice(1)
          })
          .eq('id', entity.id);

        if (updateErr) {
          console.error(`  ✗ ${entity.name}: Update failed - ${updateErr.message}`);
          stats.failed++;
          continue;
        }

        console.log(`  ✓ ${entity.name}: ${imageUrls.length} photos uploaded`);
        stats.uploaded++;
      } catch (e) {
        console.error(`  ✗ ${entity.name}: ${e.message}`);
        stats.failed++;
      }
    }
    console.log();
  }

  // Summary
  console.log(`${'='.repeat(80)}`);
  console.log(`UPLOAD SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  Total photos processed: ${stats.totalPhotos}`);
  console.log(`  ✓ Matched to entities: ${stats.matched}`);
  console.log(`  ✓ Successfully uploaded: ${stats.uploaded}`);
  console.log(`  ✗ Failed: ${stats.failed}`);
  console.log(`  ✗ No match found: ${stats.noMatch}`);
  console.log(`${'='.repeat(80)}\n`);

  if (DRY_RUN) {
    console.log('(Run without --dry-run to actually upload)\n');
  } else {
    console.log('✓ Upload complete!\n');
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
