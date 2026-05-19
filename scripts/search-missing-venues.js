#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

if (API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
  console.error('❌ ERROR: Set GOOGLE_MAPS_API_KEY environment variable');
  console.error('Example: export GOOGLE_MAPS_API_KEY=AIzaSy...');
  process.exit(1);
}

const missing = JSON.parse(fs.readFileSync('./consolidation/VENUES-ACTUALLY-MISSING.json'));

console.log('='.repeat(80));
console.log('SEARCH MISSING VENUES VIA MAPS API');
console.log('='.repeat(80) + '\n');
console.log('Searching: ' + missing.length + ' venues\n');

function searchPlace(query) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${API_KEY}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.results && result.results.length > 0) {
            resolve({
              name: result.results[0].name,
              place_id: result.results[0].place_id,
              formatted_address: result.results[0].formatted_address,
              rating: result.results[0].rating
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  const found = [];
  const notFound = [];

  for (let i = 0; i < missing.length; i++) {
    const venue = missing[i];
    process.stdout.write(`[${i + 1}/${missing.length}] ${venue.padEnd(50)} → `);

    try {
      const result = await searchPlace(venue);
      if (result) {
        found.push({
          venue_name: venue,
          place_id: result.place_id,
          google_name: result.name,
          address: result.formatted_address,
          rating: result.rating
        });
        console.log('✓ ' + result.place_id);
      } else {
        notFound.push(venue);
        console.log('✗ NOT FOUND');
      }
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.log('ERROR: ' + error.message.split('\n')[0]);
      notFound.push(venue);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));
  console.log('Found: ' + found.length);
  console.log('Not found: ' + notFound.length);
  console.log('Success rate: ' + (found.length / missing.length * 100).toFixed(1) + '%\n');

  fs.writeFileSync('./consolidation/MISSING-VENUES-FOUND.json', JSON.stringify(found, null, 2));
  fs.writeFileSync('./consolidation/MISSING-VENUES-NOT-FOUND.json', JSON.stringify(notFound, null, 2));

  console.log('✓ consolidation/MISSING-VENUES-FOUND.json (' + found.length + ')');
  console.log('✓ consolidation/MISSING-VENUES-NOT-FOUND.json (' + notFound.length + ')');
})();
