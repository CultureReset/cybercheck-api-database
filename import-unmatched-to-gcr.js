#!/usr/bin/env node
/**
 * IMPORT UNMATCHED RESTAURANTS WITH GOOGLE IDS
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const gcrDb = createClient(
  process.env.GCR_SUPABASE_URL,
  process.env.GCR_SUPABASE_KEY
);

function makeSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-')
    .substring(0, 50);
}

async function main() {
  console.log('📥 IMPORTING 50 UNMATCHED RESTAURANTS WITH GOOGLE IDS\n');

  // Load unmatched with Google IDs
  const unmatched = JSON.parse(
    fs.readFileSync('/Users/owner/cybercheck-api-database/unmatched-with-google-ids.json', 'utf8')
  ).filter(u => u.google_id);

  console.log(`Found ${unmatched.length} restaurants to import\n`);

  // Format for GCR
  const toInsert = unmatched.map(r => ({
    name: r.name,
    slug: makeSlug(r.name) + '-' + Math.random().toString(36).substring(7),
    place_id: r.google_id,
    website_url: r.website,
    phone: r.phone,
    address_line_1: r.address,
    entity_type: 'restaurant',
    entity_subtype: 'restaurant',
    city: 'Orange Beach',
    is_active: true,
  }));

  // Insert
  const { data, error } = await gcrDb
    .from('entity')
    .insert(toInsert)
    .select('id, name, place_id');

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log(`✓ Successfully imported ${data.length} restaurants!\n`);
  data.slice(0, 15).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.name}`);
  });
  if (data.length > 15) console.log(`  ... and ${data.length - 15} more`);

  console.log(`\n✓ All 50 restaurants now in GCR with Google IDs!`);
  console.log(`\nNext: node match-menus-to-entities.js`);
}

main().catch(console.error);
