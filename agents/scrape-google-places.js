#!/usr/bin/env node

/**
 * Google Places API Scraper
 * Pulls comprehensive venue/business data for Gulf Shores/Orange Beach area
 *
 * SETUP:
 * 1. Get API key: https://cloud.google.com/docs/authentication/api-keys
 * 2. Enable Places API in Google Cloud Console
 * 3. Set environment variable: export GOOGLE_PLACES_API_KEY="your-key"
 * 4. Run: node agents/scrape-google-places.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('❌ ERROR: GOOGLE_PLACES_API_KEY not set');
  console.error('Set it with: export GOOGLE_PLACES_API_KEY="your-key"');
  process.exit(1);
}

// Search coordinates for Gulf Shores / Orange Beach area
const SEARCH_LOCATIONS = [
  { name: 'Orange Beach, AL', lat: 30.2696, lng: -87.5631, radius: 5000 },
  { name: 'Gulf Shores, AL', lat: 30.2536, lng: -87.7175, radius: 5000 },
  { name: 'Fort Morgan, AL', lat: 30.2378, lng: -87.8764, radius: 5000 },
  { name: 'Pensacola Beach, FL', lat: 30.3413, lng: -87.1929, radius: 5000 }
];

// Search types/keywords for comprehensive coverage
const SEARCH_TYPES = [
  'restaurant',
  'bar',
  'cafe',
  'hotel',
  'lodging',
  'attraction',
  'activity',
  'museum',
  'beach',
  'park',
  'shopping_mall',
  'store',
  'spa',
  'gym',
  'beach_resort',
  'boat_rental',
  'sports_complex',
  'entertainment',
  'nightlife',
  'tour_operator'
];

const SEARCH_KEYWORDS = [
  'restaurant',
  'bar',
  'coffee',
  'hotel',
  'vacation rental',
  'activity',
  'tour',
  'water sports',
  'fishing',
  'boat rental',
  'jet ski',
  'parasailing',
  'shopping',
  'spa',
  'spa resort',
  'beach club',
  'golf',
  'fitness',
  'brewery',
  'club',
  'lounge',
  'seafood',
  'steakhouse',
  'pizza',
  'salon',
  'hair',
  'retail',
  'gift shop',
  'souvenir',
  'entertainment venue',
  'live music',
  'karaoke',
  'concert',
  'events',
  'vacation homes',
  'condos',
  'dolphin cruise',
  'fishing charter',
  'diving',
  'snorkeling',
  'paddleboarding',
  'kayaking',
  'beach bar',
  'sunset cruise'
];

let allPlaces = new Map(); // Using Map to dedupe by place_id
let requestCount = 0;
let totalResults = 0;

function makeRequest(url) {
  return new Promise((resolve, reject) => {
    setTimeout(() => { // Rate limiting: 1 request per 100ms
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            requestCount++;

            if (json.error_message) {
              console.error('❌ API Error:', json.error_message);
              reject(new Error(json.error_message));
            } else {
              resolve(json);
            }
          } catch(e) {
            reject(e);
          }
        });
      }).on('error', reject);
    }, 100);
  });
}

async function searchNearby(location, type) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
      `location=${location.lat},${location.lng}` +
      `&radius=${location.radius}` +
      `&type=${type}` +
      `&key=${API_KEY}`;

    const response = await makeRequest(url);

    if (response.results) {
      response.results.forEach(place => {
        if (!allPlaces.has(place.place_id)) {
          allPlaces.set(place.place_id, {
            ...place,
            added_from: type,
            location_city: location.name
          });
          totalResults++;
        }
      });

      // Handle pagination
      if (response.next_page_token) {
        console.log(`  ➜ More results available for ${location.name} / ${type}...`);
        await new Promise(r => setTimeout(r, 2000)); // Wait 2s before next page
        return searchNearbyPageToken(response.next_page_token);
      }
    }

    return response.results ? response.results.length : 0;
  } catch(e) {
    console.error(`  ❌ Error searching ${location.name} for ${type}:`, e.message);
    return 0;
  }
}

async function searchNearbyPageToken(pageToken) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
      `page_token=${pageToken}` +
      `&key=${API_KEY}`;

    const response = await makeRequest(url);

    if (response.results) {
      response.results.forEach(place => {
        if (!allPlaces.has(place.place_id)) {
          allPlaces.set(place.place_id, place);
          totalResults++;
        }
      });
    }

    if (response.next_page_token) {
      await new Promise(r => setTimeout(r, 2000));
      return searchNearbyPageToken(response.next_page_token);
    }
  } catch(e) {
    console.error('  ❌ Error fetching next page:', e.message);
  }
}

async function searchText(location, keyword) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
      `query=${encodeURIComponent(keyword + ' in ' + location.name)}` +
      `&key=${API_KEY}`;

    const response = await makeRequest(url);

    if (response.results) {
      response.results.forEach(place => {
        if (!allPlaces.has(place.place_id)) {
          allPlaces.set(place.place_id, {
            ...place,
            added_from: 'text:' + keyword,
            location_city: location.name
          });
          totalResults++;
        }
      });

      if (response.next_page_token) {
        console.log(`  ➜ More results for "${keyword}"...`);
        await new Promise(r => setTimeout(r, 2000));
        return searchTextPageToken(response.next_page_token);
      }
    }

    return response.results ? response.results.length : 0;
  } catch(e) {
    console.error(`  ❌ Error searching "${keyword}":`, e.message);
    return 0;
  }
}

async function searchTextPageToken(pageToken) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
      `page_token=${pageToken}` +
      `&key=${API_KEY}`;

    const response = await makeRequest(url);

    if (response.results) {
      response.results.forEach(place => {
        if (!allPlaces.has(place.place_id)) {
          allPlaces.set(place.place_id, place);
          totalResults++;
        }
      });
    }

    if (response.next_page_token) {
      await new Promise(r => setTimeout(r, 2000));
      return searchTextPageToken(response.next_page_token);
    }
  } catch(e) {
    console.error('  ❌ Error fetching next page:', e.message);
  }
}

async function getPlaceDetails(placeId) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?` +
      `place_id=${placeId}` +
      `&fields=name,address_component,formatted_address,geometry,opening_hours,type,price_level,rating,review,url,website,phone,formatted_phone_number,photos,business_status` +
      `&key=${API_KEY}`;

    const response = await makeRequest(url);
    return response.result || null;
  } catch(e) {
    console.error(`  ❌ Error getting details for ${placeId}:`, e.message);
    return null;
  }
}

async function enrichPlaces() {
  console.log('\n📊 Enriching place details...\n');

  const places = Array.from(allPlaces.values());
  const enriched = [];
  let completed = 0;

  for (const place of places) {
    try {
      const details = await getPlaceDetails(place.place_id);
      if (details) {
        enriched.push({
          ...place,
          ...details,
          enriched_at: new Date().toISOString()
        });
      } else {
        enriched.push(place);
      }

      completed++;
      if (completed % 10 === 0) {
        console.log(`  ✓ Enriched ${completed}/${places.length}...`);
      }
    } catch(e) {
      enriched.push(place);
    }
  }

  return enriched;
}

async function run() {
  console.log('🗺️  GOOGLE PLACES SCRAPER');
  console.log('═'.repeat(70));
  console.log(`API Key: ${API_KEY.slice(0, 10)}...`);
  console.log(`Locations: ${SEARCH_LOCATIONS.length}`);
  console.log(`Search types: ${SEARCH_TYPES.length}`);
  console.log(`Keywords: ${SEARCH_KEYWORDS.length}`);
  console.log('═'.repeat(70));
  console.log('');

  // Phase 1: Nearby Search by Type
  console.log('📍 PHASE 1: Nearby Search by Type...\n');
  for (const location of SEARCH_LOCATIONS) {
    console.log(`\n${location.name}:`);
    for (const type of SEARCH_TYPES.slice(0, 8)) { // Limit to avoid rate limits
      const count = await searchNearby(location, type);
      console.log(`  • ${type}: +${count || 0} places`);
    }
  }

  console.log(`\n✓ Total unique places after Phase 1: ${allPlaces.size}\n`);

  // Phase 2: Text Search by Keywords
  console.log('🔍 PHASE 2: Text Search by Keywords...\n');
  for (const keyword of SEARCH_KEYWORDS.slice(0, 20)) { // Limit to avoid rate limits
    const count = await searchText(SEARCH_LOCATIONS[0], keyword);
    console.log(`  • "${keyword}": +${count || 0}`);
  }

  console.log(`\n✓ Total unique places after Phase 2: ${allPlaces.size}\n`);

  // Phase 3: Enrich with details
  const enriched = await enrichPlaces();

  // Save results
  console.log('\n💾 Saving results...\n');
  const output = {
    scraped_at: new Date().toISOString(),
    api_requests: requestCount,
    total_unique_places: enriched.length,
    locations: SEARCH_LOCATIONS.map(l => l.name),
    data: enriched
  };

  const filename = `google-places-scrape-${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(filename, JSON.stringify(output, null, 2));

  console.log(`✅ Saved: ${filename}`);
  console.log(`📊 Total places: ${enriched.length}`);
  console.log(`📡 API requests: ${requestCount}`);
  console.log('');
  console.log('Done!');
}

run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
