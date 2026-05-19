#!/usr/bin/env node
/**
 * ADD GOOGLE IDS TO UNMATCHED RESTAURANTS
 * Matches unmatched restaurants back to Google Business data
 */

const fs = require('fs');
const path = require('path');

console.log('🔗 MATCHING UNMATCHED RESTAURANTS TO GOOGLE DATA\n');

// Load Google data
const googleData = JSON.parse(
  fs.readFileSync('/Users/owner/cybercheck-api-database/all-businesses-organized-ob-gs.json', 'utf8')
);
console.log(`✓ Loaded ${googleData.length} Google businesses\n`);

const SHOTS_DIR = '/Users/owner/cybercheck-api-database/screenshots';

// Load matched menus to find which are already in GCR
const matchedMenus = JSON.parse(
  fs.readFileSync('/Users/owner/cybercheck-api-database/menus-matched.json', 'utf8')
);
const matchedNames = new Set(matchedMenus.map(m => m.entity_name));

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Find unmatched with Google IDs
const unmatched = [];
const allFolders = fs
  .readdirSync(SHOTS_DIR)
  .filter(f => {
    const menuPath = path.join(SHOTS_DIR, f, 'menu-detailed.json');
    return fs.existsSync(menuPath);
  });

for (const folder of allFolders) {
  const extractedPath = path.join(SHOTS_DIR, folder, 'extracted-data.json');
  if (!fs.existsSync(extractedPath)) continue;

  try {
    const extracted = JSON.parse(fs.readFileSync(extractedPath, 'utf8'));
    const name = extracted.extracted.restaurant_name || folder;

    if (matchedNames.has(name)) continue; // Skip already matched

    const normalizedName = normalize(name);
    const website = extracted.url || '';

    // Try to find in Google data
    let googleMatch = null;

    // Exact name match
    googleMatch = googleData.find(g => normalize(g.name) === normalizedName);

    // Website match
    if (!googleMatch && website) {
      const domain = new URL(website).hostname.replace('www.', '');
      googleMatch = googleData.find(g => {
        if (!g.website) return false;
        try {
          const gDomain = new URL(g.website).hostname.replace('www.', '');
          return gDomain === domain;
        } catch {
          return false;
        }
      });
    }

    unmatched.push({
      name: name,
      website: website,
      phone: extracted.extracted.contact?.phone || '',
      address: extracted.extracted.contact?.address || '',
      google_id: googleMatch?.place_id || null,
      google_name: googleMatch?.name || null,
      found: !!googleMatch,
    });
  } catch (e) {
    // Skip bad files
  }
}

// Summary
const withId = unmatched.filter(u => u.google_id);
const withoutId = unmatched.filter(u => !u.google_id);

console.log(`📊 UNMATCHED RESTAURANTS`);
console.log(`=======================`);
console.log(`Total: ${unmatched.length}`);
console.log(`With Google ID: ${withId.length}`);
console.log(`Without Google ID: ${withoutId.length}\n`);

if (withId.length > 0) {
  console.log('✓ Restaurants WITH Google ID (ready to import):');
  withId.slice(0, 10).forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.name}`);
    console.log(`     Google ID: ${u.google_id}`);
  });
  if (withId.length > 10) console.log(`  ... and ${withId.length - 10} more`);
}

if (withoutId.length > 0) {
  console.log(`\n✗ Restaurants WITHOUT Google ID (need to add manually):`);
  withoutId.slice(0, 10).forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.name}`);
  });
  if (withoutId.length > 10) console.log(`  ... and ${withoutId.length - 10} more`);
}

// Save results
fs.writeFileSync(
  '/Users/owner/cybercheck-api-database/unmatched-with-google-ids.json',
  JSON.stringify(unmatched, null, 2)
);

console.log(`\n✓ Saved: unmatched-with-google-ids.json`);
