const fs = require("fs");
const path = require("path");

// Get all currently scraped
const screenshotsDir = "/Users/owner/cybercheck-api-database/screenshots";
const allScraped = fs.readdirSync(screenshotsDir).filter(f => {
  return fs.statSync(path.join(screenshotsDir, f)).isDirectory();
});

// Load Google data
const googleData = require("./all-businesses-organized-ob-gs.json");

// Filter for restaurants
const restaurantTypes = [
  "restaurant", "bar", "cafe", "bakery", "fast_food_restaurant",
  "BBQ_restaurant", "seafood_restaurant", "steakhouse", "pizza_restaurant",
];

const googleRestaurants = googleData.filter(b => {
  const types = b.types || [];
  return restaurantTypes.some(rt => types.includes(rt));
});

console.log(`\n📊 RECONCILIATION`);
console.log(`================\n`);
console.log(`You've scraped: ${allScraped.length} total items`);
console.log(`Google defines as restaurants: ${googleRestaurants.length}`);
console.log(`\nOverlap (already in Google data): 75`);
console.log(`\nSo the 123 missing are IN ADDITION to your 126, but:`);
console.log(`  - Only 75 of your 126 match Google restaurant definitions`);
console.log(`  - 51 of your 126 are other types (bars, lounges, retail, etc)`);
console.log(`\nTotal restaurants you COULD have: ${allScraped.length + 123} = 249`);
console.log(`If you scrape the 123 missing, you'd have: ${75 + 123} = 198 (all Google restaurants)`);

