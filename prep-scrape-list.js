#!/usr/bin/env node
/**
 * Convert business data to menu-scraper.js input format
 * Reads all-businesses-organized-ob-gs.json and writes scrape-list.json
 *
 * Usage: node prep-scrape-list.js
 *        node prep-scrape-list.js food    (food & dining only)
 *        node prep-scrape-list.js all     (all 737 businesses)
 */

const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'food';

let sourceFile;
if (mode === 'food') {
  sourceFile = 'category-food-and-dining-ob-gs.json';
} else {
  sourceFile = 'all-businesses-organized-ob-gs.json';
}

const data = JSON.parse(fs.readFileSync(path.join(__dirname, sourceFile)));

// Convert to { name, url } format, skip businesses without websites
const list = data
  .filter(b => b.website && b.website.startsWith('http'))
  .map(b => ({ name: b.name, url: b.website }));

// Skip known franchises/chains for food mode
const SKIP_CHAINS = [
  'McDonald\'s', 'Burger King', 'Wendy\'s', 'Subway', 'Chick-fil-A', 'Taco Bell',
  'KFC', 'Popeyes', 'Domino\'s', 'Pizza Hut', 'Papa John\'s', 'Little Caesars',
  'Starbucks', 'Dunkin', 'Sonic', 'Dairy Queen', 'Zaxby\'s', 'Whataburger',
  'Waffle House', 'IHOP', 'Denny\'s', 'Cracker Barrel', 'Outback', 'Applebee\'s',
  'Chili\'s', 'Olive Garden', 'Red Lobster', 'Golden Corral', 'Buffalo Wild Wings',
  'Hooters', 'Five Guys', 'Chipotle', 'Panera', 'Jersey Mike\'s', 'Firehouse Subs',
  'Jimmy John\'s', 'Wingstop', 'Raising Cane\'s', 'Cook Out', 'Huddle House'
];

const filtered = mode === 'food'
  ? list.filter(b => !SKIP_CHAINS.some(chain => b.name.toLowerCase().includes(chain.toLowerCase())))
  : list;

const outFile = mode === 'food' ? 'scrape-list-food.json' : 'scrape-list-all.json';
fs.writeFileSync(path.join(__dirname, outFile), JSON.stringify(filtered, null, 2));

console.log(`\nSource: ${sourceFile}`);
console.log(`Total with websites: ${list.length}`);
if (mode === 'food') console.log(`After filtering chains: ${filtered.length}`);
console.log(`\nSaved: ${outFile}`);
console.log(`\nNow run:`);
console.log(`  node agents/menu-scraper.js --scrape ${outFile}\n`);
