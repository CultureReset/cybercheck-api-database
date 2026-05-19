#!/usr/bin/env node
/**
 * Extract Google Place IDs for Specific Venues
 * Takes a list of venue names and finds their Google Place IDs
 *
 * Usage:
 *   node agents/extract-venue-ids.js venues.json
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');

let puppeteer, StealthPlugin;
try {
    puppeteer = require('puppeteer-extra');
    StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
} catch (e) {
    console.error('❌ Missing packages. Run: npm install puppeteer-extra puppeteer-extra-plugin-stealth');
    process.exit(1);
}

const VENUES_FILE = process.argv[2] || 'venues.json';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function extractVenueIds() {
    // Load or create venues list
    let venues = [];

    if (fs.existsSync(VENUES_FILE)) {
        const data = JSON.parse(fs.readFileSync(VENUES_FILE, 'utf8'));
        venues = Array.isArray(data) ? data : data.venues || [];
    } else {
        // Create default venues file with the data provided
        venues = [
            // Orange Beach
            { name: 'OSO at Bear Point Harbor', city: 'Orange Beach' },
            { name: 'Barometer Waterfront Grille', city: 'Orange Beach' },
            { name: 'Cobalt', city: 'Orange Beach' },
            { name: 'CoastAL', city: 'Orange Beach' },
            { name: "Luna's Eat & Drink", city: 'Orange Beach' },
            { name: 'The Red Haven Live', city: 'Orange Beach' },
            { name: 'Angry Crab Shack', city: 'Orange Beach' },
            { name: 'Tipsy Pelican Patio Bar', city: 'Orange Beach' },
            { name: 'Tee Off at the Wharf @ Portside on Main', city: 'Orange Beach' },
            { name: 'Perdido Beach Resort', city: 'Orange Beach' },
            { name: 'Ginny Lane Bar and Grill', city: 'Orange Beach' },
            { name: 'Tiki & Raw Bar by Barometer', city: 'Orange Beach' },
            { name: 'GTs On The Bay', city: 'Orange Beach' },
            { name: "Shipp's Dockside Grill", city: 'Orange Beach' },
            { name: "Doc's Seafood and Steaks", city: 'Orange Beach' },
            { name: "Cosmo's Restaurant & Bar", city: 'Orange Beach' },
            { name: "Zeke's Restaurant", city: 'Orange Beach' },
            { name: 'Tacky Jacks', city: 'Orange Beach' },
            { name: 'The Undertow', city: 'Orange Beach' },
            { name: 'Flora-Bama', city: 'Orange Beach' },

            // Gulf Shores
            { name: "Lulu's", city: 'Gulf Shores' },
            { name: "Lauria's by the Beach", city: 'Gulf Shores' },
            { name: 'Big Beach Brewing Company', city: 'Gulf Shores' },
            { name: 'Pink Pony Pub', city: 'Gulf Shores' },
            { name: 'The Hangout', city: 'Gulf Shores' },
            { name: "Papa Rocco's", city: 'Gulf Shores' },
            { name: 'The Sloop', city: 'Gulf Shores' },
            { name: 'The Cove Bar and Grill', city: 'Gulf Shores' },
            { name: 'Icehouse Tap Room', city: 'Gulf Shores' },
            { name: 'Woodside Restaurant', city: 'Gulf Shores' },
            { name: 'Tacky Jacks', city: 'Gulf Shores' },

            // Perdido Key
            { name: 'Salty Pearl Raw Bar', city: 'Perdido Key' },
            { name: 'Flora-Bama Ole River Grill', city: 'Perdido Key' },
            { name: 'Flora-Bama', city: 'Perdido Key' },
            { name: 'The Point Restaurant', city: 'Perdido Key' },
            { name: 'Purple Parrot Beach Bar & Grill', city: 'Perdido Key' },
            { name: "Bushwacker's Landing", city: 'Perdido Key' },
            { name: "Hub Stacey's at the Point", city: 'Perdido Key' },
            { name: 'Perdido Key Sports Bar', city: 'Perdido Key' },
            { name: 'Flora-Bama Yacht Club', city: 'Perdido Key' },

            // Pensacola Beach
            { name: 'Crabs on the Beach', city: 'Pensacola Beach' },
            { name: 'Paradise Bar & Grill', city: 'Pensacola Beach' },
            { name: 'The Sandbar Sunset Bar & Grill', city: 'Pensacola Beach' },
            { name: 'Pensacola Beach Elks Lodge 497', city: 'Pensacola Beach' },
            { name: 'The Salty Rose Beach Bar & Grill', city: 'Pensacola Beach' },
            { name: 'Bounce Beach', city: 'Pensacola Beach' },
            { name: "Bamboo Willie's Beachside Bar", city: 'Pensacola Beach' },
            { name: 'The Break Beach Bar', city: 'Pensacola Beach' },
            { name: 'Flounders Chowder House', city: 'Pensacola Beach' },
            { name: 'Sandshaker Lounge', city: 'Pensacola Beach' },

            // Pensacola
            { name: "Calvert's in the Heights", city: 'Pensacola' },
            { name: "Hub Stacey's Downtown", city: 'Pensacola' },
            { name: 'Moonshine Saloon', city: 'Pensacola' },
            { name: "Wild Greg's Saloon", city: 'Pensacola' },
            { name: 'Seville Quarter', city: 'Pensacola' },

            // Foley
            { name: 'Fraternal Order Of Eagles', city: 'Foley' },
            { name: "Moe's Original BBQ", city: 'Foley' },
            { name: 'Groovy Goat', city: 'Foley' },
            { name: 'American Legion Post 99', city: 'Foley' },
            { name: 'The Galley on the River', city: 'Foley' },

            // Navarre
            { name: 'Emerald Waterfront', city: 'Navarre' },
            { name: "Andy D's", city: 'Navarre' },
            { name: "Juana's Pagodas", city: 'Navarre' },

            // Fort Morgan
            { name: 'Tacky Jacks', city: 'Fort Morgan' },

            // Lillian
            { name: "Johnny B's Front Porch", city: 'Lillian' },
            { name: 'Lillian Community Club', city: 'Lillian' },

            // Gulf Breeze
            { name: 'The Country Gym', city: 'Gulf Breeze' }
        ];

        // Save as venues.json for reference
        fs.writeFileSync(VENUES_FILE, JSON.stringify(venues, null, 2));
        console.log(`Created ${VENUES_FILE} with ${venues.length} venues`);
    }

    console.log(`\n🏢 Venue Google Place ID Extractor`);
    console.log(`📍 Total Venues: ${venues.length}\n`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const results = [];
    const failures = [];

    for (let i = 0; i < venues.length; i++) {
        const venue = venues[i];

        try {
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 900 });

            // Search for venue by name only first, then narrow by city if needed
            const searchQuery = `${venue.name}`;
            const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

            console.log(`   Searching: "${searchQuery}"`);
            await page.goto(mapsUrl, { waitUntil: 'networkidle2', timeout: 15000 });

            // Wait for results panel to load
            await page.waitForSelector('div[role="main"]', { timeout: 5000 }).catch(() => {});
            await sleep(2000);

            // Click on first result to load its details
            await page.evaluate(() => {
                const firstPlace = document.querySelector('div[data-cid]');
                if (firstPlace) {
                    firstPlace.click();
                }
            }).catch(() => {});

            await sleep(1500);

            // Extract place ID - multiple methods
            const placeInfo = await page.evaluate(() => {
                const result = {};

                // Method 1: Direct data-cid from DOM
                const allPlaces = document.querySelectorAll('div[data-cid]');
                if (allPlaces.length > 0) {
                    result.place_id = allPlaces[0].getAttribute('data-cid');
                    const nameEl = allPlaces[0].querySelector('div[role="button"]');
                    if (nameEl) result.name = nameEl.textContent.trim();
                }

                // Method 2: From URL after clicking (most reliable for details page)
                const url = window.location.href;

                // Extract from data parameter
                const dataMatch = url.match(/!1s([A-Za-z0-9_-]+)/);
                if (dataMatch) result.place_id = dataMatch[1];

                // Extract from standard place URL format
                if (!result.place_id) {
                    const placeMatch = url.match(/\/place\/([^\/\?]+)\//);
                    if (placeMatch) {
                        result.place_id_url = placeMatch[1];
                    }
                }

                // Extract CID from any div with data-cid visible on page
                const cidElements = document.querySelectorAll('[data-cid]');
                if (cidElements.length > 0 && !result.place_id) {
                    result.place_id = cidElements[0].getAttribute('data-cid');
                }

                return result;
            });

            if (placeInfo.place_id) {
                const resultObj = {
                    name: venue.name,
                    city: venue.city,
                    place_id: placeInfo.place_id,
                    display_name: placeInfo.name || venue.name,
                    rating: placeInfo.rating || '',
                    searched_at: new Date().toISOString()
                };
                results.push(resultObj);
                console.log(`✅ [${i + 1}/${venues.length}] ${venue.name} - ID: ${placeInfo.place_id}`);
            } else if (placeInfo.place_id_url) {
                const resultObj = {
                    name: venue.name,
                    city: venue.city,
                    place_id: placeInfo.place_id_url,
                    display_name: placeInfo.name || venue.name,
                    rating: placeInfo.rating || '',
                    searched_at: new Date().toISOString()
                };
                results.push(resultObj);
                console.log(`✅ [${i + 1}/${venues.length}] ${venue.name} - ID: ${placeInfo.place_id_url} (from URL)`);
            } else {
                // Retry with city + state
                console.log(`   Retrying with city...`);
                const retryUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${venue.name} ${venue.city} AL`)}`;
                try {
                    await page.goto(retryUrl, { waitUntil: 'networkidle2', timeout: 10000 });
                    await sleep(1500);

                    const retryInfo = await page.evaluate(() => {
                        const result = {};
                        const cidElements = document.querySelectorAll('[data-cid]');
                        if (cidElements.length > 0) {
                            result.place_id = cidElements[0].getAttribute('data-cid');
                        }
                        const url = window.location.href;
                        const dataMatch = url.match(/!1s([A-Za-z0-9_-]+)/);
                        if (dataMatch) result.place_id = dataMatch[1];
                        return result;
                    });

                    if (retryInfo.place_id) {
                        results.push({
                            name: venue.name,
                            city: venue.city,
                            place_id: retryInfo.place_id,
                            display_name: venue.name,
                            searched_at: new Date().toISOString()
                        });
                        console.log(`✅ [${i + 1}/${venues.length}] ${venue.name} - ID: ${retryInfo.place_id} (retry)`);
                    } else {
                        failures.push({ name: venue.name, city: venue.city, reason: 'No place ID found (even on retry)' });
                        console.log(`⚠️  [${i + 1}/${venues.length}] ${venue.name} - No place ID (retry also failed)`);
                    }
                } catch (retryErr) {
                    failures.push({ name: venue.name, city: venue.city, reason: 'Retry error: ' + retryErr.message });
                    console.log(`⚠️  [${i + 1}/${venues.length}] ${venue.name} - Retry error`);
                }
            }

            await page.close();
            await sleep(500);

        } catch (error) {
            failures.push({ name: venue.name, city: venue.city, reason: error.message });
            console.log(`❌ [${i + 1}/${venues.length}] ${venue.name} - ${error.message}`);
        }
    }

    await browser.close();

    // Save results
    const outputFile = path.join(__dirname, '../venue-place-ids.json');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

    console.log(`\n✅ COMPLETE`);
    console.log(`✅ Found: ${results.length}`);
    console.log(`❌ Failed: ${failures.length}`);
    console.log(`\n💾 Saved to: venue-place-ids.json`);
    console.log(`\n📌 Next: node agents/pull-all-google-api.js --source venue-place-ids.json`);

    if (failures.length > 0) {
        console.log(`\n⚠️  Failed venues:`);
        failures.forEach(f => console.log(`  - ${f.name} (${f.city}): ${f.reason}`));
    }
}

extractVenueIds().catch(e => {
    console.error('💥 Fatal error:', e.message);
    process.exit(1);
});
