const puppeteer = require('puppeteer');
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
      await page.waitForTimeout(1500);
    }

    // Extract place ID from URL or page content
    const currentUrl = page.url();
    const placeIdMatch = currentUrl.match(/!1s0x([a-f0-9]+):0x([a-f0-9]+)/);

    let placeId = null;
    let name = null;
    let address = null;
    let phone = null;

    if (placeIdMatch) {
      placeId = `0x${placeIdMatch[1]}:0x${placeIdMatch[2]}`;
    }

    // Try to extract from page HTML
    try {
      const pageContent = await page.content();

      // Look for place name
      const nameMatch = pageContent.match(/<h1[^>]*>([^<]+)<\/h1>/);
      if (nameMatch) name = nameMatch[1].trim();

      // Look for address
      const addressMatch = pageContent.match(/aria-label="Address"[^>]*>\s*([^<]+)/);
      if (addressMatch) address = addressMatch[1].trim();

      // Look for phone
      const phoneMatch = pageContent.match(/aria-label="Phone"[^>]*>\s*([^<]+)/);
      if (phoneMatch) phone = phoneMatch[1].trim();

      // Alternative: look for structured data
      const jsonMatch = pageContent.match(/"place_id":"([^"]+)"/);
      if (jsonMatch) {
        placeId = jsonMatch[1];
      }
    } catch (e) {}

    // Extract from URL as last resort
    if (!placeId) {
      const dataMatch = currentUrl.match(/!1s0x[a-f0-9:]+/);
      if (dataMatch) {
        placeId = dataMatch[0];
      }
    }

    console.log(`✅ ${restaurant.name}`);
    if (placeId) console.log(`   Place ID: ${placeId}`);
    if (name) console.log(`   Name: ${name}`);
    if (address) console.log(`   Address: ${address}`);
    if (phone) console.log(`   Phone: ${phone}`);
    console.log(`   URL: ${currentUrl}\n`);

    return {
      search: restaurant.name,
      location: restaurant.location,
      place_id: placeId,
      name: name,
      address: address,
      phone: phone,
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
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = [];

    for (const restaurant of restaurants) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });

      const result = await getPlaceId(page, restaurant);
      results.push(result);

      await page.close();
      await new Promise(r => setTimeout(r, 2000)); // 2 second delay between searches
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

    // Save results
    fs.writeFileSync('./MISSING-PLACE-IDS-SCRAPED.json', JSON.stringify(results, null, 2));
    console.log('✅ Results saved to MISSING-PLACE-IDS-SCRAPED.json\n');

  } catch (error) {
    console.error('Fatal error:', error);
    if (browser) await browser.close();
    process.exit(1);
  }
}

scrapeAllPlaces();
