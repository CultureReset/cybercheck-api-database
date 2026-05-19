#!/usr/bin/env node
/**
 * Create scraper list for 601 businesses (all 737 minus 136 restaurants)
 * Outputs scrape-list-other-601.json with format: [{ name, url }, ...]
 */

const fs = require('fs');
const path = require('path');

// Load files
const allBusinesses = JSON.parse(fs.readFileSync('all-businesses-organized-ob-gs.json', 'utf8'));
const foodList = JSON.parse(fs.readFileSync('scrape-list-food.json', 'utf8'));

// Create set of food business names (normalized) for quick lookup
const foodNames = new Set(
  foodList.map(b => (b.name || '').toLowerCase().trim())
);

console.log(`\n📊 Extracting 601 non-food businesses from ${allBusinesses.length} total`);

// Filter: keep only non-food businesses with valid websites
const otherBusinesses = allBusinesses
  .filter(b => {
    const hasName = b.name && typeof b.name === 'string';
    const hasUrl = b.website && typeof b.website === 'string';
    const isNotFood = !foodNames.has((b.name || '').toLowerCase().trim());
    return hasName && hasUrl && isNotFood;
  })
  .map(b => ({
    name: b.name.trim(),
    url: b.website.trim()
  }))
  .filter((b, i, arr) => arr.findIndex(x => x.url === b.url) === i); // dedupe by URL

console.log(`✅ Extracted: ${otherBusinesses.length} businesses\n`);

// Save
const outFile = 'scrape-list-other-601.json';
fs.writeFileSync(outFile, JSON.stringify(otherBusinesses, null, 2));
console.log(`📄 Saved: ${outFile}\n`);

// Show first 10
console.log('Sample (first 10):');
otherBusinesses.slice(0, 10).forEach((b, i) => {
  console.log(`  [${i+1}] ${b.name}`);
});
console.log(`  ...\n`);
