const fs = require("fs");
const path = require("path");

// Load Google data
const googleData = require("./all-businesses-organized-ob-gs.json");

// Get all currently scraped
const screenshotsDir = "/Users/owner/cybercheck-api-database/screenshots";
const scrapedFolders = fs.readdirSync(screenshotsDir).filter(f => {
  return fs.statSync(path.join(screenshotsDir, f)).isDirectory();
});

// Better slug function - normalize better
function makeSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/'/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim("-");
}

// Create map of all scraped (multiple variations)
const scrapedSet = new Set();
const scrapedBySlug = {};

scrapedFolders.forEach(folder => {
  scrapedSet.add(folder);
  scrapedBySlug[folder] = true;

  // Also add variations
  const normalized = makeSlug(folder);
  scrapedSet.add(normalized);
  scrapedBySlug[normalized] = true;
});

console.log(`\n🔍 DEDUPLICATION CHECK`);
console.log(`======================\n`);
console.log(`Scraped folders: ${scrapedFolders.length}`);
console.log(`Unique slugs: ${Object.keys(scrapedBySlug).length}\n`);

// Filter for restaurants
const restaurantTypes = [
  "restaurant", "bar", "cafe", "bakery", "fast_food_restaurant",
  "BBQ_restaurant", "seafood_restaurant", "steakhouse", "pizza_restaurant",
];

const googleRestaurants = googleData.filter(b => {
  const types = b.types || [];
  return restaurantTypes.some(rt => types.includes(rt));
});

console.log(`Google restaurants: ${googleRestaurants.length}\n`);

// Check for duplicates
const trulyNew = [];
const duplicates = [];

googleRestaurants.forEach(business => {
  const slug = makeSlug(business.name);

  if (scrapedBySlug[slug] || scrapedBySlug[business.name.toLowerCase()]) {
    duplicates.push({
      name: business.name,
      googleSlug: slug,
      folder: scrapedFolders.find(f => makeSlug(f) === slug || f === business.name.toLowerCase())
    });
  } else {
    trulyNew.push({
      name: business.name,
      place_id: business.place_id,
      website: business.website || "",
      rating: business.rating || 0,
      reviews: business.reviews_count || 0,
      city: business.city,
    });
  }
});

console.log(`✅ Already scraped (detected): ${duplicates.length}`);
console.log(`❌ Truly missing: ${trulyNew.length}\n`);

// Show some duplicates to verify
console.log(`Sample of detected duplicates:`);
duplicates.slice(0, 10).forEach((d, i) => {
  console.log(`  ${i+1}. ${d.name} → ${d.folder}`);
});

// Sort missing by rating
const byRating = trulyNew
  .filter(r => r.website && r.rating > 0)
  .sort((a, b) => {
    if (b.reviews !== a.reviews) return b.reviews - a.reviews;
    return b.rating - a.rating;
  });

console.log(`\n\n🏆 TOP 40 TRULY MISSING (No Duplicates)`);
console.log(`=====================================\n`);

byRating.slice(0, 40).forEach((r, i) => {
  const city = r.city === "Orange Beach" ? "OB" : "GS";
  const star = r.rating >= 4.5 ? "⭐⭐" : r.rating >= 4.0 ? "⭐" : "";
  console.log(
    `${String(i+1).padStart(2)}. [${city}] ${r.name.padEnd(45)} ${star} ${r.rating.toFixed(1)} (${r.reviews} reviews)`
  );
  console.log(`    🔗 ${r.website}`);
});

// Save config for batch scraper
const scrapeConfig = {
  restaurants: byRating
    .filter(r => r.website)
    .slice(0, 50)
    .map(r => ({
      name: r.name,
      website: r.website,
      place_id: r.place_id,
      rating: r.rating,
      reviews: r.reviews,
    })),
};

fs.writeFileSync(
  "/Users/owner/cybercheck-api-database/truly-missing-restaurants.json",
  JSON.stringify(scrapeConfig, null, 2)
);

// Save full analysis
const analysis = {
  generated_at: new Date().toISOString(),
  total_google_restaurants: googleRestaurants.length,
  already_scraped: duplicates.length,
  truly_missing: trulyNew.length,
  with_websites_and_rating: byRating.length,
  duplicates: duplicates.slice(0, 50),
  top_50_missing: byRating.slice(0, 50),
};

fs.writeFileSync(
  "/Users/owner/cybercheck-api-database/deduplication-analysis.json",
  JSON.stringify(analysis, null, 2)
);

console.log(`\n✓ Saved: truly-missing-restaurants.json (ready to scrape, no duplicates!)`);
console.log(`✓ Saved: deduplication-analysis.json`);

console.log(`\n\n📌 Next step:`);
console.log(`   cp truly-missing-restaurants.json restaurants-to-scrape.json`);
console.log(`   node batch-scrape-pipeline.js`);
