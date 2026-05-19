const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// Restaurant list to scrape
const restaurantsToScrape = [
  "Tackle Box Orange Beach AL",
  "The Packing Plant Gulf Shores AL",
  "Fisher's Upstairs Orange Beach AL",
  "Shoney's Orange Beach AL",
  "Outback Steakhouse Orange Beach AL",
  "Margaritaville Orange Beach AL",
  "Barefoot Beach Bar & Grill Gulf Shores AL",
  "Hot Spot Burgers Orange Beach AL",
  "Phoenix West Cafe Orange Beach AL",
  "Toucan's Restaurant Orange Beach AL",
  "The Original Oyster House Orange Beach AL",
  "Beasley's Steakhouse Gulf Shores AL",
  "Toes on the Beach Orange Beach AL",
  "NOLA Eatery Gulf Shores AL",
  "Fin Seafood Restaurant Orange Beach AL",
  "Oporto Restaurant Orange Beach AL",
  "Cactus Flower Cafe Orange Beach AL",
  "Mathers Social Gathering Gulf Shores AL",
  "The Jolly Roger Pier Restaurant Gulf Shores AL",
  "Gulf State Park Pavilion Restaurant Gulf Shores AL",
];

// Convert name to slug
function nameToSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^the-/, "");
}

// Find website via Google search (simple approach)
async function findWebsite(restaurantName) {
  console.log(`  🔍 Searching for website: ${restaurantName}`);

  // This is a simplified approach - in production you'd use a real search API
  // For now, we'll return common URL patterns
  const slug = nameToSlug(restaurantName);

  // Common URL patterns for restaurants
  const commonPatterns = [
    `https://www.${slug}.com`,
    `https://${slug}.com`,
    `https://www.${slug}.restaurant`,
  ];

  // Try to find which one works
  for (const url of commonPatterns) {
    try {
      const response = await fetch(url, { method: "HEAD", timeout: 5000 });
      if (response.ok) {
        console.log(`    ✓ Found: ${url}`);
        return url;
      }
    } catch (e) {
      // URL doesn't exist, try next
    }
  }

  console.log(`    ⚠ Could not find website for ${restaurantName}`);
  return null;
}

// Scrape a single restaurant website
async function scrapeRestaurant(website, restaurantName) {
  const slug = nameToSlug(restaurantName);
  const outputDir = path.join(
    "/Users/owner/cybercheck-api-database/screenshots",
    slug
  );

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  } else {
    console.log(`  ⚠ ${slug} already exists, skipping...`);
    return null;
  }

  console.log(`  📸 Scraping: ${website}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Navigate to website
    await page.goto(website, { waitUntil: "networkidle2", timeout: 30000 });

    // Get all links from the page
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors.map((a) => ({
        text: a.textContent.trim(),
        href: a.href,
      }));
    });

    // Filter for menu/hours/contact pages
    const relevantPages = [website];
    const menuKeywords = [
      "menu",
      "hours",
      "contact",
      "about",
      "location",
      "locations",
      "events",
      "specials",
      "catering",
    ];

    links.forEach((link) => {
      const text = link.text.toLowerCase();
      const href = link.href.toLowerCase();
      if (menuKeywords.some((kw) => text.includes(kw) || href.includes(kw))) {
        if (!relevantPages.includes(link.href)) {
          relevantPages.push(link.href);
        }
      }
    });

    console.log(`    Found ${relevantPages.length} pages to screenshot`);

    // Screenshot each page
    const index = {
      slug,
      source_url: website,
      scraped_at: new Date().toISOString(),
      pages: [],
      total_screenshots: 0,
    };

    let pageCount = 0;

    for (let i = 0; i < Math.min(relevantPages.length, 5); i++) {
      const pageUrl = relevantPages[i];
      console.log(`    📄 Page ${i + 1}: ${pageUrl}`);

      try {
        await page.goto(pageUrl, {
          waitUntil: "networkidle2",
          timeout: 20000,
        });

        // Get full page height
        const bodyHandle = await page.$("body");
        const { height } = await bodyHandle
          .boundingBox()
          .catch(() => ({ height: 720 }));
        await bodyHandle.dispose();

        // Screenshot in chunks
        const viewportHeight = 720;
        const numScreenshots = Math.ceil(height / viewportHeight);

        const pageScreenshots = [];

        for (let j = 0; j < numScreenshots; j++) {
          const filename = `page-${String(pageCount + 1).padStart(3, "0")}.jpg`;
          const filepath = path.join(outputDir, filename);

          await page.screenshot({
            path: filepath,
            quality: 80,
            fullPage: false,
            clip: {
              x: 0,
              y: j * viewportHeight,
              width: 1280,
              height: Math.min(viewportHeight, height - j * viewportHeight),
            },
          });

          pageScreenshots.push(filename);
          pageCount++;
        }

        index.pages.push({
          url: pageUrl,
          files: pageScreenshots,
        });
      } catch (error) {
        console.log(`      ⚠ Error capturing ${pageUrl}: ${error.message}`);
      }
    }

    index.total_screenshots = pageCount;

    // Save index
    fs.writeFileSync(
      path.join(outputDir, "index.json"),
      JSON.stringify(index, null, 2)
    );

    console.log(`  ✓ Saved ${pageCount} screenshots to ${slug}`);
    return { slug, pages: pageCount, success: true };
  } catch (error) {
    console.log(`  ✗ Failed to scrape ${restaurantName}: ${error.message}`);
    return { slug, success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

// Main function
async function main() {
  console.log(`\n🚀 BATCH RESTAURANT SCRAPER`);
  console.log(`===========================\n`);
  console.log(`Restaurants to scrape: ${restaurantsToScrape.length}\n`);

  const results = [];

  for (const restaurant of restaurantsToScrape) {
    console.log(`\n${restaurant}`);

    // Find website (this is simplified - you may need to use a real search API)
    const website = await findWebsite(restaurant).catch(() => null);

    if (!website) {
      console.log(`  ⚠ Skipping - no website found`);
      results.push({
        restaurant,
        status: "no_website",
      });
      continue;
    }

    // Scrape the restaurant
    const result = await scrapeRestaurant(website, restaurant);
    results.push({ restaurant, ...result });

    // Add delay between requests
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Save results
  const summary = {
    generated_at: new Date().toISOString(),
    total_requested: restaurantsToScrape.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success && r.status !== "no_website").length,
    no_website: results.filter((r) => r.status === "no_website").length,
    results,
  };

  fs.writeFileSync(
    "/Users/owner/cybercheck-api-database/scrape-results.json",
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n\n📊 SCRAPING COMPLETE`);
  console.log(`=====================`);
  console.log(`Successful: ${summary.successful}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`No Website: ${summary.no_website}`);
  console.log(`\nResults saved to: scrape-results.json`);
}

// Run with error handling
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
