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

console.log(`\n📊 MISSING RESTAURANTS - GOOGLE BUSINESS DATA`);
console.log(`==========================================\n`);

// More strict filter for actual restaurants
const restaurantTypes = [
  "restaurant",
  "bar",
  "cafe",
  "bakery",
  "fast_food_restaurant",
  "BBQ_restaurant",
  "seafood_restaurant",
  "steakhouse",
  "pizza_restaurant",
  "sandwich_shop",
  "burger_restaurant",
  "sushi_restaurant",
  "taco_restaurant",
];

const googleRestaurants = allBusinesses.filter((b) => {
  const types = b.types || [];
  return restaurantTypes.some((rt) => types.includes(rt));
});

console.log(`Total businesses in Google data: ${allBusinesses.length}`);
console.log(`Actual restaurants: ${googleRestaurants.length}`);
console.log(`Already scraped: ${scrapedFolders.length}\n`);

// Find which ones are already scraped
const notScraped = [];

googleRestaurants.forEach((business) => {
  const slug = business.name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "-");

  if (!scrapedFolders.includes(slug)) {
    notScraped.push({
      name: business.name,
      place_id: business.place_id,
      website: business.website || "",
      rating: business.rating || 0,
      reviews: business.reviews_count || 0,
      city: business.city,
      address: business.address,
      phone: business.phone,
      types: business.types || [],
    });
  }
});

console.log(`NOT YET SCRAPED: ${notScraped.length} restaurants\n`);

// Filter for those with websites
const withWebsites = notScraped.filter((r) => r.website && r.website.length > 3);
const highRated = notScraped.filter((r) => r.rating >= 4.2);
const manyReviews = notScraped.filter((r) => r.reviews >= 100);

console.log(`With websites: ${withWebsites.length}`);
console.log(`Rating 4.2+: ${highRated.length}`);
console.log(`100+ reviews: ${manyReviews.length}\n`);

// Show TOP recommendations
const topByRating = [...notScraped]
  .filter((r) => r.website && r.rating > 0)
  .sort((a, b) => {
    // Sort by reviews first (more social proof), then rating
    if (b.reviews !== a.reviews) return b.reviews - a.reviews;
    return b.rating - a.rating;
  });

console.log(`🏆 TOP 50 MISSING RESTAURANTS (by Popularity & Rating)`);
console.log(`===================================================\n`);

topByRating.slice(0, 50).forEach((r, i) => {
  const city = r.city === "Orange Beach" ? "OB" : "GS";
  const website = r.website ? "✓" : "✗";
  const star = r.rating >= 4.5 ? "⭐⭐" : r.rating >= 4.0 ? "⭐" : "";
  console.log(
    `${String(i + 1).padStart(2)}. [${city}] ${r.name.padEnd(45)} ${star} ${r.rating.toFixed(1)} (${String(r.reviews).padStart(4)} reviews) ${website}`
  );
});

console.log(`\n\n🔗 TOP 30 WITH WEBSITES (Ready to Scrape)`);
console.log(`======================================\n`);

topByRating
  .filter((r) => r.website)
  .slice(0, 30)
  .forEach((r, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${r.name}`);
    console.log(`    🌐 ${r.website}`);
    console.log(`    ⭐ ${r.rating.toFixed(1)} (${r.reviews} reviews)`);
    console.log(`    📞 ${r.phone || "N/A"}`);
    console.log(`    📍 ${r.city}`);
    console.log();
  });

// Save complete missing list
const output = {
  generated_at: new Date().toISOString(),
  total_restaurants: googleRestaurants.length,
  already_scraped: scrapedFolders.length,
  missing_total: notScraped.length,
  with_websites: withWebsites.length,
  high_rated: highRated.length,
  many_reviews: manyReviews.length,
  top_50_missing: topByRating.slice(0, 50),
  all_missing: notScraped.sort((a, b) => {
    if (b.reviews !== a.reviews) return b.reviews - a.reviews;
    return b.rating - a.rating;
  }),
};

fs.writeFileSync(
  "/Users/owner/cybercheck-api-database/missing-restaurants.json",
  JSON.stringify(output, null, 2)
);

// Create scrape config from top recommendations
const scrapeConfig = {
  description:
    "Top 40 missing restaurants from Google Business data with websites",
  restaurants: topByRating
    .filter((r) => r.website && r.rating >= 3.5)
    .slice(0, 40)
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
  "/Users/owner/cybercheck-api-database/restaurants-priority-scrape-list.json",
  JSON.stringify(scrapeConfig, null, 2)
);

console.log(`\n✓ Files saved:`);
console.log(`  - missing-restaurants.json (complete analysis)`);
console.log(`  - restaurants-priority-scrape-list.json (ready for batch scraper)`);
console.log(
  `\n📌 Use this command to scrape:`
);
console.log(`   cp restaurants-priority-scrape-list.json restaurants-to-scrape.json`);
console.log(`   node batch-scrape-pipeline.js`);
