#!/usr/bin/env node
/**
 * Import condo amenities as sections from condos_data/*.json
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
  console.log(`IMPORT CONDO AMENITIES AS SECTIONS${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}\n`);

  // Get entities
  const { data: entities } = await db.from('entity').select('id, name');
  const nameMap = {};
  (entities || []).forEach(e => {
    const norm = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!nameMap[norm]) nameMap[norm] = [];
    nameMap[norm].push(e);
  });

  let inserted = 0;
  let matched = 0;
  let failed = 0;

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

        // Find entity
        const norm = propertyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const entity = (nameMap[norm] || [])[0];

        if (!entity) {
          console.log(`  ✗ No match: ${propertyName}`);
          failed++;
          continue;
        }

        matched++;

        // Get amenities
        const amenities = data.amenities || [];
        if (amenities.length === 0) {
          console.log(`  ✓ ${propertyName}: no amenities`);
          continue;
        }

        if (DRY_RUN) {
          console.log(`  ✓ ${propertyName}: ${amenities.length} amenities`);
          inserted += amenities.length;
          continue;
        }

        // Check if section already exists
        const { data: existingSection } = await db
          .from('entity_sections')
          .select('id')
          .eq('entity_id', entity.id)
          .eq('section_key', 'amenities')
          .single();

        let section = existingSection;

        // Create section if doesn't exist
        if (!section) {
          const { data: newSection, error: secErr } = await db
            .from('entity_sections')
            .insert({
              entity_id: entity.id,
              section_key: 'amenities',
              section_label: 'Amenities',
              section_type: 'bullets',
            })
            .select()
            .single();

          if (secErr) {
            console.error(`  ✗ ${propertyName}: ${secErr.message}`);
            failed++;
            continue;
          }

          section = newSection;
        }

        // Delete existing bullets for this section
        await db.from('section_bullets').delete().eq('section_id', section.id);

        // Add amenity bullets
        const bullets = amenities.map((amenity, idx) => ({
          section_id: section.id,
          sort_order: idx,
          bullet_text: amenity,
        }));

        const { error: bulletErr } = await db.from('section_bullets').insert(bullets);

        if (bulletErr) {
          console.error(`  ✗ ${propertyName}: ${bulletErr.message}`);
          continue;
        }

        console.log(`  ✓ ${propertyName}: ${amenities.length} amenities added`);
        inserted += amenities.length;
      } catch (e) {
        console.error(`  ✗ ${fileName}: ${e.message}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Results:`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Amenities inserted: ${inserted}`);
  console.log(`  Failed: ${failed}`);
  console.log(`${'='.repeat(80)}\n`);

  if (DRY_RUN) {
    console.log('(Run without --dry-run to actually import)\n');
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
