const fs = require("fs");
const path = require("path");

// Load all Google Business data
const allBusinesses = require("./all-businesses-organized-ob-gs.json");

// Get all currently scraped restaurants
const screenshotsDir = "/Users/owner/cybercheck-api-database/screenshots";
const scrapedFolders = fs
  .readdirSync(screenshotsDir)
  .filter((f) => {
    const fullPath = path.join(screenshotsDir, f);
    return fs.statSync(fullPath).isDirectory();
  })
  .map((f) => f.toLowerCase());

console.log(`\n🔍 GOOGLE BUSINESS vs SCRAPED COMPARISON`);
console.log(`======================================\n`);

// Filter for restaurants only
const googleRestaurants = allBusinesses.filter((b) => {
  const types = b.types || [];
  const isRestaurant =
    types.includes("restaurant") ||
    types.includes("cafe") ||
    types.includes("bar") ||
    types.includes("fast_food_restaurant") ||
    types.includes("bakery");

  // Also check category
  const isRestaurantCategory =
    (b.category &&
      (b.category.includes("restaurant") ||
        b.category.includes("food") ||
        b.category.includes("bar") ||
        b.category.includes("cafe"))) ||
    !b.category; // Include if no category

  return isRestaurant || isRestaurantCategory;
});

console.log(`📊 STATISTICS`);
console.log(`=============`);
console.log(`Total businesses in Google data: ${allBusinesses.length}`);
console.log(`Restaurants/Food in Google: ${googleRestaurants.length}`);
console.log(`Already scraped: ${scrapedFolders.length}`);

// Find which ones are already scraped
const scraped = [];
const notScraped = [];

googleRestaurants.forEach((business) => {
  // Create a slug from the name
  const slug = business.name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "-");

  if (scrapedFolders.includes(slug)) {
    scraped.push({
      name: business.name,
      place_id: business.place_id,
      website: business.website,
      rating: business.rating,
      reviews: business.reviews_count,
      city: business.city,
    });
  } else {
    notScraped.push({
      name: business.name,
      place_id: business.place_id,
      website: business.website,
      rating: business.rating,
      reviews: business.reviews_count,
      city: business.city,
      address: business.address,
      phone: business.phone,
    });
  }
});

console.log(`\n✅ ALREADY SCRAPED: ${scraped.length}`);
console.log(`❌ NOT SCRAPED: ${notScraped.length}\n`);

// Sort by rating (highest first)
const byRating = [...notScraped].sort((a, b) => (b.rating || 0) - (a.rating || 0));
const byReviews = [...notScraped].sort((a, b) => (b.reviews || 0) - (a.reviews || 0));

// Show top restaurants to scrape
console.log(`📈 TOP 30 RESTAURANTS BY RATING (Not Scraped)`);
console.log(`==========================================\n`);

byRating.slice(0, 30).forEach((r, i) => {
  const city = r.city === "Orange Beach" ? "OB" : "GS";
  const website = r.website ? "✓" : "✗";
  console.log(
    `${String(i + 1).padStart(2)}. [${city}] ${r.name.padEnd(45)} ⭐ ${(r.rating || "N/A").toString().padEnd(3)} (${r.reviews} reviews) ${website}`
  );
});

console.log(`\n\n📊 TOP 30 BY REVIEW COUNT (Not Scraped)`);
console.log(`======================================\n`);

byReviews.slice(0, 30).forEach((r, i) => {
  const city = r.city === "Orange Beach" ? "OB" : "GS";
  const website = r.website ? "✓" : "✗";
  console.log(
    `${String(i + 1).padStart(2)}. [${city}] ${r.name.padEnd(45)} ⭐ ${(r.rating || "N/A").toString().padEnd(3)} (${r.reviews} reviews) ${website}`
  );
});

// Show restaurants with websites
const withWebsites = notScraped.filter((r) => r.website && r.website.length > 0);

console.log(`\n\n🌐 RESTAURANTS WITH WEBSITES (Ready to Scrape)`);
console.log(`=============================================\n`);
console.log(`${withWebsites.length} restaurants have website URLs\n`);

withWebsites
  .sort((a, b) => (b.rating || 0) - (a.rating || 0))
  .slice(0, 30)
  .forEach((r, i) => {
    const city = r.city === "Orange Beach" ? "OB" : "GS";
    console.log(`${String(i + 1).padStart(2)}. [${city}] ${r.name}`);
    console.log(`    🔗 ${r.website}`);
    console.log(`    📞 ${r.phone}`);
    console.log();
  });

// Generate scrape config
const configData = {
  generated_at: new Date().toISOString(),
  total_google_restaurants: googleRestaurants.length,
  already_scraped: scraped.length,
  not_scraped: notScraped.length,
  with_websites: withWebsites.length,
  recommended_to_scrape: withWebsites
    .filter((r) => r.rating && r.rating >= 4.0)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 50)
    .map((r) => ({
      name: r.name,
      website: r.website,
      place_id: r.place_id,
      rating: r.rating,
      reviews: r.reviews,
      city: r.city,
    })),
};

fs.writeFileSync(
  "/Users/owner/cybercheck-api-database/google-vs-scraped.json",
  JSON.stringify(configData, null, 2)
);

// Also create a ready-to-use scrape config
const scrapeConfig = {
  restaurants: withWebsites
    .filter((r) => r.rating && r.rating >= 4.0)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 30)
    .map((r) => ({
      name: r.name,
      website: r.website,
    })),
};

fs.writeFileSync(
  "/Users/owner/cybercheck-api-database/restaurants-to-scrape-from-google.json",
  JSON.stringify(scrapeConfig, null, 2)
);

console.log(`\n✓ Analysis saved:`);
console.log(`  - google-vs-scraped.json (analysis)`);
console.log(`  - restaurants-to-scrape-from-google.json (ready to scrape!)`);
