const puppeteer = require('puppeteer-core');
const fs = require('fs');

const restaurants = [
  { name: 'Rotolos', location: 'Alabama' },
  { name: 'Sea-N-Suds', location: 'Gulf Shores, AL' },
  { name: 'Mudbugs Pub', location: 'Gulf Shores, AL' },
  { name: 'OHANA Poke Teriyaki', location: 'Spanish Fort, AL' },
  { name: "Vinny's Pizzeria", location: 'Orange Beach, AL' },
  { name: 'Flora-Bama Lounge', location: 'Orange Beach, AL' }
];

async function getPlaceId(page, restaurant) {
  try {
    const query = `${restaurant.name} ${restaurant.location}`;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

    console.log(`🔎 Searching: ${restaurant.name}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for results to load
    await page.waitForSelector('[data-item-id]', { timeout: 10000 }).catch(() => null);

    // Click first result if available
    const firstResult = await page.$('[data-item-id]');
    if (firstResult) {
      await firstResult.click();
      await new Promise(r => setTimeout(r, 1500));
    }

    const currentUrl = page.url();

    // Try multiple methods to extract place ID
    let placeId = null;

    // Method 1: From URL !1s pattern
    const urlMatch = currentUrl.match(/!1s0x([a-f0-9]+):0x([a-f0-9]+)/);
    if (urlMatch) {
      placeId = `ChIJ${urlMatch[1]}`;
    }

    // Method 2: Extract from page content
    const pageContent = await page.content();
    const jsonMatch = pageContent.match(/"place_id":"(ChIJ[^"]+)"/);
    if (jsonMatch) {
      placeId = jsonMatch[1];
    }

    // Method 3: Look in data attributes
    const dataMatch = pageContent.match(/data-place-id="([^"]+)"/);
    if (dataMatch) {
      placeId = dataMatch[1];
    }

    console.log(`✅ ${restaurant.name}`);
    if (placeId) {
      console.log(`   Place ID: ${placeId}`);
    } else {
      console.log(`   Place ID: NOT FOUND - check URL below`);
    }
    console.log(`   URL: ${currentUrl}\n`);

    return {
      search: restaurant.name,
      location: restaurant.location,
      place_id: placeId,
      url: currentUrl
    };

  } catch (error) {
    console.log(`❌ Error with ${restaurant.name}: ${error.message}\n`);
    return {
      search: restaurant.name,
      location: restaurant.location,
      place_id: null,
      error: error.message
    };
  }
}

async function scrapeAllPlaces() {
  console.log('🍔 SCRAPING PLACE IDS FROM GOOGLE MAPS\n');
  console.log('═══════════════════════════════════════════════════════\n');

  let browser;
  try {
    // Use system Chrome
    browser = await puppeteer.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox']
    });

    const results = [];

    for (const restaurant of restaurants) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });

      const result = await getPlaceId(page, restaurant);
      results.push(result);

      await page.close();
      await new Promise(r => setTimeout(r, 2000));
    }

    await browser.close();

    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📊 SUMMARY\n');

    const found = results.filter(r => r.place_id);
    const notFound = results.filter(r => !r.place_id);

    console.log(`✅ Found: ${found.length}`);
    console.log(`❌ Not found: ${notFound.length}\n`);

    found.forEach(r => {
      console.log(`• ${r.search}`);
      console.log(`  ID: ${r.place_id}\n`);
    });

    if (notFound.length > 0) {
      console.log('⚠️  NOT FOUND - Check these URLs manually:\n');
      notFound.forEach(r => {
        console.log(`• ${r.search}`);
        console.log(`  ${r.url}\n`);
      });
    }

    fs.writeFileSync('./MISSING-PLACE-IDS-SCRAPED.json', JSON.stringify(results, null, 2));
    console.log('✅ Results saved to MISSING-PLACE-IDS-SCRAPED.json\n');

  } catch (error) {
    console.error('Fatal error:', error);
    if (browser) await browser.close();
    process.exit(1);
  }
}

scrapeAllPlaces();
