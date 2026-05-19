const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

/**
 * BATCH SCRAPE PIPELINE
 *
 * Usage:
 * 1. Add restaurant URLs to the "restaurants" array below
 * 2. Run: node batch-scrape-pipeline.js
 * 3. Check results in scrape-results.json
 *
 * Restaurant URL format should include the base website URL
 */

const restaurants = [
  // Example - add your URLs here
  // { name: "Restaurant Name", website: "https://www.example.com" }
];

// Load from external JSON file if available
function loadRestaurantList() {
  const configPath = "./restaurants-to-scrape.json";
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config.restaurants || [];
  }
  return restaurants;
}

// Convert name to slug
function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "-");
}

// Get all links from a page
async function getPageLinks(page, baseUrl) {
  try {
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]"))
        .map((a) => {
          try {
            return {
              text: a.textContent.trim().substring(0, 100),
              href: a.href,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    });

    return links;
  } catch (error) {
    console.log(`    ⚠ Error extracting links: ${error.message}`);
    return [];
  }
}

// Find relevant pages on the website
async function findRelevantPages(page, baseUrl, maxPages = 8) {
  const relevantPages = [baseUrl];
  const visited = new Set([baseUrl]);

  const menuKeywords = [
    "menu",
    "hours",
    "contact",
    "about",
    "location",
    "locations",
    "reservations",
    "events",
    "specials",
    "catering",
    "private",
    "dining",
    "gallery",
    "photos",
  ];

  const links = await getPageLinks(page, baseUrl);

  // Filter and add relevant links
  for (const link of links) {
    if (relevantPages.length >= maxPages) break;

    const text = link.text.toLowerCase();
    const href = link.href.toLowerCase();

    // Check if link is relevant
    const isRelevant =
      menuKeywords.some((kw) => text.includes(kw) || href.includes(kw)) &&
      href.includes(new URL(baseUrl).hostname);

    if (isRelevant && !visited.has(link.href)) {
      try {
        const url = new URL(link.href);
        if (url.hostname === new URL(baseUrl).hostname) {
          relevantPages.push(link.href);
          visited.add(link.href);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
  }

  return relevantPages;
}

// Screenshot a page
async function screenshotPage(page, outputDir, pageNum, url) {
  try {
    // Wait for content to load
    await page.waitForTimeout(1000);

    // Get full page height
    const bodyHandle = await page.$("body").catch(() => null);
    if (!bodyHandle) return 0;

    const { height } = await bodyHandle.boundingBox().catch(() => ({ height: 1440 }));
    await bodyHandle.dispose();

    // Calculate viewport height
    const viewportHeight = 720;
    const numScreenshots = Math.ceil(height / viewportHeight);

    let screenshotCount = 0;
    const files = [];

    // Screenshot each section of the page
    for (let i = 0; i < numScreenshots; i++) {
      const filename = `page-${String(pageNum + i).padStart(3, "0")}.jpg`;
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

        files.push(filename);
        screenshotCount++;
      } catch (e) {
        console.log(`      ⚠ Failed to screenshot section ${i + 1}`);
      }
    }

    return { count: screenshotCount, files };
  } catch (error) {
    console.log(`    ⚠ Error screenshotting ${url}: ${error.message}`);
    return { count: 0, files: [] };
  }
}

// Scrape a single restaurant
async function scrapeRestaurant(website, restaurantName, browser) {
  const slug = nameToSlug(restaurantName);
  const outputDir = path.join(
    "/Users/owner/cybercheck-api-database/screenshots",
    slug
  );

  // Check if already scraped
  if (fs.existsSync(outputDir)) {
    console.log(`  ⚠ Already scraped, skipping`);
    return {
      slug,
      restaurant: restaurantName,
      status: "already_exists",
      timestamp: new Date().toISOString(),
    };
  }

  // Create directory
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`  📸 Scraping website...`);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.setDefaultNavigationTimeout(30000);

    // Navigate to main page
    console.log(`    → Loading ${website}`);
    await page.goto(website, { waitUntil: "networkidle2" }).catch(() => {
      // Fallback if networkidle2 times out
      return page.goto(website, { waitUntil: "load" });
    });

    // Find relevant pages
    console.log(`    → Finding menu/hours pages...`);
    const pagesToScrape = await findRelevantPages(page, website);
    console.log(`    → Found ${pagesToScrape.length} pages to capture`);

    // Screenshot each page
    const index = {
      slug,
      source_url: website,
      scraped_at: new Date().toISOString(),
      pages: [],
      total_screenshots: 0,
    };

    let totalScreenshots = 0;

    for (let i = 0; i < pagesToScrape.length; i++) {
      const pageUrl = pagesToScrape[i];

      console.log(`    📄 Page ${i + 1}/${pagesToScrape.length}: ${pageUrl.substring(0, 60)}...`);

      try {
        await page.goto(pageUrl, { waitUntil: "networkidle2" }).catch(() => {
          return page.goto(pageUrl, { waitUntil: "load" });
        });

        const result = await screenshotPage(page, outputDir, totalScreenshots, pageUrl);

        if (result.files && result.files.length > 0) {
          index.pages.push({
            url: pageUrl,
            files: result.files,
          });

          totalScreenshots += result.count;
          console.log(`      ✓ Captured ${result.count} images`);
        }
      } catch (error) {
        console.log(`      ⚠ Error scraping page: ${error.message}`);
      }
    }

    index.total_screenshots = totalScreenshots;

    // Save index
    fs.writeFileSync(
      path.join(outputDir, "index.json"),
      JSON.stringify(index, null, 2)
    );

    await page.close();

    console.log(`  ✓ Complete: ${totalScreenshots} screenshots saved`);

    return {
      slug,
      restaurant: restaurantName,
      website,
      status: "success",
      screenshots: totalScreenshots,
      pages_captured: index.pages.length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);

    // Clean up on failure
    try {
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch (e) {
      // Cleanup failed, oh well
    }

    return {
      slug,
      restaurant: restaurantName,
      website,
      status: "failed",
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

// Main execution
async function main() {
  const toScrape = loadRestaurantList();

  if (toScrape.length === 0) {
    console.log(`\n❌ No restaurants to scrape`);
    console.log(
      `\nCreate a restaurants-to-scrape.json file with this format:`
    );
    console.log(`{
  "restaurants": [
    { "name": "Restaurant Name", "website": "https://www.example.com" },
    { "name": "Another Restaurant", "website": "https://www.example.com" }
  ]
}`);
    return;
  }

  console.log(`\n🚀 BATCH RESTAURANT SCRAPER`);
  console.log(`===========================`);
  console.log(`Restaurants to scrape: ${toScrape.length}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = [];

  for (let i = 0; i < toScrape.length; i++) {
    const { name, website } = toScrape[i];

    console.log(`\n[${i + 1}/${toScrape.length}] ${name}`);

    const result = await scrapeRestaurant(website, name, browser);
    results.push(result);

    // Delay between requests
    if (i < toScrape.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  await browser.close();

  // Save results
  const summary = {
    generated_at: new Date().toISOString(),
    total_requested: toScrape.length,
    successful: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "failed").length,
    already_exists: results.filter((r) => r.status === "already_exists").length,
    total_screenshots: results.reduce((sum, r) => sum + (r.screenshots || 0), 0),
    results,
  };

  fs.writeFileSync(
    "/Users/owner/cybercheck-api-database/scrape-results.json",
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n\n📊 SCRAPING COMPLETE`);
  console.log(`====================`);
  console.log(`✓ Successful: ${summary.successful}`);
  console.log(`✗ Failed: ${summary.failed}`);
  console.log(`⊘ Already exists: ${summary.already_exists}`);
  console.log(`📸 Total screenshots: ${summary.total_screenshots}`);
  console.log(`\nResults saved to: scrape-results.json`);
}

// Run with error handling
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
