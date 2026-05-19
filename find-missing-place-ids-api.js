require('dotenv').config();
const https = require('https');

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_API_KEY) {
  console.log('❌ GOOGLE_PLACES_API_KEY not set in .env');
  console.log('Get an API key: https://console.cloud.google.com/');
  process.exit(1);
}

const restaurants = [
  { name: 'Rotolos', location: 'Alabama' },
  { name: 'Sea-N-Suds', location: 'Gulf Shores, AL' },
  { name: 'Mudbugs Pub', location: 'Gulf Shores, AL' },
  { name: 'OHANA Poke Teriyaki', location: 'Spanish Fort, AL' },
  { name: "Vinny's Pizzeria", location: 'Orange Beach, AL' },
  { name: 'Flora-Bama Lounge', location: 'Orange Beach, AL' }
];

async function searchPlace(query) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&key=${GOOGLE_API_KEY}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function getPlaceDetails(placeId) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website&key=${GOOGLE_API_KEY}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function findRestaurants() {
  console.log('🔍 SEARCHING GOOGLE MAPS FOR MISSING PLACE IDs\n');
  console.log('═══════════════════════════════════════════════════════\n');

  const results = [];

  for (const restaurant of restaurants) {
    console.log(`🔎 Searching for: ${restaurant.name} (${restaurant.location})...`);

    try {
      const searchResult = await searchPlace(`${restaurant.name} ${restaurant.location}`);

      if (searchResult.candidates && searchResult.candidates.length > 0) {
        const place = searchResult.candidates[0];
        const details = await getPlaceDetails(place.place_id);

        console.log(`✅ Found: ${details.result.name}`);
        console.log(`   Place ID: ${place.place_id}`);
        console.log(`   Address: ${details.result.formatted_address}`);
        console.log(`   Phone: ${details.result.formatted_phone_number || 'N/A'}`);
        console.log();

        results.push({
          search: restaurant.name,
          found: details.result.name,
          place_id: place.place_id,
          address: details.result.formatted_address,
          phone: details.result.formatted_phone_number || '',
          website: details.result.website || ''
        });
      } else {
        console.log(`⚠️  No results found\n`);
      }

      // Rate limit: wait 100ms between requests
      await new Promise(r => setTimeout(r, 100));

    } catch (error) {
      console.log(`❌ Error: ${error.message}\n`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
  console.log('📊 RESULTS\n');

  results.forEach(r => {
    console.log(`${r.search}`);
    console.log(`  Place ID: ${r.place_id}`);
  });

  // Save results
  const fs = require('fs');
  fs.writeFileSync('./MISSING-PLACE-IDS-FOUND.json', JSON.stringify(results, null, 2));
  console.log('\n✅ Results saved to MISSING-PLACE-IDS-FOUND.json');
}

findRestaurants().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
