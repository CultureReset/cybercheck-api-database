#!/usr/bin/env node
/**
 * EXTRACT BAHAMA BOB'S DATA
 * Pulls all data from scraped Bahama Bob's folder
 * Extracts: menu, happy hours, specials, descriptions, contact, hours, etc.
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

console.log('🔍 BAHAMA BOB\'S COMPLETE DATA EXTRACTION\n');
console.log(`Folder: ${bahamaFolder}\n`);
console.log('═══════════════════════════════════════════════════════════\n');

// Read data.json
let businessData = {};
const dataPath = path.join(folderPath, 'data.json');
if (fs.existsSync(dataPath)) {
  businessData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  console.log('✅ data.json loaded\n');
}

// Read raw.json
let rawData = {};
const rawPath = path.join(folderPath, 'raw.json');
if (fs.existsSync(rawPath)) {
  rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  console.log('✅ raw.json loaded\n');
}

// ============================================
// BASIC INFO
// ============================================
console.log('📋 BASIC INFORMATION\n');
console.log(`Business Name: ${businessData.business_name || 'N/A'}`);
console.log(`Type: ${businessData.type || 'N/A'}`);
console.log(`Tagline: ${businessData.tagline || 'N/A'}`);
console.log(`Categories: ${(businessData.categories || []).join(', ') || 'N/A'}`);
console.log(`Cuisine Types: ${(businessData.cuisine_types || []).join(', ') || 'N/A'}`);
console.log(`Website: ${businessData.url || 'N/A'}`);
console.log(`Scraped: ${businessData.scraped_at || 'N/A'}`);

// ============================================
// CONTACT INFO
// ============================================
console.log('\n\n📞 CONTACT INFORMATION\n');
const contact = businessData.contact || {};
console.log(`Phone: ${contact.phone || 'N/A'}`);
console.log(`Email: ${contact.email || 'N/A'}`);
console.log(`Address: ${contact.address || 'N/A'}`);
console.log(`City: ${contact.city || 'N/A'}`);
console.log(`State: ${contact.state || 'N/A'}`);
console.log(`Zip: ${contact.zip || 'N/A'}`);

// ============================================
// HOURS OF OPERATION
// ============================================
console.log('\n\n⏰ HOURS OF OPERATION\n');
const hours = businessData.hours || {};
['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
  const time = hours[day] || 'N/A';
  console.log(`${day.charAt(0).toUpperCase() + day.slice(1)}: ${time}`);
});
if (hours.notes) console.log(`\nNotes: ${hours.notes}`);

// ============================================
// ABOUT/DESCRIPTION
// ============================================
console.log('\n\n📝 ABOUT THE BUSINESS\n');
const about = businessData.about || {};
if (about.description) {
  console.log('Description:');
  console.log(about.description);
}
if (about.elevator_pitch) {
  console.log(`\nElevator Pitch: ${about.elevator_pitch}`);
}
if (about.vibe) {
  console.log(`\nVibe: ${about.vibe}`);
}
if (about.best_for && about.best_for.length > 0) {
  console.log(`\nBest For: ${about.best_for.join(', ')}`);
}
if (about.insider_tip) {
  console.log(`\nInsider Tip: ${about.insider_tip}`);
}
if (about.awards && about.awards.length > 0) {
  console.log(`\nAwards: ${about.awards.join(', ')}`);
}
if (about.press && about.press.length > 0) {
  console.log(`\nPress Mentions:`);
  about.press.forEach(p => console.log(`  - ${p}`));
}

// ============================================
// ATMOSPHERE & FEATURES
// ============================================
console.log('\n\n🎨 ATMOSPHERE & FEATURES\n');
if (businessData.atmosphere && businessData.atmosphere.length > 0) {
  console.log('Atmosphere:');
  businessData.atmosphere.forEach(a => console.log(`  - ${a}`));
}
if (businessData.features && businessData.features.length > 0) {
  console.log('\nFeatures:');
  businessData.features.forEach(f => console.log(`  - ${f}`));
}

// ============================================
// TAGS & HASHTAGS
// ============================================
console.log('\n\n🏷️ TAGS & HASHTAGS\n');
if (businessData.tags && businessData.tags.length > 0) {
  console.log('Tags:');
  businessData.tags.forEach(t => console.log(`  - ${t}`));
}
if (businessData.hashtags && businessData.hashtags.length > 0) {
  console.log('\nHashtags:');
  businessData.hashtags.forEach(h => console.log(`  ${h}`));
}

// ============================================
// MENU
// ============================================
console.log('\n\n🍽️ MENU ITEMS\n');
if (businessData.menu && businessData.menu.categories && businessData.menu.categories.length > 0) {
  console.log('Menu Categories:');
  businessData.menu.categories.forEach(cat => {
    console.log(`\n  ${cat.name || 'Unknown Category'}`);
    if (cat.description) console.log(`  ${cat.description}`);
    if (cat.items && cat.items.length > 0) {
      cat.items.forEach(item => {
        console.log(`    - ${item.name || 'N/A'}`);
        if (item.description) console.log(`      ${item.description}`);
        if (item.price) console.log(`      Price: ${item.price}`);
      });
    }
  });
} else {
  console.log('No structured menu data found in extraction.');
  console.log('\nSearching raw.json for menu information...');

  if (rawData.pages && rawData.pages.length > 0) {
    const menuPages = rawData.pages.filter(p =>
      p.url.toLowerCase().includes('menu') || p.text.toLowerCase().includes('menu')
    );

    if (menuPages.length > 0) {
      console.log(`\nFound ${menuPages.length} menu-related pages in raw data:`);
      menuPages.forEach((page, idx) => {
        console.log(`\n  Page ${idx + 1}: ${page.title || page.url}`);
        console.log(`  URL: ${page.url}`);
        console.log(`  Content preview (first 500 chars):`);
        console.log(`  ${(page.text || '').substring(0, 500)}...`);
      });
    }
  }
}

// ============================================
// HAPPY HOURS
// ============================================
console.log('\n\n🍺 HAPPY HOURS\n');
if (businessData.happy_hours && businessData.happy_hours.length > 0) {
  businessData.happy_hours.forEach((hh, idx) => {
    console.log(`Happy Hour ${idx + 1}:`);
    console.log(`  Name: ${hh.name || 'N/A'}`);
    console.log(`  Days: ${hh.days || 'N/A'}`);
    console.log(`  Time: ${hh.start_time || 'N/A'} - ${hh.end_time || 'N/A'}`);
    console.log(`  Description: ${hh.description || 'N/A'}`);
    if (hh.specials && hh.specials.length > 0) {
      console.log(`  Specials:`);
      hh.specials.forEach(s => console.log(`    - ${s}`));
    }
    console.log();
  });
} else {
  console.log('No structured happy hour data found.');
}

// ============================================
// SPECIALS & DEALS
// ============================================
console.log('\n\n⚡ SPECIALS & DEALS\n');
if (businessData.specials && businessData.specials.length > 0) {
  businessData.specials.forEach((special, idx) => {
    console.log(`Special ${idx + 1}: ${special.name || 'N/A'}`);
    console.log(`  Description: ${special.description || 'N/A'}`);
    if (special.discount) console.log(`  Discount: ${special.discount}`);
    if (special.valid_days) console.log(`  Valid Days: ${special.valid_days}`);
    if (special.valid_times) console.log(`  Valid Times: ${special.valid_times}`);
    console.log();
  });
} else {
  console.log('No specials found in structured data.');
}

// ============================================
// EVENTS
// ============================================
console.log('\n\n🎉 EVENTS\n');
if (businessData.events && businessData.events.length > 0) {
  businessData.events.forEach((event, idx) => {
    console.log(`Event ${idx + 1}: ${event.name || 'N/A'}`);
    console.log(`  Description: ${event.description || 'N/A'}`);
    console.log(`  Recurring: ${event.recurring ? 'Yes' : 'No'}`);
    if (event.day) console.log(`  Day: ${event.day}`);
    if (event.time) console.log(`  Time: ${event.time}`);
    if (event.frequency) console.log(`  Frequency: ${event.frequency}`);
    console.log();
  });
} else {
  console.log('No events found.');
}

// ============================================
// SOCIAL & LINKS
// ============================================
console.log('\n\n📱 SOCIAL MEDIA & LINKS\n');
const social = businessData.social_links || {};
Object.entries(social).forEach(([platform, url]) => {
  if (url) console.log(`${platform}: ${url}`);
});

// ============================================
// GALLERY/IMAGES
// ============================================
console.log('\n\n🖼️ GALLERY/IMAGES\n');
if (businessData.gallery && businessData.gallery.length > 0) {
  console.log(`Total Images: ${businessData.gallery.length}`);
  businessData.gallery.forEach((img, idx) => {
    console.log(`  ${idx + 1}. ${img}`);
  });
} else {
  console.log('No gallery images found.');
}

// ============================================
// SOURCE PAGES
// ============================================
console.log('\n\n📄 SOURCE PAGES SCRAPED\n');
if (businessData.sources && businessData.sources.length > 0) {
  businessData.sources.forEach(src => console.log(`  - ${src}`));
} else if (rawData.pages) {
  console.log(`Total pages scraped: ${rawData.pages.length}`);
  rawData.pages.forEach(page => console.log(`  - ${page.title || page.url}`));
}

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log('✅ EXTRACTION COMPLETE\n');
