#!/usr/bin/env node

const fs = require('fs');

console.log('='.repeat(80));
console.log('MATCH VENUES TO GOOGLE PLACES');
console.log('='.repeat(80) + '\n');

const venues = JSON.parse(fs.readFileSync('./venues.json'));
const googleBiz = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));

console.log('Venues: ' + venues.length);
console.log('Google Places: ' + googleBiz.length + '\n');

// Build Google lookup by name
const googleByName = new Map();
const googleByCity = new Map();

googleBiz.forEach(g => {
  const name = (g.name || '').toLowerCase().trim();
  const city = (g.city || '').toLowerCase().trim();

  googleByName.set(name, g);

  if (!googleByCity.has(city)) {
    googleByCity.set(city, []);
  }
  googleByCity.get(city).push(g);
});

// Match venues to Google
const matched = [];
const unmatched = [];

venues.forEach(v => {
  const vName = (v.name || '').toLowerCase().trim();
  const vCity = (v.city || '').toLowerCase().trim();

  // Exact match by name
  if (googleByName.has(vName)) {
    const g = googleByName.get(vName);
    matched.push({
      venue_name: v.name,
      city: v.city,
      place_id: g.place_id,
      type: 'exact_name_match'
    });
  } else {
    // Partial match by name within city
    const cityGoogle = googleByCity.get(vCity) || [];
    const partial = cityGoogle.find(g =>
      (g.name || '').toLowerCase().includes(vName.split(' ')[0])
    );

    if (partial) {
      matched.push({
        venue_name: v.name,
        city: v.city,
        place_id: partial.place_id,
        type: 'partial_name_match',
        google_name: partial.name
      });
    } else {
      unmatched.push({
        venue_name: v.name,
        city: v.city,
        note: 'No match found'
      });
    }
  }
});

console.log('='.repeat(80));
console.log('MATCH RESULTS');
console.log('='.repeat(80));
console.log('Matched: ' + matched.length);
console.log('Unmatched: ' + unmatched.length);
console.log('Match rate: ' + (matched.length / venues.length * 100).toFixed(1) + '%\n');

// Save results
fs.writeFileSync('./consolidation/VENUES-WITH-PLACE-IDS.json', JSON.stringify(matched, null, 2));
fs.writeFileSync('./consolidation/VENUES-UNMATCHED.json', JSON.stringify(unmatched, null, 2));

console.log('✓ Matched venues: consolidation/VENUES-WITH-PLACE-IDS.json');
console.log('✓ Unmatched venues: consolidation/VENUES-UNMATCHED.json');
console.log('\nUnmatched venues (need manual lookup):');
unmatched.slice(0, 10).forEach(v => {
  console.log('  - ' + v.venue_name + ' (' + v.city + ')');
});
if (unmatched.length > 10) {
  console.log('  ... and ' + (unmatched.length - 10) + ' more');
}
