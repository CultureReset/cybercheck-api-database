#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');

const venues = JSON.parse(fs.readFileSync('./consolidation/VENUE-MAPPING.json'));

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

console.log('='.repeat(80));
console.log('SCRAPING GOOGLE PLACE IDS FROM CHROME');
console.log('='.repeat(80) + '\n');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  const results = [];
  const notFound = [];

  for (let i = 0; i < venues.length; i++) {
    const venue = venues[i];
    process.stdout.write(`[${i + 1}/${venues.length}] ${venue.padEnd(45)} → `);

    try {
      // Search Google Maps
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(venue)}/`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      // Wait for results to load
      await delay(1000);

      // Get the first result link
      const placeLink = await page.$eval(
        'a[href*="/maps/place/"]',
        el => el.href
      ).catch(() => null);

      if (placeLink) {
        // Extract place_id from URL
        const match = placeLink.match(/\/place\/([^/]+)\//) || placeLink.match(/place_id:([a-zA-Z0-9]+)/);
        const placeId = match ? (match[1] || match[0]) : null;

        if (placeId && placeId.startsWith('ChIJ')) {
          results.push({
            venue_name: venue,
            place_id: placeId,
            maps_url: placeLink
          });
          console.log('✓ ' + placeId);
        } else {
          // Try alternate extraction
          const pageUrl = page.url();
          const altMatch = pageUrl.match(/place_id:([a-zA-Z0-9]+)/);
          if (altMatch) {
            results.push({
              venue_name: venue,
              place_id: altMatch[1],
              maps_url: pageUrl
            });
            console.log('✓ ' + altMatch[1]);
          } else {
            notFound.push(venue);
            console.log('✗ NOT FOUND');
          }
        }
      } else {
        notFound.push(venue);
        console.log('✗ NOT FOUND');
      }

      // Add delay to avoid rate limiting
      await delay(800);
    } catch (error) {
      console.log('ERROR: ' + error.message.split('\n')[0]);
      notFound.push(venue);
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));
  console.log('Found: ' + results.length);
  console.log('Not found: ' + notFound.length);
  console.log('Success rate: ' + (results.length / venues.length * 100).toFixed(1) + '%\n');

  // Save results
  fs.writeFileSync('./consolidation/VENUE-PLACE-IDS-CHROME.json', JSON.stringify(results, null, 2));
  fs.writeFileSync('./consolidation/VENUE-NOT-FOUND-CHROME.json', JSON.stringify(notFound, null, 2));

  console.log('✓ consolidation/VENUE-PLACE-IDS-CHROME.json (' + results.length + ' venues)');
  console.log('✓ consolidation/VENUE-NOT-FOUND-CHROME.json (' + notFound.length + ' not found)\n');

  if (notFound.length > 0) {
    console.log('Not found:');
    notFound.forEach(v => console.log('  - ' + v));
  }
})();
