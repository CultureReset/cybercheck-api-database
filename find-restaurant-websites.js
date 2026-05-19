const fs = require("fs");
const path = require("path");

// List of restaurants we want to find
const targetRestaurants = [
  "Tackle Box",
  "The Packing Plant",
  "Fisher's Upstairs",
  "Shoney's",
  "Outback Steakhouse",
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
  "The Jolly Roger Pier Restaurant",
  "Gulf State Park Pavilion Restaurant",
  "SouthShoreman Restaurant & Bar",
  "DJax Cafe",
  "Sandshaker Lounge",
  "Coastal Grille",
  "Fried Green Tomatoes",
  "Donut Hole Bakery & Coffee",
  "Island Grill Restaurant",
  "Paradise Bar & Grill",
  "The Deck at Mary's",
  "Gulf Shores Beach Club",
  "Water Street Seafood",
  "Shrimp Shack",
  "Nicks Restaurant",
];

// Try to find websites from existing scraped data
function findWebsitesFromScrapedData() {
  const screenshotsDir = "/Users/owner/cybercheck-api-database/screenshots";
  const foundWebsites = {};

  // Read all index.json files
  fs.readdirSync(screenshotsDir).forEach((folder) => {
    const indexPath = path.join(screenshotsDir, folder, "index.json");
    if (fs.existsSync(indexPath)) {
      try {
        const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
        foundWebsites[folder] = index.source_url;
      } catch (e) {
        // Skip if JSON parse fails
      }
    }
  });

  return foundWebsites;
}

// Match restaurant names with patterns
function matchRestaurantToWebsite(restaurantName, existingWebsites) {
  const nameLower = restaurantName.toLowerCase();

  // Try exact match or partial match
  for (const [folder, website] of Object.entries(existingWebsites)) {
    const folderLower = folder.toLowerCase();
    if (
      folderLower.includes(nameLower.replace(/\s+/g, "-").replace(/[^\w-]/g, ""))
    ) {
      return website;
    }
  }

  return null;
}

// Generate search queries for manual lookup
function generateSearchQueries(restaurantName) {
  return [
    `${restaurantName} Orange Beach Alabama website`,
    `${restaurantName} Gulf Shores Alabama website`,
    `${restaurantName} Orange Beach menu`,
    `${restaurantName} Gulf Shores menu`,
  ];
}

// Main execution
console.log(`\n🔎 WEBSITE FINDER FOR NEW RESTAURANTS`);
console.log(`======================================\n`);

const foundWebsites = findWebsitesFromScrapedData();

console.log(`Found ${Object.keys(foundWebsites).length} existing websites\n`);

const results = {
  found: [],
  likely_found: [],
  not_found: [],
};

targetRestaurants.forEach((restaurant) => {
  const website = matchRestaurantToWebsite(restaurant, foundWebsites);

  if (website) {
    results.found.push({
      restaurant,
      website,
      source: "matched_to_existing_data",
    });
    console.log(`✓ FOUND: ${restaurant}`);
    console.log(`  → ${website}\n`);
  } else {
    results.not_found.push({
      restaurant,
      search_queries: generateSearchQueries(restaurant),
    });
    console.log(`✗ NOT FOUND: ${restaurant}`);
    console.log(`  Search: ${restaurant} Orange Beach/Gulf Shores AL\n`);
  }
});

// Create manual lookup list
const manualLookupList = results.not_found.map((item) => ({
  restaurant: item.restaurant,
  google_search: `${item.restaurant} Orange Beach Alabama website`,
  yelp_search: `${item.restaurant} Orange Beach AL`,
  type: "manual_lookup_required",
}));

// Save all results
const summary = {
  generated_at: new Date().toISOString(),
  total_targets: targetRestaurants.length,
  found_from_existing: results.found.length,
  need_manual_lookup: results.not_found.length,
  found_websites: results.found,
  manual_lookup_required: manualLookupList,
};

fs.writeFileSync(
  "/Users/owner/cybercheck-api-database/website-search-results.json",
  JSON.stringify(summary, null, 2)
);

console.log(`\n📊 SUMMARY`);
console.log(`==========`);
console.log(`Already in system: ${results.found.length}`);
console.log(`Need manual lookup: ${results.not_found.length}`);
console.log(`\n✓ Saved to: website-search-results.json`);

// Print manual lookup instructions
if (manualLookupList.length > 0) {
  console.log(`\n\n📋 MANUAL LOOKUP INSTRUCTIONS`);
  console.log(`==============================\n`);
  console.log(`Open these in your browser or use a search API:\n`);

  manualLookupList.forEach((item) => {
    console.log(`${item.restaurant}`);
    console.log(`  Google: ${item.google_search}`);
    console.log(`  Yelp: ${item.yelp_search}`);
    console.log();
  });
}
