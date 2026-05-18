#!/usr/bin/env node
/**
 * Import menus from restaurants-ob-gs-menus.json to menu_items table
 */

require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const db = createClient(process.env.GCR_SUPABASE_URL, process.env.GCR_SUPABASE_KEY);

async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`IMPORT MENUS FROM restaurants-ob-gs-menus.json${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`${'='.repeat(80)}\n`);

  // Load menu data
  const menuFile = '/Users/owner/cybercheck-api-database/restaurants-ob-gs-menus.json';
  if (!fs.existsSync(menuFile)) {
    console.error(`File not found: ${menuFile}`);
    process.exit(1);
  }

  const menus = JSON.parse(fs.readFileSync(menuFile, 'utf-8'));
  console.log(`Loaded ${Object.keys(menus).length} restaurants from menu file\n`);

  // Get all entities
  const { data: entities } = await db.from('entity').select('id, name, place_id');
  const nameMap = {};
  const placeIdMap = {};
  (entities || []).forEach(e => {
    if (e.place_id) placeIdMap[e.place_id] = e;
    if (e.name) {
      const norm = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!nameMap[norm]) nameMap[norm] = [];
      nameMap[norm].push(e);
    }
  });

  let inserted = 0;
  let matched = 0;
  let failed = 0;

  for (const [restaurantName, menuData] of Object.entries(menus)) {
    // Find matching entity
    let entity;

    // Try place_id first
    if (menuData.place_id) {
      entity = placeIdMap[menuData.place_id];
    }

    // Try name matching
    if (!entity) {
      const norm = restaurantName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const candidates = nameMap[norm] || [];
      entity = candidates[0];
    }

    if (!entity) {
      console.log(`  ✗ No match: ${restaurantName}`);
      failed++;
      continue;
    }

    matched++;

    // Get or create menu sections from menu data
    const sections = menuData.sections || [];

    if (DRY_RUN) {
      console.log(`  ✓ ${entity.name}: ${Object.keys(menuData.items || {}).length} items`);
      inserted += Object.keys(menuData.items || {}).length;
      continue;
    }

    // Insert menu items
    try {
      const items = menuData.items || {};
      for (const [itemName, itemData] of Object.entries(items)) {
        const section = itemData.section || 'Menu';
        const price = typeof itemData.price === 'number' ? itemData.price : null;
        const description = itemData.description || '';

        const { error: insErr } = await db.from('menu_items').insert({
          entity_id: entity.id,
          item_name: itemName,
          item_description: description,
          item_price: price,
          section: section,
          is_available: true,
        });

        if (insErr) {
          console.error(`    ✗ ${itemName}: ${insErr.message}`);
          continue;
        }

        inserted++;
      }

      console.log(`  ✓ ${entity.name}: ${Object.keys(items).length} items imported`);
    } catch (e) {
      console.error(`  ✗ ${entity.name}: ${e.message}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Results:`);
  console.log(`  Matched: ${matched}`);
  console.log(`  Items inserted: ${inserted}`);
  console.log(`  Failed to match: ${failed}`);
  console.log(`${'='.repeat(80)}\n`);

  if (DRY_RUN) {
    console.log('(Run without --dry-run to actually import)\n');
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
