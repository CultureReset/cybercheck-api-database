#!/usr/bin/env node

const fs = require('fs');

console.log('='.repeat(80));
console.log('LOOKUP UNMATCHED VENUES USING MAPPING');
console.log('='.repeat(80) + '\n');

// Your venue name → search string mapping
const venueMapping = {
  'OSO at Bear Point Harbor': 'OSO at Bear Point Harbor Orange Beach AL',
  'Barometer Waterfront Grille': 'Barometer Waterfront Grille Orange Beach AL',
  'Cobalt': 'Cobalt Restaurant Orange Beach AL',
  'CoastAL': 'CoastAL Orange Beach AL',
  'Luna\'s Eat & Drink': 'Luna\'s Eat & Drink Orange Beach AL',
  'The Red Haven Live': 'The Red Haven Live Orange Beach AL',
  'Angry Crab Shack': 'Angry Crab Shack Orange Beach AL',
  'Tipsy Pelican Patio Bar': 'Tipsy Pelican Patio Bar Orange Beach AL',
  'Tee Off at the Wharf @ Portside on Main': 'Portside on Main Orange Beach AL',
  'Perdido Beach Resort': 'Perdido Beach Resort Orange Beach AL',
  'Ginny Lane Bar and Grill': 'Ginny Lane Bar and Grill Orange Beach AL',
  'Tiki & Raw Bar by Barometer': 'Tiki & Raw Bar by Barometer Orange Beach AL',
  'GTs On The Bay': 'GT\'s On The Bay Orange Beach AL',
  'Shipp\'s Dockside Grill': 'Shipp\'s Dockside Grill Orange Beach AL',
  'Doc\'s Seafood and Steaks': 'Doc\'s Seafood and Steaks Orange Beach AL',
  'Cosmo\'s Restaurant & Bar': 'Cosmo\'s Restaurant & Bar Orange Beach AL',
  'Zeke\'s Restaurant': 'Zeke\'s Restaurant Orange Beach AL',
  'Tacky Jacks': 'Tacky Jacks Orange Beach AL',
  'The Undertow': 'The Undertow Orange Beach AL',
  'Flora-Bama': 'Flora-Bama Lounge Perdido Key FL',
  'Lulu\'s': 'LuLu\'s Gulf Shores AL',
  'Lauria\'s by the Beach': 'Lauria\'s by the Beach Gulf Shores AL',
  'Big Beach Brewing Company': 'Big Beach Brewing Company Gulf Shores AL',
  'Pink Pony Pub': 'Pink Pony Pub Gulf Shores AL'
};

const unmatched = JSON.parse(fs.readFileSync('./consolidation/VENUES-UNMATCHED.json'));
const matched = JSON.parse(fs.readFileSync('./consolidation/VENUES-WITH-PLACE-IDS.json'));
const existingPlaceIds = JSON.parse(fs.readFileSync('./venue-place-ids.json'));

console.log('Unmatched venues: ' + unmatched.length);
console.log('Existing Place ID mappings: ' + existingPlaceIds.length + '\n');

// Try to match unmatched venues using the mapping and existing data
const newMatches = [];
const stillUnmatched = [];

unmatched.forEach(v => {
  const searchStr = venueMapping[v.venue_name];

  if (searchStr) {
    // Try to find in existing place IDs
    const existing = existingPlaceIds.find(p =>
      (p.name || '').toLowerCase() === (v.venue_name || '').toLowerCase()
    );

    if (existing) {
      // Extract the actual place ID from URL format
      // URLs like "!3m1!4b1!4m6!3m5!1s0x8890a80e22b6ed8b:0xb864d4709708c5db!8m2!3d30.309428!4d-87.5260498"
      // contain coordinates: 3d30.309428 (lat) and 4d-87.5260498 (lng)
      const latMatch = existing.place_id.match(/3d([-\d.]+)/);
      const lngMatch = existing.place_id.match(/4d([-\d.]+)/);

      newMatches.push({
        venue_name: v.venue_name,
        city: v.city,
        search_string: searchStr,
        place_id_url: existing.place_id,
        latitude: latMatch ? parseFloat(latMatch[1]) : null,
        longitude: lngMatch ? parseFloat(lngMatch[1]) : null,
        type: 'found_in_existing'
      });
    } else {
      stillUnmatched.push({
        venue_name: v.venue_name,
        city: v.city,
        search_string: searchStr,
        note: 'Needs manual Google lookup'
      });
    }
  } else {
    stillUnmatched.push({
      venue_name: v.venue_name,
      city: v.city,
      note: 'No mapping provided'
    });
  }
});

console.log('='.repeat(80));
console.log('RESULTS');
console.log('='.repeat(80));
console.log('New matches found: ' + newMatches.length);
console.log('Still unmatched: ' + stillUnmatched.length);
console.log('');
console.log('TOTAL VENUES WITH PLACE IDS: ' + (matched.length + newMatches.length) + '\n');

// Save consolidated venue data
const allVenues = [
  ...matched,
  ...newMatches.map(m => ({
    venue_name: m.venue_name,
    city: m.city,
    place_id: m.place_id_url,
    latitude: m.latitude,
    longitude: m.longitude,
    type: m.type
  }))
];

fs.writeFileSync('./consolidation/ALL-VENUES-WITH-PLACE-IDS.json', JSON.stringify(allVenues, null, 2));
fs.writeFileSync('./consolidation/VENUES-STILL-UNMATCHED.json', JSON.stringify(stillUnmatched, null, 2));

console.log('✓ All venues: consolidation/ALL-VENUES-WITH-PLACE-IDS.json (' + allVenues.length + ' total)');
console.log('✓ Still unmatched: consolidation/VENUES-STILL-UNMATCHED.json (' + stillUnmatched.length + ')');

if (stillUnmatched.length > 0) {
  console.log('\nRemaining to lookup manually:');
  stillUnmatched.slice(0, 5).forEach(v => {
    console.log('  - ' + v.venue_name + ': "' + (v.search_string || v.venue_name + ' ' + v.city) + '"');
  });
  if (stillUnmatched.length > 5) {
    console.log('  ... and ' + (stillUnmatched.length - 5) + ' more');
  }
}
