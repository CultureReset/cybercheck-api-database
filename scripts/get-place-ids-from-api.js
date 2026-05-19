#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

// SET YOUR GOOGLE MAPS API KEY HERE
const API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

if (API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
  console.error('❌ ERROR: Add your Google Maps API key to the script');
  console.error('Get it from: https://console.cloud.google.com/');
  process.exit(1);
}

const venues = JSON.parse(fs.readFileSync('./consolidation/VENUE-MAPPING.json'));

console.log('='.repeat(80));
console.log('GET REAL GOOGLE PLACE IDs FROM GOOGLE MAPS API');
console.log('='.repeat(80) + '\n');

console.log('Venues to lookup: ' + venues.length);
console.log('API Key: ' + (API_KEY.slice(0, 10) + '***') + '\n');

// Search Google Places API
async function searchPlace(query) {
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

// Process all venues
(async () => {
  const results = [];
  const notFound = [];

  for (let i = 0; i < venues.length; i++) {
    const venue = venues[i];
    process.stdout.write(`[${i + 1}/${venues.length}] ${venue.padEnd(50)} → `);

    try {
      // Add "Orange Beach Alabama" or "Gulf Shores Alabama" to search
      let searchQuery = venue;
      if (!venue.toLowerCase().includes('pensacola') &&
          !venue.toLowerCase().includes('foley') &&
          !venue.toLowerCase().includes('navarre')) {
        searchQuery += ' Alabama';
      }

      const result = await searchPlace(searchQuery);

      if (result) {
        results.push({
          venue_name: venue,
          google_name: result.name,
          place_id: result.place_id,
          address: result.formatted_address,
          rating: result.rating
        });
        console.log('✓ ' + result.place_id);
      } else {
        notFound.push(venue);
        console.log('✗ NOT FOUND');
      }

      // Delay to avoid API rate limiting (100ms between requests)
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.log('ERROR: ' + error.message);
      notFound.push(venue);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));
  console.log('Found: ' + results.length);
  console.log('Not found: ' + notFound.length + '\n');

  // Save results
  fs.writeFileSync('./consolidation/VENUE-PLACE-IDS-API.json', JSON.stringify(results, null, 2));
  fs.writeFileSync('./consolidation/VENUE-NOT-FOUND-API.json', JSON.stringify(notFound, null, 2));

  console.log('✓ consolidation/VENUE-PLACE-IDs-API.json (' + results.length + ' venues)');
  console.log('✓ consolidation/VENUE-NOT-FOUND-API.json (' + notFound.length + ' not found)\n');

  if (notFound.length > 0) {
    console.log('Not found:');
    notFound.forEach(v => console.log('  - ' + v));
  }
})();
