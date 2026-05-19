#!/usr/bin/env node
/**
 * Merge automated and manual venue ID extractions
 */

const fs = require('fs');
const path = require('path');

const autoFile = path.join(__dirname, '../venue-place-ids.json');
const manualFile = path.join(__dirname, '../manual-venue-ids.json');
const outputFile = path.join(__dirname, '../all-venue-place-ids.json');

let allIds = [];

// Load automated extractions
if (fs.existsSync(autoFile)) {
  const auto = JSON.parse(fs.readFileSync(autoFile, 'utf8'));
  allIds = allIds.concat(auto);
  console.log(`✅ Loaded ${auto.length} from automated extraction`);
}

// Load manual extractions
if (fs.existsSync(manualFile)) {
  const manual = JSON.parse(fs.readFileSync(manualFile, 'utf8'));
  allIds = allIds.concat(manual);
  console.log(`✅ Loaded ${manual.length} from manual lookup`);
}

// Remove duplicates (keep first occurrence)
const seen = new Set();
const unique = allIds.filter(item => {
  const key = `${item.name}|${item.city}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Sort by city, then name
unique.sort((a, b) => {
  if (a.city !== b.city) return a.city.localeCompare(b.city);
  return a.name.localeCompare(b.name);
});

// Save merged file
fs.writeFileSync(outputFile, JSON.stringify(unique, null, 2));

console.log(`\n✅ MERGED`);
console.log(`Total venues: ${unique.length}`);
console.log(`Saved to: all-venue-place-ids.json`);
console.log(`\n📌 Next: node agents/pull-all-google-api.js --source all-venue-place-ids.json`);
