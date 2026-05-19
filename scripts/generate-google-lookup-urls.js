#!/usr/bin/env node

const fs = require('fs');

// Your venue list
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

console.log('='.repeat(80));
console.log('GENERATE GOOGLE MAPS LOOKUP LINKS');
console.log('='.repeat(80) + '\n');

const lookupData = venues.map((v, i) => {
  const searchQuery = encodeURIComponent(v.name + ' ' + v.city);
  const googleUrl = `https://www.google.com/maps/search/${searchQuery}`;

  return {
    number: i + 1,
    venue: v.name,
    city: v.city,
    search_url: googleUrl,
    instruction: 'Click link, find venue, copy Place ID from URL (ChIJ...)'
  };
});

// Save as JSON
fs.writeFileSync('./consolidation/VENUES-LOOKUP-URLS.json', JSON.stringify(lookupData, null, 2));

// Also create a markdown file with clickable links
let markdown = '# Venue Google Maps Lookup Links\n\n';
markdown += 'Click each link to find the venue. Copy the Place ID from the URL (the part that starts with ChIJ...).\n\n';

lookupData.forEach(item => {
  markdown += `${item.number}. **${item.venue}** (${item.city})\n`;
  markdown += `   [Open in Google Maps](${item.search_url})\n\n`;
});

fs.writeFileSync('./consolidation/VENUES-LOOKUP-LINKS.md', markdown);

console.log('Generated lookup files for ' + venues.length + ' venues\n');
console.log('Files created:');
console.log('  ✓ consolidation/VENUES-LOOKUP-URLS.json');
console.log('  ✓ consolidation/VENUES-LOOKUP-LINKS.md');
console.log('\nNext steps:');
console.log('1. Open consolidation/VENUES-LOOKUP-LINKS.md');
console.log('2. Click each Google Maps link');
console.log('3. Copy the Place ID (ChIJ...) from the URL');
console.log('4. Add to lookup results\n');

// Show sample
console.log('Sample link:');
console.log(lookupData[0].search_url);
