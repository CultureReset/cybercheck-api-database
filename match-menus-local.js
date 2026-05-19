#!/usr/bin/env node
/**
 * MATCH MENUS TO BUSINESSES LOCALLY
 * Super simple: load all businesses + all menus, match by URL, save enriched JSON
 */

const fs = require('fs');
const path = require('path');

const SHOTS_DIR = '/Users/owner/cybercheck-api-database/screenshots';

console.log('🔗 MATCHING MENUS TO BUSINESSES LOCALLY\n');

// Load all businesses
const businesses = JSON.parse(
  fs.readFileSync('/Users/owner/cybercheck-api-database/all-businesses.json', 'utf8')
);
console.log(`✓ Loaded ${businesses.length} businesses`);

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

console.log(`✓ Found ${folders.length} restaurants with menu data\n`);

const results = [];
let matched = 0;
let unmatched = 0;

for (const folder of folders) {
  const menuPath = path.join(SHOTS_DIR, folder, 'menu-detailed.json');
  const menu = JSON.parse(fs.readFileSync(menuPath, 'utf8'));

  const restaurantUrl = menu.url;
  const restaurantDomain = getDomain(restaurantUrl);

  // Try to find matching business
  let business = null;

  // Exact URL match
  business = businesses.find(b => b.website_url === restaurantUrl);

  // Domain match (if not exact)
  if (!business && restaurantDomain) {
    business = businesses.find(b => getDomain(b.website_url) === restaurantDomain);
  }

  if (business) {
    matched++;
    results.push({
      folder,
      restaurant_url: restaurantUrl,
      site_id: business.site_id,
      business_name: business.name,
      menu_items: menu.menu_data.total_items_found || 0,
      status: 'matched',
    });
    console.log(`✓ ${folder} → ${business.name}`);
  } else {
    unmatched++;
    results.push({
      folder,
      restaurant_url: restaurantUrl,
      status: 'unmatched',
    });
    console.log(`✗ ${folder} (no matching business found)`);
  }
}

// Save results
fs.writeFileSync(
  '/Users/owner/cybercheck-api-database/menu-matching-results.json',
  JSON.stringify(results, null, 2)
);

console.log(`\n✓ Results saved: menu-matching-results.json`);
console.log(`\n📊 SUMMARY`);
console.log(`==========`);
console.log(`Matched: ${matched}/${folders.length}`);
console.log(`Unmatched: ${unmatched}/${folders.length}`);

if (unmatched > 0) {
  console.log(`\n⚠️  Unmatched restaurants:`);
  results
    .filter(r => r.status === 'unmatched')
    .forEach(r => {
      console.log(`  - ${r.folder}`);
      console.log(`    URL: ${r.restaurant_url}`);
    });
}
