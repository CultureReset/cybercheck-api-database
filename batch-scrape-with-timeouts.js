const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "-");
}

function loadRestaurantList() {
  const configPath = "./restaurants-to-scrape.json";
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config.restaurants || [];
  }
  return [];
}

async function scrapeRestaurant(website, restaurantName, browser, timeout = 20000) {
  const slug = nameToSlug(restaurantName);
  const outputDir = path.join("/Users/owner/cybercheck-api-database/screenshots", slug);

  if (fs.existsSync(outputDir)) {
    console.log(`  ⊘ Already exists`);
    return { slug, restaurant: restaurantName, status: "already_exists" };
  }

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`  📸 Scraping...`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  try {
    // Try to navigate with shorter timeout
    let loaded = false;
    try {
      await page.goto(website, { waitUntil: "networkidle2" });
      loaded = true;
    } catch (e) {
      console.log(`    ⚠️ networkidle2 timeout, trying load...`);
      try {
        await page.goto(website, { waitUntil: "load" });
        loaded = true;
      } catch (e2) {
        console.log(`    ⚠️ load timeout, trying domcontentloaded...`);
        await page.goto(website, { waitUntil: "domcontentloaded" });
        loaded = true;
      }
    }

    if (!loaded) throw new Error("Failed to load page");

    // Get page title to verify loaded
    const title = await page.title();
    console.log(`    ✓ Loaded: ${title.substring(0, 40)}`);

    // Screenshot full page
    await page.waitForTimeout(500);
    
    const bodyHandle = await page.$("body");
    const { height } = bodyHandle ? await bodyHandle.boundingBox() : { height: 1440 };
    if (bodyHandle) await bodyHandle.dispose();

    const index = {
      slug,
      source_url: website,
      scraped_at: new Date().toISOString(),
      pages: [{ url: website, files: [] }],
      total_screenshots: 0,
    };

    let screenshotCount = 0;
    const viewportHeight = 720;
    const numScreenshots = Math.ceil(height / viewportHeight);

    for (let i = 0; i < numScreenshots && i < 15; i++) {
      const filename = `page-${String(i + 1).padStart(3, "0")}.jpg`;
      const filepath = path.join(outputDir, filename);

      try {
        await page.screenshot({
          path: filepath,
          quality: 80,
          fullPage: false,
          clip: {
            x: 0,
            y: i * viewportHeight,
            width: 1280,
            height: Math.min(viewportHeight, height - i * viewportHeight),
          },
        });

        index.pages[0].files.push(filename);
        screenshotCount++;
      } catch (e) {
        console.log(`      ⚠️ Screenshot ${i + 1} failed`);
      }
    }

    index.total_screenshots = screenshotCount;
    fs.writeFileSync(path.join(outputDir, "index.json"), JSON.stringify(index, null, 2));

    console.log(`  ✓ ${screenshotCount} screenshots`);
    return {
      slug,
      restaurant: restaurantName,
      website,
      status: "success",
      screenshots: screenshotCount,
    };
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    try {
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch (e) {}
    return {
      slug,
      restaurant: restaurantName,
      website,
      status: "failed",
      error: error.message,
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const toScrape = loadRestaurantList();

  if (toScrape.length === 0) {
    console.log(`\n❌ No restaurants to scrape. Create restaurants-to-scrape.json`);
    return;
  }

  console.log(`\n🚀 BATCH SCRAPER (WITH TIMEOUT HANDLING)`);
  console.log(`=======================================`);
  console.log(`Restaurants: ${toScrape.length}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = [];
  let successCount = 0;

  for (let i = 0; i < toScrape.length; i++) {
    const { name, website } = toScrape[i];
    const attempt = `${i + 1}/${toScrape.length}`;

    console.log(`\n[${attempt}] ${name}`);

    try {
      const result = await scrapeRestaurant(website, name, browser, 15000);
      results.push(result);
      if (result.status === "success") successCount++;

      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (error) {
      console.log(`  ✗ Fatal: ${error.message}`);
      results.push({ restaurant: name, status: "fatal_error", error: error.message });
    }
  }

  await browser.close();

  const summary = {
    generated_at: new Date().toISOString(),
    total_requested: toScrape.length,
    successful: successCount,
    failed: results.filter(r => r.status === "failed").length,
    already_exists: results.filter(r => r.status === "already_exists").length,
    results,
  };

  fs.writeFileSync("scrape-results.json", JSON.stringify(summary, null, 2));

  console.log(`\n\n✓ COMPLETE`);
  console.log(`Successful: ${successCount}/${toScrape.length}`);
  console.log(`Results: scrape-results.json`);
}

main().catch(console.error);
