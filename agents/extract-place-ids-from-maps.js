#!/usr/bin/env node
/**
 * Extract Google Place IDs from Google Maps
 * Searches Google Maps for businesses in a location and extracts place IDs
 * Output can feed directly into pull-all-google-api.js
 *
 * Usage:
 *   node agents/extract-place-ids-from-maps.js "Orange Beach, AL" "restaurants"
 *   node agents/extract-place-ids-from-maps.js "Gulf Shores, AL"
 *   node agents/extract-place-ids-from-maps.js "Orange Beach, AL" "" 200  (max 200 results)
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

const ARGS = process.argv.slice(2);
const LOCATION = ARGS[0] || 'Orange Beach, AL';
const SEARCH_TYPE = ARGS[1] || '';
const MAX_RESULTS = parseInt(ARGS[2] || 500);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function extractPlaceIds() {
    console.log(`\n🗺️  Google Maps Place ID Extractor`);
    console.log(`📍 Location: ${LOCATION}`);
    console.log(`🔍 Search Type: ${SEARCH_TYPE || 'all'}`);
    console.log(`📊 Max Results: ${MAX_RESULTS}\n`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 900 });

        // Build search URL
        const searchQuery = SEARCH_TYPE
            ? `${SEARCH_TYPE} in ${LOCATION}`
            : LOCATION;
        const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

        console.log(`Loading: ${mapsUrl}`);
        await page.goto(mapsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await sleep(2000);

        // Extract place data from page
        const placeData = await page.evaluate(() => {
            const places = [];
            const divs = document.querySelectorAll('div[data-cid]');

            divs.forEach(div => {
                const placeId = div.getAttribute('data-cid');
                if (placeId) {
                    const titleEl = div.querySelector('div[role="button"]');
                    const title = titleEl?.textContent || '';
                    const ratingEl = div.querySelector('[aria-label*="stars"]');
                    const rating = ratingEl?.getAttribute('aria-label') || '';

                    if (title && title.length > 0) {
                        places.push({
                            place_id: placeId,
                            name: title.trim(),
                            rating: rating,
                            source: 'google_maps'
                        });
                    }
                }
            });

            return places;
        });

        console.log(`✅ Found ${placeData.length} places from DOM\n`);

        // Scroll to load more results
        let previousHeight = 0;
        let scrollCount = 0;
        const maxScrolls = Math.ceil(MAX_RESULTS / 20);

        while (scrollCount < maxScrolls && placeData.length < MAX_RESULTS) {
            // Scroll in the results panel
            const newHeight = await page.evaluate(() => {
                const resultsPanel = document.querySelector('[role="main"]');
                if (!resultsPanel) return 0;
                resultsPanel.scrollTop += 500;
                return resultsPanel.scrollHeight;
            });

            if (newHeight === previousHeight) break;
            previousHeight = newHeight;
            scrollCount++;

            await sleep(800);

            // Extract new places
            const newPlaces = await page.evaluate(() => {
                const places = [];
                const divs = document.querySelectorAll('div[data-cid]');

                divs.forEach(div => {
                    const placeId = div.getAttribute('data-cid');
                    if (placeId) {
                        const titleEl = div.querySelector('div[role="button"]');
                        const title = titleEl?.textContent || '';

                        if (title && title.length > 0) {
                            places.push({
                                place_id: placeId,
                                name: title.trim(),
                                source: 'google_maps'
                            });
                        }
                    }
                });

                return places;
            });

            // Merge without duplicates
            const existingIds = new Set(placeData.map(p => p.place_id));
            newPlaces.forEach(p => {
                if (!existingIds.has(p.place_id)) {
                    placeData.push(p);
                    existingIds.add(p.place_id);
                }
            });

            console.log(`[Scroll ${scrollCount}] Total found: ${placeData.length}`);
        }

        // Slice to max results
        const finalPlaces = placeData.slice(0, MAX_RESULTS);

        // Get more details by clicking on each place
        console.log(`\n📝 Extracting details from ${Math.min(50, finalPlaces.length)} places...`);

        for (let i = 0; i < Math.min(50, finalPlaces.length); i++) {
            try {
                const place = finalPlaces[i];

                // Click on the place in the results
                await page.evaluate((idx) => {
                    const divs = document.querySelectorAll('div[data-cid]');
                    if (divs[idx]) {
                        divs[idx].click();
                    }
                }, i);

                await sleep(500);

                // Extract details from the info panel
                const details = await page.evaluate(() => {
                    const result = {};

                    // Address
                    const addressEl = document.querySelector('[data-item-id="address"]');
                    if (addressEl) result.address = addressEl.textContent.replace('Address: ', '').trim();

                    // Phone
                    const phoneEl = document.querySelector('[data-item-id="phone:tel"]');
                    if (phoneEl) result.phone = phoneEl.textContent.replace('Phone: ', '').trim();

                    // Website
                    const websiteEl = document.querySelector('[data-item-id="website"]');
                    if (websiteEl) result.website = websiteEl.textContent.replace('Website: ', '').trim();

                    return result;
                });

                if (details.address) finalPlaces[i].address = details.address;
                if (details.phone) finalPlaces[i].phone = details.phone;
                if (details.website) finalPlaces[i].website = details.website;

                if (i % 10 === 0) console.log(`  [${i}/${Math.min(50, finalPlaces.length)}] Details extracted`);
            } catch (e) {
                // Skip errors, continue with next
            }
        }

        // Save results
        const outputFile = path.join(__dirname, '../place-ids-from-maps.json');
        fs.writeFileSync(outputFile, JSON.stringify(finalPlaces, null, 2));

        console.log(`\n✅ SUCCESS`);
        console.log(`📍 Extracted: ${finalPlaces.length} place IDs`);
        console.log(`💾 Saved to: place-ids-from-maps.json`);
        console.log(`\n📌 Next step: Use these place IDs with pull-all-google-api.js`);
        console.log(`   node agents/pull-all-google-api.js --file place-ids-from-maps.json`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

extractPlaceIds();
