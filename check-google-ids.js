#!/usr/bin/env node
/**
 * Check if unmatched restaurants have Google place IDs
 */

const fs = require('fs');
const path = require('path');

const unmatchedPath = './UNMATCHED-RESTAURANTS.json';
const scrapedDir = './scraped-menus';

const unmatched = JSON.parse(fs.readFileSync(unmatchedPath, 'utf8'));

console.log(`🔍 Checking ${unmatched.length} unmatched restaurants for Google place IDs...\n`);

let withGoogleId = 0;
let withoutGoogleId = 0;
const found = [];
const notFound = [];

unmatched.forEach(rest => {
  const folderPath = path.join(scrapedDir, rest.folder);
  const rawPath = path.join(folderPath, 'raw.json');
  const dataPath = path.join(folderPath, 'data.json');

  let hasGoogle = false;
  let googleId = null;

  // Check raw.json
  if (fs.existsSync(rawPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

      // Search for place_id, placeId, google_id in various places
      if (raw.place_id) {
        googleId = raw.place_id;
        hasGoogle = true;
      } else if (raw.placeId) {
        googleId = raw.placeId;
        hasGoogle = true;
      } else if (raw.google_id) {
        googleId = raw.google_id;
        hasGoogle = true;
      }

      // Check in structured data
      if (!hasGoogle && raw.pages && Array.isArray(raw.pages)) {
        for (const page of raw.pages) {
          if (page.structuredData && Array.isArray(page.structuredData)) {
            for (const sd of page.structuredData) {
              if (sd['@graph']) {
                for (const item of sd['@graph']) {
                  if (item.isPartOf && item.isPartOf['@id']) {
                    const id = item.isPartOf['@id'];
                    if (id.includes('google') || id.includes('place')) {
                      googleId = id;
                      hasGoogle = true;
                      break;
                    }
                  }
                  if (item['@id'] && item['@id'].includes('google')) {
                    googleId = item['@id'];
                    hasGoogle = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  // Check data.json
  if (!hasGoogle && fs.existsSync(dataPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      if (data.place_id) {
        googleId = data.place_id;
        hasGoogle = true;
      }
      if (data.google_id) {
        googleId = data.google_id;
        hasGoogle = true;
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  if (hasGoogle && googleId) {
    withGoogleId++;
    found.push({
      name: rest.name,
      googleId: googleId,
      folder: rest.folder,
      menuItems: rest.menu_items
    });
  } else {
    withoutGoogleId++;
    notFound.push({
      name: rest.name,
      folder: rest.folder,
      menuItems: rest.menu_items,
      city: rest.city,
      phone: rest.phone
    });
  }
});

console.log(`📊 RESULTS\n`);
console.log(`With Google IDs:    ${withGoogleId}`);
console.log(`Without Google IDs: ${withoutGoogleId}`);
console.log(`\n═══════════════════════════════════════════════════════\n`);

if (found.length > 0) {
  console.log(`✅ RESTAURANTS WITH GOOGLE IDs (${found.length})\n`);
  found.slice(0, 20).forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.name}`);
    console.log(`   Google ID: ${r.googleId}`);
    console.log(`   Menu items: ${r.menuItems}\n`);
  });
  if (found.length > 20) {
    console.log(`... and ${found.length - 20} more\n`);
  }
}

console.log(`\n❌ RESTAURANTS WITHOUT GOOGLE IDs (${notFound.length})\n`);
console.log('These would need to be looked up via Google Maps API:\n');

notFound.slice(0, 15).forEach((r, idx) => {
  console.log(`${idx + 1}. ${r.name}`);
  if (r.city) console.log(`   City: ${r.city}`);
  if (r.phone) console.log(`   Phone: ${r.phone}`);
  console.log(`   Menu items: ${r.menuItems}\n`);
});

if (notFound.length > 15) {
  console.log(`... and ${notFound.length - 15} more\n`);
}

// Save results
fs.writeFileSync('./GOOGLE-ID-CHECK.json', JSON.stringify({
  summary: {
    with_google_id: withGoogleId,
    without_google_id: withoutGoogleId,
    total: unmatched.length
  },
  with_google_id: found,
  without_google_id: notFound
}, null, 2));

console.log(`\n✅ Results saved to GOOGLE-ID-CHECK.json\n`);
