#!/usr/bin/env node
/**
 * MATCH EXTRACTED MENUS TO ENTITIES
 * Takes extracted menus + entities list, matches by website URL
 * Creates: menus-matched.json with entity_id + menu data
 */

const fs = require('fs');
const path = require('path');

console.log('🔗 MATCHING MENUS TO ENTITIES\n');

// Load entities
const entities = JSON.parse(
  fs.readFileSync('/Users/owner/cybercheck-api-database/entities.json', 'utf8')
);
console.log(`✓ Loaded ${entities.length} entities\n`);

const SHOTS_DIR = '/Users/owner/cybercheck-api-database/screenshots';

// Helper to extract domain
function getDomain(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Get all menus
const folders = fs
  .readdirSync(SHOTS_DIR)
  .filter(f => {
    const menuPath = path.join(SHOTS_DIR, f, 'menu-detailed.json');
    return fs.existsSync(menuPath);
  });

console.log(`📂 Found ${folders.length} restaurants with menu data\n`);

const matched = [];
const unmatched = [];

for (const folder of folders) {
  const menuPath = path.join(SHOTS_DIR, folder, 'menu-detailed.json');

  let menu;
  try {
    menu = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
  } catch (e) {
    unmatched.push({
      folder,
      error: 'invalid_json',
    });
    console.log(`✗ ${folder} (bad JSON)`);
    continue;
  }

  const restaurantUrl = menu.url;
  const restaurantDomain = getDomain(restaurantUrl);

  // Try to find matching entity
  let entity = null;

  // Exact URL match
  entity = entities.find(e => e.website && e.website === restaurantUrl);

  // Domain match (if not exact)
  if (!entity && restaurantDomain) {
    entity = entities.find(e =>
      e.website && getDomain(e.website) === restaurantDomain
    );
  }

  if (entity) {
    matched.push({
      entity_id: entity.id,
      entity_name: entity.name,
      place_id: entity.place_id,
      slug: entity.slug,
      restaurant_url: restaurantUrl,
      menu_items_count: menu.menu_data.total_items_found || 0,
      menu_data: menu.menu_data,
      screenshots_analyzed: menu.screenshots_analyzed,
      extracted_at: menu.menu_extracted_at,
    });
    console.log(`✓ ${entity.name.padEnd(40)} (${menu.menu_data.total_items_found} items)`);
  } else {
    unmatched.push({
      folder,
      restaurant_url: restaurantUrl,
      domain: restaurantDomain,
    });
    console.log(`✗ ${folder}`);
  }
}

// Save matched menus
fs.writeFileSync(
  '/Users/owner/cybercheck-api-database/menus-matched.json',
  JSON.stringify(matched, null, 2)
);

console.log(`\n\n📊 RESULTS`);
console.log(`==========`);
console.log(`✓ Matched: ${matched.length}/${folders.length}`);
console.log(`✗ Unmatched: ${unmatched.length}/${folders.length}`);

if (unmatched.length > 0) {
  console.log(`\n⚠️  Could not match these restaurants:`);
  unmatched.slice(0, 10).forEach(u => {
    console.log(`  - ${u.folder}`);
    console.log(`    URL: ${u.restaurant_url}`);
  });
  if (unmatched.length > 10) {
    console.log(`  ... and ${unmatched.length - 10} more`);
  }
}

// Summary stats
const totalMenuItems = matched.reduce((sum, m) => sum + m.menu_items_count, 0);
console.log(`\n📋 TOTAL MENU ITEMS: ${totalMenuItems}`);
console.log(`✓ Saved: menus-matched.json`);
console.log(`\nYou can now easily add this to your database with the entity_id!`);
