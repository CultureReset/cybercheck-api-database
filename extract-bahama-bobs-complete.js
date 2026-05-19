#!/usr/bin/env node
/**
 * COMPLETE BAHAMA BOB'S DATA EXTRACTION
 * Extracts: ALL menu items, descriptions, prices, specials, drinks, happy hours
 * Outputs: Console + JSON file
 */

const fs = require('fs');
const path = require('path');

// Find Bahama Bob's folder
const scrapedDir = './scraped-menus';
const bahamaBobsFolders = fs.readdirSync(scrapedDir).filter(f =>
  f.toLowerCase().includes('bahama') && f.toLowerCase().includes('bob')
);

if (bahamaBobsFolders.length === 0) {
  console.error('❌ Bahama Bob\'s folder not found!');
  process.exit(1);
}

const bahamaFolder = bahamaBobsFolders[0];
const folderPath = path.join(scrapedDir, bahamaFolder);

console.log('🔍 COMPLETE BAHAMA BOB\'S MENU & DETAILS EXTRACTION\n');
console.log(`Folder: ${bahamaFolder}\n`);

// Read files
let businessData = {};
const dataPath = path.join(folderPath, 'data.json');
if (fs.existsSync(dataPath)) {
  businessData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

let rawData = {};
const rawPath = path.join(folderPath, 'raw.json');
if (fs.existsSync(rawPath)) {
  rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
}

// Build comprehensive data object
const completeData = {
  business: {
    name: businessData.business_name || 'Bahama Bob\'s',
    type: businessData.type || 'Restaurant',
    tagline: businessData.tagline || '',
    website: businessData.url || '',
    contact: businessData.contact || {},
    hours: businessData.hours || {},
    about: businessData.about || {},
    social_links: businessData.social_links || {},
    atmosphere: businessData.atmosphere || [],
    features: businessData.features || [],
    tags: businessData.tags || [],
    categories: businessData.categories || [],
    cuisine_types: businessData.cuisine_types || []
  },
  menu: [],
  drinks: [],
  specials: [],
  happy_hours: [],
  events: [],
  gallery: businessData.gallery || [],
  scraped_at: businessData.scraped_at || new Date().toISOString()
};

// Extract menu from structured data
if (businessData.menu && businessData.menu.categories) {
  businessData.menu.categories.forEach(cat => {
    if (cat.items && cat.items.length > 0) {
      cat.items.forEach(item => {
        completeData.menu.push({
          category: cat.name || 'Uncategorized',
          name: item.name || '',
          description: item.description || '',
          price: item.price || '',
          notes: item.notes || '',
          dietary_tags: item.dietary_tags || []
        });
      });
    }
  });
}

// Extract drinks from structured data
if (businessData.drinks && businessData.drinks.categories) {
  businessData.drinks.categories.forEach(cat => {
    if (cat.items && cat.items.length > 0) {
      cat.items.forEach(item => {
        completeData.drinks.push({
          category: cat.name || 'Uncategorized',
          name: item.name || '',
          description: item.description || '',
          price: item.price || '',
          notes: item.notes || ''
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
      discount: special.discount || '',
      valid_days: special.valid_days || '',
      valid_times: special.valid_times || '',
      price: special.price || ''
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
      end_time: hh.end_time || '',
      description: hh.description || '',
      specials: hh.specials || []
    });
  });
}

// Extract events
if (businessData.events && businessData.events.length > 0) {
  businessData.events.forEach(event => {
    completeData.events.push({
      name: event.name || '',
      description: event.description || '',
      day: event.day || '',
      time: event.time || '',
      frequency: event.frequency || '',
      recurring: event.recurring || false
    });
  });
}

// Search raw.json for additional menu data
if (rawData.pages) {
  console.log(`\nSearching ${rawData.pages.length} pages for menu content...\n`);

  rawData.pages.forEach(page => {
    const text = (page.text || '').toLowerCase();
    const url = (page.url || '').toLowerCase();

    if (text.includes('menu') || url.includes('menu')) {
      console.log(`📄 Found menu page: ${page.title || page.url}`);
      console.log(`   Content length: ${page.text.length} characters\n`);
    }
  });
}

// ============================================
// DISPLAY OUTPUT
// ============================================

console.log('═══════════════════════════════════════════════════════════\n');
console.log(`🏢 ${completeData.business.name.toUpperCase()}\n`);
console.log(`${completeData.business.tagline}\n`);

// Contact
console.log('📞 CONTACT:');
console.log(`   Phone: ${completeData.business.contact.phone || 'N/A'}`);
console.log(`   Address: ${completeData.business.contact.address || 'N/A'}, ${completeData.business.contact.city || ''}`);
console.log(`   Website: ${completeData.business.contact.website || 'N/A'}\n`);

// Hours
console.log('⏰ HOURS:');
['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
  const time = completeData.business.hours[day] || 'Closed';
  console.log(`   ${day.charAt(0).toUpperCase() + day.slice(1)}: ${time}`);
});
console.log();

// MENU
console.log('\n═══════════════════════════════════════════════════════════');
console.log('🍽️ FULL MENU ITEMS\n');
if (completeData.menu.length > 0) {
  const menuByCategory = {};
  completeData.menu.forEach(item => {
    if (!menuByCategory[item.category]) {
      menuByCategory[item.category] = [];
    }
    menuByCategory[item.category].push(item);
  });

  Object.entries(menuByCategory).forEach(([category, items]) => {
    console.log(`\n📌 ${category.toUpperCase()}\n`);
    items.forEach(item => {
      console.log(`   ${item.name}`);
      if (item.description) console.log(`   ${item.description}`);
      if (item.price) console.log(`   Price: ${item.price}`);
      if (item.dietary_tags && item.dietary_tags.length > 0) {
        console.log(`   Dietary: ${item.dietary_tags.join(', ')}`);
      }
      console.log();
    });
  });
} else {
  console.log('No menu items found in structured data.\n');
}

// DRINKS
console.log('\n═══════════════════════════════════════════════════════════');
console.log('🍹 DRINKS & BEVERAGES\n');
if (completeData.drinks.length > 0) {
  const drinksByCategory = {};
  completeData.drinks.forEach(drink => {
    if (!drinksByCategory[drink.category]) {
      drinksByCategory[drink.category] = [];
    }
    drinksByCategory[drink.category].push(drink);
  });

  Object.entries(drinksByCategory).forEach(([category, items]) => {
    console.log(`\n📌 ${category.toUpperCase()}\n`);
    items.forEach(drink => {
      console.log(`   ${drink.name}`);
      if (drink.description) console.log(`   ${drink.description}`);
      if (drink.price) console.log(`   Price: ${drink.price}`);
      console.log();
    });
  });
} else {
  console.log('No drinks found in structured data.\n');
}

// SPECIALS
console.log('\n═══════════════════════════════════════════════════════════');
console.log('⚡ SPECIALS & DEALS\n');
if (completeData.specials.length > 0) {
  completeData.specials.forEach((special, idx) => {
    console.log(`${idx + 1}. ${special.name}`);
    if (special.description) console.log(`   ${special.description}`);
    if (special.price) console.log(`   Price: ${special.price}`);
    if (special.discount) console.log(`   Discount: ${special.discount}`);
    if (special.valid_days) console.log(`   Days: ${special.valid_days}`);
    if (special.valid_times) console.log(`   Times: ${special.valid_times}`);
    console.log();
  });
} else {
  console.log('No specials found.\n');
}

// HAPPY HOURS
console.log('\n═══════════════════════════════════════════════════════════');
console.log('🍺 HAPPY HOURS\n');
if (completeData.happy_hours.length > 0) {
  completeData.happy_hours.forEach((hh, idx) => {
    console.log(`${idx + 1}. ${hh.name}`);
    console.log(`   Days: ${hh.days || 'N/A'}`);
    console.log(`   Time: ${hh.start_time} - ${hh.end_time}`);
    if (hh.description) console.log(`   ${hh.description}`);
    if (hh.specials && hh.specials.length > 0) {
      console.log(`   Specials:`);
      hh.specials.forEach(s => console.log(`     - ${s}`));
    }
    console.log();
  });
} else {
  console.log('No happy hours found.\n');
}

// EVENTS
console.log('\n═══════════════════════════════════════════════════════════');
console.log('🎉 EVENTS\n');
if (completeData.events.length > 0) {
  completeData.events.forEach((event, idx) => {
    console.log(`${idx + 1}. ${event.name}`);
    if (event.description) console.log(`   ${event.description}`);
    if (event.day) console.log(`   Day: ${event.day}`);
    if (event.time) console.log(`   Time: ${event.time}`);
    console.log();
  });
} else {
  console.log('No events found.\n');
}

// SUMMARY
console.log('\n═══════════════════════════════════════════════════════════');
console.log('📊 SUMMARY\n');
console.log(`Menu Items: ${completeData.menu.length}`);
console.log(`Drinks: ${completeData.drinks.length}`);
console.log(`Specials: ${completeData.specials.length}`);
console.log(`Happy Hours: ${completeData.happy_hours.length}`);
console.log(`Events: ${completeData.events.length}`);
console.log(`Gallery Images: ${completeData.gallery.length}\n`);

// SAVE TO JSON
const outputPath = path.join('.', `bahama-bobs-complete-data.json`);
fs.writeFileSync(outputPath, JSON.stringify(completeData, null, 2));
console.log(`✅ Data saved to: ${outputPath}\n`);

console.log('═══════════════════════════════════════════════════════════');
