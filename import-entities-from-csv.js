#!/usr/bin/env node
/**
 * IMPORT ENTITIES FROM CSV TO SUPABASE
 * Takes gcr-businesses.csv and loads into entity table
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const supabase = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

function slugify(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}

async function main() {
  console.log('📥 Importing entities from CSV...\n');

  const csv = fs.readFileSync('/Users/owner/cybercheck-api-database/gcr-businesses.csv', 'utf8');
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Found ${records.length} records\n`);

  let imported = 0;
  let skipped = 0;
  let errors = [];

  for (const record of records) {
    try {
      const id = record.id?.trim();
      const name = record.name?.trim();
      const google_id = record.google_id?.trim();
      const phone = record.phone?.trim();
      const address = record.address?.trim();

      // Skip invalid records
      if (!id || !name) {
        skipped++;
        continue;
      }

      // Check if already exists
      const { data: exists } = await supabase
        .from('entity')
        .select('id')
        .eq('id', id)
        .single();

      if (exists) {
        skipped++;
        continue;
      }

      // Generate slug
      const slug = slugify(name) + '-' + id.substring(0, 6);

      // Insert entity
      const { error } = await supabase
        .from('entity')
        .insert({
          id,
          name,
          place_id: google_id || null,
          slug,
          phone: phone || null,
          address_line_1: address || null,
          entity_type: 'business',
          is_active: true,
        });

      if (error) {
        errors.push({ name, error: error.message });
        skipped++;
      } else {
        imported++;
      }
    } catch (e) {
      errors.push({ name: record.name, error: e.message });
    }
  }

  console.log(`\n✓ Imported: ${imported}`);
  console.log(`⊘ Skipped: ${skipped}`);
  if (errors.length > 0) {
    console.log(`✗ Errors: ${errors.length}`);
    errors.slice(0, 5).forEach(e => {
      console.log(`  - ${e.name}: ${e.error}`);
    });
  }
}

main().catch(console.error);
