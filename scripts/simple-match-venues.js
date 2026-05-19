#!/usr/bin/env node

const fs = require('fs');

console.log('='.repeat(80));
console.log('MATCH VENUES BY NAME TO GOOGLE BUSINESSES');
console.log('='.repeat(80) + '\n');

const venues = [
  { name: 'OSO at Bear Point Harbor', city: 'Orange Beach, AL' },
  { name: 'Barometer Waterfront Grille', city: 'Orange Beach, AL' },
  { name: 'Cobalt', city: 'Orange Beach, AL' },
  { name: 'CoastAL', city: 'Orange Beach, AL' },
  { name: 'Luna\'s Eat & Drink', city: 'Orange Beach, AL' },
  { name: 'The Red Haven Live', city: 'Orange Beach, AL' },
  { name: 'Angry Crab Shack', city: 'Orange Beach, AL' },
  { name: 'Tipsy Pelican Patio Bar', city: 'Orange Beach, AL' },
  { name: 'Tee Off at the Wharf @ Portside on Main', city: 'Orange Beach, AL' },
  { name: 'Perdido Beach Resort', city: 'Orange Beach, AL' },
  { name: 'Ginny Lane Bar and Grill', city: 'Orange Beach, AL' },
  { name: 'Tiki & Raw Bar by Barometer', city: 'Orange Beach, AL' },
  { name: 'GTs On The Bay', city: 'Orange Beach, AL' },
  { name: 'Shipp\'s Dockside Grill', city: 'Orange Beach, AL' },
  { name: 'Doc\'s Seafood and Steaks', city: 'Orange Beach, AL' },
  { name: 'Cosmo\'s Restaurant & Bar', city: 'Orange Beach, AL' },
  { name: 'Zeke\'s Restaurant', city: 'Orange Beach, AL' },
  { name: 'Tacky Jacks', city: 'Orange Beach, AL' },
  { name: 'The Undertow', city: 'Orange Beach, AL' },
  { name: 'Flora-Bama', city: 'Perdido Key, FL' },
  { name: 'Lulu\'s', city: 'Gulf Shores, AL' },
  { name: 'Lauria\'s by the Beach', city: 'Gulf Shores, AL' },
  { name: 'Big Beach Brewing Company', city: 'Gulf Shores, AL' },
  { name: 'Pink Pony Pub', city: 'Gulf Shores, AL' }
];

const googleBiz = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));

console.log('Venues to match: ' + venues.length);
console.log('Google businesses: ' + googleBiz.length + '\n');

// Build lookup by name
const googleByName = new Map();
googleBiz.forEach(g => {
  const name = (g.name || '').toLowerCase().trim();
  googleByName.set(name, g);
});

// Match
const matches = [];
const noMatch = [];

venues.forEach(v => {
  const vName = (v.name || '').toLowerCase().trim();
  const google = googleByName.get(vName);

  if (google) {
    matches.push({
      venue_name: v.name,
      city: v.city,
      place_id: google.place_id,
      google_name: google.name,
      address: google.address,
      phone: google.phone
    });
  } else {
    noMatch.push({
      venue_name: v.name,
      city: v.city
    });
  }
});

console.log('='.repeat(80));
console.log('RESULTS');
console.log('='.repeat(80));
console.log('Matched: ' + matches.length);
console.log('No match: ' + noMatch.length + '\n');

// Save
fs.writeFileSync('./consolidation/VENUES-MATCHED.json', JSON.stringify(matches, null, 2));
fs.writeFileSync('./consolidation/VENUES-NO-MATCH.json', JSON.stringify(noMatch, null, 2));

console.log('✓ consolidation/VENUES-MATCHED.json (' + matches.length + ')');
console.log('✓ consolidation/VENUES-NO-MATCH.json (' + noMatch.length + ')\n');

console.log('Matched venues:');
matches.forEach(m => {
  console.log('  ✓ ' + m.venue_name);
});

if (noMatch.length > 0) {
  console.log('\nNO MATCH:');
  noMatch.forEach(n => {
    console.log('  ✗ ' + n.venue_name);
  });
}
