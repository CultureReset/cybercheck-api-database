#!/usr/bin/env node
/**
 * BULK RESTAURANT DATA EXTRACTION
 * Extracts menu, specials, drinks, happy hours, events from ALL restaurants
 * Outputs: Individual JSON files + Master summary
 */

const fs = require('fs');
const path = require('path');

const scrapedDir = './scraped-menus';
const outputDir = './extracted-restaurants';

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Get all folders (exclude debug files)
const folders = fs.readdirSync(scrapedDir)
  .filter(f => {
    const fullPath = path.join(scrapedDir, f);
    return fs.statSync(fullPath).isDirectory() && !f.startsWith('_');
  })
  .sort();

console.log(`🔍 Found ${folders.length} restaurant folders\n`);
console.log('═════════════════════════════════════════════════════════\n');

const masterIndex = [];
let successCount = 0;
let errorCount = 0;

// Process each restaurant
folders.forEach((folderName, idx) => {
  const folderPath = path.join(scrapedDir, folderName);
  const dataPath = path.join(folderPath, 'data.json');
  const rawPath = path.join(folderPath, 'raw.json');

  let businessData = {};
  let rawData = {};

  try {
    if (fs.existsSync(dataPath)) {
      businessData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }

    if (fs.existsSync(rawPath)) {
      rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
    }

    const businessName = businessData.business_name || folderName;

    // Build comprehensive data
    const completeData = {
      name: businessName,
      type: businessData.type || 'Restaurant',
      website: businessData.url || '',
      contact: {
        phone: (businessData.contact || {}).phone || '',
        address: (businessData.contact || {}).address || '',
        city: (businessData.contact || {}).city || '',
        email: (businessData.contact || {}).email || ''
      },
      hours: businessData.hours || {},
      about: businessData.about || {},
      social: businessData.social_links || {},
      menu: [],
      drinks: [],
      specials: [],
      happy_hours: [],
      events: [],
      gallery: (businessData.gallery || []).length,
      scraped_at: businessData.scraped_at || new Date().toISOString()
    };

    // Extract menu
    if (businessData.menu && businessData.menu.categories) {
      businessData.menu.categories.forEach(cat => {
        if (cat.items) {
          cat.items.forEach(item => {
            completeData.menu.push({
              category: cat.name || 'Uncategorized',
              name: item.name || '',
              description: item.description || '',
              price: item.price || ''
            });
          });
        }
      });
    }

    // Extract drinks
    if (businessData.drinks && businessData.drinks.categories) {
      businessData.drinks.categories.forEach(cat => {
        if (cat.items) {
          cat.items.forEach(item => {
            completeData.drinks.push({
              category: cat.name || 'Uncategorized',
              name: item.name || '',
              description: item.description || '',
              price: item.price || ''
            });
          });
        }
      });
    }

    // Extract specials
    if (businessData.specials && businessData.specials.length > 0) {
      businessData.specials.forEach(special => {
        completeData.specials.push({
          name: special.name || '',
          description: special.description || '',
          discount: special.discount || ''
        });
      });
    }

    // Extract happy hours
    if (businessData.happy_hours && businessData.happy_hours.length > 0) {
      businessData.happy_hours.forEach(hh => {
        completeData.happy_hours.push({
          name: hh.name || 'Happy Hour',
          days: hh.days || '',
          start_time: hh.start_time || '',
          end_time: hh.end_time || ''
        });
      });
    }

    // Extract events
    if (businessData.events && businessData.events.length > 0) {
      businessData.events.forEach(event => {
        completeData.events.push({
          name: event.name || '',
          day: event.day || '',
          time: event.time || ''
        });
      });
    }

    // Save individual file
    const outputFile = path.join(outputDir, `${folderName}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(completeData, null, 2));

    // Add to master index
    masterIndex.push({
      folder: folderName,
      name: businessName,
      menu_items: completeData.menu.length,
      drinks: completeData.drinks.length,
      specials: completeData.specials.length,
      happy_hours: completeData.happy_hours.length,
      events: completeData.events.length,
      phone: completeData.contact.phone,
      city: completeData.contact.city,
      file: `${folderName}.json`
    });

    console.log(`✅ ${idx + 1}. ${businessName}`);
    console.log(`   Menu: ${completeData.menu.length} | Drinks: ${completeData.drinks.length} | Specials: ${completeData.specials.length} | HH: ${completeData.happy_hours.length}`);
    successCount++;

  } catch (error) {
    console.log(`❌ ${idx + 1}. ${folderName} - ${error.message}`);
    errorCount++;
  }
});

// Save master index
const indexPath = path.join(outputDir, 'INDEX.json');
fs.writeFileSync(indexPath, JSON.stringify(masterIndex, null, 2));

// Create summary report
console.log('\n═════════════════════════════════════════════════════════\n');
console.log('📊 EXTRACTION SUMMARY\n');
console.log(`✅ Successful: ${successCount}`);
console.log(`❌ Failed: ${errorCount}`);
console.log(`📁 Output directory: ${outputDir}\n`);

// Statistics
const totalMenuItems = masterIndex.reduce((sum, r) => sum + r.menu_items, 0);
const totalDrinks = masterIndex.reduce((sum, r) => sum + r.drinks, 0);
const totalSpecials = masterIndex.reduce((sum, r) => sum + r.specials, 0);
const totalHH = masterIndex.reduce((sum, r) => sum + r.happy_hours, 0);
const totalEvents = masterIndex.reduce((sum, r) => sum + r.events, 0);

console.log('📈 DATA TOTALS\n');
console.log(`Menu Items: ${totalMenuItems}`);
console.log(`Drinks: ${totalDrinks}`);
console.log(`Specials: ${totalSpecials}`);
console.log(`Happy Hours: ${totalHH}`);
console.log(`Events: ${totalEvents}\n`);

// Top restaurants by data
const sorted = [...masterIndex].sort((a, b) =>
  (b.menu_items + b.drinks + b.specials + b.happy_hours) -
  (a.menu_items + a.drinks + a.specials + a.happy_hours)
);

console.log('🏆 TOP RESTAURANTS BY DATA\n');
sorted.slice(0, 10).forEach((r, idx) => {
  const total = r.menu_items + r.drinks + r.specials + r.happy_hours;
  console.log(`${idx + 1}. ${r.name}`);
  console.log(`   Total items: ${total} (Menu: ${r.menu_items}, Drinks: ${r.drinks}, Specials: ${r.specials}, HH: ${r.happy_hours})\n`);
});

console.log('═════════════════════════════════════════════════════════');
