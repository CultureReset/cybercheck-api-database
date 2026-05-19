#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

if (API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
  console.error('❌ ERROR: Set GOOGLE_MAPS_API_KEY environment variable');
  console.error('Example: export GOOGLE_MAPS_API_KEY=AIzaSy...');
  process.exit(1);
}

const googleNames = JSON.parse(fs.readFileSync('./consolidation/GOOGLE-NAMES-FOR-API.json'));
const names = Object.values(googleNames);

console.log('='.repeat(80));
console.log('SEARCH GOOGLE NAMES VIA MAPS API');
console.log('='.repeat(80) + '\n');
console.log('Searching: ' + names.length + ' venues\n');

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
              formatted_address: result.results[0].formatted_address
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
  const results = [];
  
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    process.stdout.write(`[${i + 1}/${names.length}] ${name.padEnd(50)} → `);

    try {
      const result = await searchPlace(name);
      if (result) {
        results.push({
          google_name: name,
          place_id: result.place_id,
          confirmed_name: result.name,
          address: result.formatted_address
        });
        console.log('✓ ' + result.place_id);
      } else {
        console.log('✗ NOT FOUND');
      }
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      console.log('ERROR: ' + error.message.split('\n')[0]);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESULTS: ' + results.length + '/' + names.length);
  console.log('='.repeat(80) + '\n');

  fs.writeFileSync('./consolidation/GOOGLE-NAMES-WITH-PLACE-IDS.json', JSON.stringify(results, null, 2));
  console.log('✓ consolidation/GOOGLE-NAMES-WITH-PLACE-IDS.json');
})();
