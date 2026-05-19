#!/usr/bin/env node
/**
 * Import ALL condo/vacation/rental property data to database
 * Creates entities, imports amenities, details, pricing
 * Usage:
 *   node import-condo-data.js --dry-run
 *   node import-condo-data.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

const DATA_DIRS = [
  { path: '/Users/owner/condos_data', type: 'condo' },
  { path: '/Users/owner/vacationhomes_data', type: 'vacation-home' },
];

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`IMPORT CONDO/VACATION DATA${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}\n`);

  // Get existing entities
  const { data: existing } = await db.from('entity').select('name').eq('is_active', true);
  const existingNames = new Set((existing || []).map(e => e.name.toLowerCase().replace(/[^a-z0-9]/g, '')));

  let created = 0;
  let updated = 0;
  let amenitiesAdded = 0;

  for (const { path: dataDir, type } of DATA_DIRS) {
    if (!fs.existsSync(dataDir)) {
      console.log(`⚠️  Directory not found: ${dataDir}`);
      continue;
    }

    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    console.log(`\n📁 Processing ${type}s: ${files.length} files\n`);

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const fileName = file.replace('.json', '');

      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const propertyName = data.name || fileName;
        const normalizedName = propertyName.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Check if entity exists
        let entity = (existing || []).find(e =>
          e.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName
        );

        if (!entity && !existingNames.has(normalizedName)) {
          // Create new entity
          if (DRY_RUN) {
            console.log(`  ✓ CREATE: ${propertyName}`);
            created++;
            continue;
          }

          const slug = propertyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const { data: newEntity, error: createErr } = await db
            .from('entity')
            .insert({
              name: propertyName,
              slug: slug,
              entity_type: 'accommodation',
              entity_subtype: type,
              description: data.about || '',
              address_line_1: data.address || '',
              website_url: data.phones?.[0] || '',
              is_active: true,
              featured: false,
            })
            .select();

          if (createErr || !newEntity?.length) {
            console.error(`  ✗ Failed to create ${propertyName}${createErr ? ': ' + createErr.message : ''}`);
            continue;
          }

          entity = newEntity[0];
          console.log(`  ✓ CREATED: ${propertyName}`);
          created++;
        } else if (entity) {
          // Update existing entity with details
          if (!DRY_RUN) {
            const updateData = {};
            if (data.about && !entity.description) updateData.description = data.about;
            if (data.address && !entity.address_line_1) updateData.address_line_1 = data.address;

            if (Object.keys(updateData).length > 0) {
              await db.from('entity').update(updateData).eq('id', entity.id);
              console.log(`  ✓ UPDATED: ${propertyName}`);
              updated++;
            }
          }
        }

        // Import amenities if available
        if (data.amenities && Array.isArray(data.amenities) && data.amenities.length > 0 && entity) {
          if (!DRY_RUN) {
            // Create amenities section
            const { data: section, error: secErr } = await db
              .from('entity_sections')
              .insert({
                entity_id: entity.id,
                section_key: 'amenities',
                section_label: 'Amenities',
                section_type: 'bullets',
              })
              .select();

            if (section?.length) {
              // Add amenity bullets
              const bullets = data.amenities.map((amenity, idx) => ({
                section_id: section[0].id,
                bullet_order: idx,
                bullet_text: amenity,
              }));

              await db.from('section_bullets').insert(bullets);
              amenitiesAdded++;
            }
          }
        }
      } catch (e) {
        console.error(`  ✗ ${fileName}: ${e.message}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Results:`);
  console.log(`  Created: ${created} new properties`);
  console.log(`  Updated: ${updated} existing properties`);
  console.log(`  Amenities imported: ${amenitiesAdded}`);
  console.log(`${'='.repeat(80)}\n`);

  if (DRY_RUN) {
    console.log('(Run without --dry-run to import)\n');
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
