#!/usr/bin/env node

const fs = require('fs');

const unmatched = [
  { name: 'OSO at Bear Point Harbor', city: 'Orange Beach' },
  { name: 'Cobalt', city: 'Orange Beach' },
  { name: 'CoastAL', city: 'Orange Beach' },
  { name: 'Tipsy Pelican Patio Bar', city: 'Orange Beach' },
  { name: 'Tee Off at the Wharf @ Portside on Main', city: 'Orange Beach' },
  { name: 'Tiki & Raw Bar by Barometer', city: 'Orange Beach' },
  { name: 'Shipp\'s Dockside Grill', city: 'Orange Beach' },
  { name: 'Doc\'s Seafood and Steaks', city: 'Orange Beach' },
  { name: 'Tacky Jacks', city: 'Orange Beach' },
  { name: 'Lulu\'s', city: 'Gulf Shores' },
  { name: 'Big Beach Brewing Company', city: 'Gulf Shores' }
];

const googleBiz = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));

console.log('='.repeat(80));
console.log('MATCH BY NAME + CITY');
console.log('='.repeat(80) + '\n');

const matches = [];
const needsReview = [];

unmatched.forEach(v => {
  const vName = (v.name || '').toLowerCase().trim();
  const vCity = (v.city || '').toLowerCase().trim();

  // Find in Google by name keyword + city
  const keywords = vName.split(' ').filter(w => w.length > 3);

  const candidates = googleBiz.filter(g => {
    const gName = (g.name || '').toLowerCase();
    const gCity = (g.city || '').toLowerCase();

    const nameMatch = keywords.some(k => gName.includes(k));
    const cityMatch = gCity.includes(vCity) || vCity.includes(gCity.split(' ')[0]);

    return nameMatch && cityMatch;
  });

  if (candidates.length === 1) {
    // Clear match
    matches.push({
      venue_name: v.name,
      city: v.city,
      google_name: candidates[0].name,
      place_id: candidates[0].place_id,
      address: candidates[0].address,
      phone: candidates[0].phone
    });
  } else if (candidates.length > 1) {
    // Multiple options - needs review
    needsReview.push({
      venue_name: v.name,
      city: v.city,
      options: candidates.map(c => ({
        name: c.name,
        place_id: c.place_id,
        address: c.address,
        city: c.city
      }))
    });
  } else {
    // No match found
    needsReview.push({
      venue_name: v.name,
      city: v.city,
      options: []
    });
  }
});

console.log('Clear matches: ' + matches.length);
console.log('Need review: ' + needsReview.length + '\n');

// Show clear matches
if (matches.length > 0) {
  console.log('✓ MATCHED:');
  matches.forEach(m => {
    console.log('  ' + m.venue_name + ' → ' + m.google_name);
  });
  console.log('');
}

// Show needs review
if (needsReview.length > 0) {
  console.log('⚠ NEEDS REVIEW:');
  needsReview.forEach(nr => {
    console.log('\n  ' + nr.venue_name + ' (' + nr.city + ')');
    if (nr.options.length === 0) {
      console.log('    No matches found');
    } else {
      nr.options.forEach((opt, i) => {
        console.log('    ' + (i+1) + '. ' + opt.name + ' - ' + opt.city);
      });
    }
  });
}

// Save results
fs.writeFileSync('./consolidation/VENUES-EXACT-MATCH.json', JSON.stringify(matches, null, 2));
fs.writeFileSync('./consolidation/VENUES-NEEDS-REVIEW.json', JSON.stringify(needsReview, null, 2));

console.log('\n' + '='.repeat(80));
console.log('✓ consolidation/VENUES-EXACT-MATCH.json (' + matches.length + ')');
console.log('✓ consolidation/VENUES-NEEDS-REVIEW.json (' + needsReview.length + ')');
