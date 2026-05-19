#!/usr/bin/env node
/**
 * Manual Venue Lookup - Opens Google Maps for each failing venue
 * You search and manually paste the place ID
 *
 * Usage:
 *   node agents/manual-venue-lookup.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const failedVenues = [
  { name: 'CoastAL', city: 'Orange Beach', alts: ['Coastal', 'Coastal Restaurant'] },
  { name: "Perdido Beach Resort", city: 'Orange Beach', alts: ['Perdido Beach', 'Perdido Resort'] },
  { name: "Doc's Seafood and Steaks", city: 'Orange Beach', alts: ["Doc's Seafood & Steaks", "Doc's Seafood"] },
  { name: 'Tacky Jacks', city: 'Orange Beach', alts: ['Tacky Jack', 'Tacky Jacks Orange Beach'] },
  { name: "Lulu's", city: 'Gulf Shores', alts: ["Lulu's Seafood", "Lulu's at Homeport", "Lulu's Restaurant"] },
  { name: 'The Hangout', city: 'Gulf Shores', alts: ['Hangout', 'The Hangout Gulf Shores'] },
  { name: 'Tacky Jacks', city: 'Gulf Shores', alts: ['Tacky Jack Gulf Shores'] },
  { name: 'Bounce Beach', city: 'Pensacola Beach', alts: ['Bounce', 'Bounce Nightclub'] },
  { name: 'Sandshaker Lounge', city: 'Pensacola Beach', alts: ['Sandshaker', 'Sandshaker Bar'] },
  { name: "Calvert's in the Heights", city: 'Pensacola', alts: ["Calvert's", 'Calvert in the Heights'] },
  { name: 'Fraternal Order Of Eagles', city: 'Foley', alts: ['FOE Foley', 'Eagles Foley', 'Fraternal Order Eagles'] },
  { name: "Moe's Original BBQ", city: 'Foley', alts: ["Moe's BBQ", "Moe's Original"] },
  { name: 'Groovy Goat', city: 'Foley', alts: ['Groovy Goat Foley'] },
  { name: "Juana's Pagodas", city: 'Navarre', alts: ["Juana's", 'Juanas Pagodas'] },
  { name: 'Tacky Jacks', city: 'Fort Morgan', alts: ['Tacky Jacks Fort Morgan'] },
  { name: 'The Country Gym', city: 'Gulf Breeze', alts: ['Country Gym', 'The Country Gym Gulf Breeze'] }
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function manualLookup() {
  console.log('\n🔍 Manual Venue Lookup\n');
  console.log('For each venue, I\'ll open a Google Maps search.');
  console.log('Find the venue, copy the place ID from the URL, and paste it here.\n');
  console.log('Place IDs look like: "ChIJxxx..." (copy from the URL in the address bar)\n');

  const manualIds = [];

  for (let i = 0; i < failedVenues.length; i++) {
    const venue = failedVenues[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${i + 1}/${failedVenues.length}] ${venue.name} (${venue.city})`);
    console.log('Alternative names to try:');
    venue.alts.forEach(alt => console.log(`  - ${alt}`));

    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(venue.name + ' ' + venue.city + ' AL')}`;
    console.log(`\nOpening: ${mapsUrl}`);
    console.log('👉 When you find it, the URL will look like:');
    console.log('   https://www.google.com/maps/place/.../@.../!1s[PLACE_ID]...\n');

    // Try to open in browser
    try {
      require('child_process').exec(`open "${mapsUrl}"`);
    } catch (e) {
      console.log(`Manual link: ${mapsUrl}`);
    }

    const answer = await new Promise(resolve => {
      rl.question('Paste the place ID (or press Enter to skip): ', resolve);
    });

    if (answer.trim()) {
      manualIds.push({
        name: venue.name,
        city: venue.city,
        place_id: answer.trim(),
        source: 'manual_lookup'
      });
      console.log(`✅ Saved: ${answer.trim()}`);
    } else {
      console.log(`⏭️  Skipped`);
    }
  }

  rl.close();

  // Save results
  if (manualIds.length > 0) {
    const outputFile = path.join(__dirname, '../manual-venue-ids.json');
    fs.writeFileSync(outputFile, JSON.stringify(manualIds, null, 2));
    console.log(`\n✅ Saved ${manualIds.length} venue IDs to manual-venue-ids.json`);
    console.log(`\n📌 Merge with existing IDs:`);
    console.log(`   node agents/merge-venue-ids.js`);
  } else {
    console.log('\n❌ No venues found');
  }
}

manualLookup();
