const fs = require("fs");
const path = require("path");

// Get all currently scraped restaurants
const screenshotsDir = "/Users/owner/cybercheck-api-database/screenshots";
const scrapedFolders = fs
  .readdirSync(screenshotsDir)
  .filter((f) => {
    const fullPath = path.join(screenshotsDir, f);
    return fs.statSync(fullPath).isDirectory();
  })
  .map((f) => f.toLowerCase());

console.log(`\n📊 CURRENT SCRAPING STATUS`);
console.log(`============================`);
console.log(`Total restaurants scraped: ${scrapedFolders.length}`);
console.log(`\nAlready scraped in Orange Beach & Gulf Shores:\n`);

scrapedFolders.forEach((slug) => {
  // Convert slug to readable name
  const name = slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  console.log(`  ✓ ${name}`);
});

// Common restaurants in Orange Beach/Gulf Shores that might not be scraped
const commonRestaurants = [
  // Orange Beach
  "Tackle Box",
  "The Packing Plant",
  "Fisher's Upstairs",
  "Shoney's",
  "Outback Steakhouse",
  "Olive Garden",
  "Red Lobster",
  "Margaritaville",
  "Barefoot Beach Bar & Grill",
  "Hot Spot Burgers",
  "Phoenix West Cafe",
  "Toucan's Restaurant",
  "The Original Oyster House",
  "Beasley's Steakhouse",
  "Toes on the Beach",
  "NOLA Eatery",
  "Fin Seafood Restaurant",
  "Oporto Restaurant",
  "Cactus Flower Cafe",
  "Mathers Social Gathering",

  // Gulf Shores
  "Lulu's",
  "The Jolly Roger Pier Restaurant",
  "Gulf State Park Pavilion Restaurant",
  "SouthShoreman Restaurant & Bar",
  "DJax Cafe",
  "Sandshaker Lounge",
  "Coastal Grille",
  "The Hangout",
  "Fried Green Tomatoes",
  "Sea N Suds",
  "Donut Hole Bakery & Coffee",
  "Pink Pony",
  "Gulf Shores Steaks & Seafood",
  "Island Grill Restaurant",
  "Paradise Bar & Grill",
  "The Deck at Mary's",
  "Gulf Shores Beach Club",
  "Water Street Seafood",
  "Shrimp Shack",
  "Nicks Restaurant",
];

// Check which ones might not be scraped
const possiblyMissing = commonRestaurants.filter((name) => {
  const slug = name
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "-");
  return !scrapedFolders.includes(slug);
});

console.log(`\n\n🔍 POTENTIAL RESTAURANTS TO SCRAPE`);
console.log(`====================================`);
console.log(`\nThese are common restaurants in the area we may not have yet:\n`);

possiblyMissing.forEach((name) => {
  console.log(`  → ${name}`);
});

console.log(`\n\nPossible new targets: ${possiblyMissing.length}`);

// Save to file for reference
const report = {
  generated_at: new Date().toISOString(),
  total_scraped: scrapedFolders.length,
  scraped_restaurants: scrapedFolders,
  potentially_missing: possiblyMissing,
  to_scrape_count: possiblyMissing.length,
  notes: "Use the names in 'potentially_missing' to create a scraping queue"
};

fs.writeFileSync(
  "/Users/owner/cybercheck-api-database/restaurant-coverage-report.json",
  JSON.stringify(report, null, 2)
);

console.log(`\n✓ Report saved to: restaurant-coverage-report.json`);
