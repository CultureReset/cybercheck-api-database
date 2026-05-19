#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');

const unlinked = JSON.parse(fs.readFileSync('./consolidation/TRULY-UNLINKED-EVENTS.json'));

// Get unique venues with city
const uniqueVenues = {};
unlinked.forEach(e => {
  const key = (e.venueName || '') + '|' + (e.locationCity || '');
  if (!uniqueVenues[key]) {
    uniqueVenues[key] = {
      venueName: e.venueName || '',
      locationCity: e.locationCity || '',
      eventCount: 0
    };
  }
  uniqueVenues[key].eventCount++;
});

const venueList = Object.values(uniqueVenues).filter(v => v.venueName);

console.log('='.repeat(80));
console.log('SCRAPE UNLINKED VENUES FROM GOOGLE MAPS');
console.log('='.repeat(80) + '\n');
console.log('Unique venues to search: ' + venueList.length + '\n');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });

  const page = await browser.newPage();
  const found = [];
  const notFound = [];

  for (let i = 0; i < venueList.length; i++) {
    const venue = venueList[i];
    const searchName = venue.venueName + (venue.locationCity ? ' ' + venue.locationCity : ' Alabama');
    
    process.stdout.write(`[${i + 1}/${venueList.length}] ${searchName.padEnd(60)} → `);

    try {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchName)}/`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });

      await new Promise(r => setTimeout(r, 500));

      // Try to get first result
      const placeLink = await page.$eval(
        'a[href*="/maps/place/"]',
        el => el.href
      ).catch(() => null);

      if (placeLink) {
        const match = placeLink.match(/\/place\/([^/]+)\//) || placeLink.match(/place_id:([a-zA-Z0-9]+)/);
        const placeId = match ? match[1] : null;

        if (placeId && placeId.startsWith('ChIJ')) {
          found.push({
            venue_name: venue.venueName,
            location_city: venue.locationCity,
            place_id: placeId,
            event_count: venue.eventCount
          });
          console.log('✓ ' + placeId);
        } else {
          notFound.push({
            venue_name: venue.venueName,
            location_city: venue.locationCity,
            event_count: venue.eventCount
          });
          console.log('✗');
        }
      } else {
        notFound.push({
          venue_name: venue.venueName,
          location_city: venue.locationCity,
          event_count: venue.eventCount
        });
        console.log('✗');
      }

      await new Promise(r => setTimeout(r, 300));
    } catch (error) {
      console.log('ERROR');
      notFound.push({
        venue_name: venue.venueName,
        location_city: venue.locationCity,
        event_count: venue.eventCount
      });
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(80));
  console.log('RESULTS');
  console.log('='.repeat(80));
  console.log('Found: ' + found.length);
  console.log('Not found: ' + notFound.length);
  console.log('Success rate: ' + (found.length / venueList.length * 100).toFixed(1) + '%\n');

  fs.writeFileSync('./consolidation/UNLINKED-VENUES-FOUND.json', JSON.stringify(found, null, 2));
  fs.writeFileSync('./consolidation/UNLINKED-VENUES-NOT-FOUND.json', JSON.stringify(notFound, null, 2));

  console.log('✓ consolidation/UNLINKED-VENUES-FOUND.json (' + found.length + ')');
  console.log('✓ consolidation/UNLINKED-VENUES-NOT-FOUND.json (' + notFound.length + ')');
})();
