#!/usr/bin/env node
/**
 * VIEW EXTRACTED RESTAURANT DATA
 * Usage: node view-restaurant-data.js "restaurant name" OR "folder-name"
 * Shows full menu, specials, contact info, about text, etc.
 */

const fs = require('fs');
const path = require('path');

const searchTerm = process.argv[2];

if (!searchTerm) {
  console.log('❌ Usage: node view-restaurant-data.js "restaurant name or folder"\n');
  console.log('Examples:');
  console.log('  node view-restaurant-data.js "Bahama Bob"');
  console.log('  node view-restaurant-data.js "bahamabobs-com"');
  console.log('  node view-restaurant-data.js "sea-n-suds"');
  process.exit(1);
}

const extractedDir = './extracted-restaurants';
const indexPath = path.join(extractedDir, 'INDEX.json');

// Load index
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

// Search for matching restaurant
const matches = index.filter(r =>
  r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  r.folder.toLowerCase().includes(searchTerm.toLowerCase())
);

if (matches.length === 0) {
  console.log(`❌ No restaurants found matching "${searchTerm}"\n`);
  process.exit(1);
}

if (matches.length > 1) {
  console.log(`🔍 Found ${matches.length} matches for "${searchTerm}":\n`);
  matches.forEach((m, idx) => {
    console.log(`${idx + 1}. ${m.name} (${m.folder})`);
    console.log(`   Menu: ${m.menu_items}, Drinks: ${m.drinks}, Specials: ${m.specials}, HH: ${m.happy_hours}\n`);
  });
  console.log(`Run again with a more specific name to view details.\n`);
  process.exit(1);
}

const match = matches[0];
const dataPath = path.join(extractedDir, match.file);
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Display extracted data
console.log('═══════════════════════════════════════════════════════\n');
console.log(`🏢 ${data.name.toUpperCase()}\n`);

// Contact
console.log('📞 CONTACT:');
console.log(`   Phone: ${data.contact.phone || 'N/A'}`);
console.log(`   Address: ${data.contact.address || 'N/A'}, ${data.contact.city || 'N/A'}`);
console.log(`   Email: ${data.contact.email || 'N/A'}`);
console.log(`   Website: ${data.website || 'N/A'}\n`);

// About
if (data.about.description) {
  console.log('📝 ABOUT:\n');
  console.log(data.about.description);
  console.log();
}

if (data.about.elevator_pitch) {
  console.log('✨ ELEVATOR PITCH:\n');
  console.log(data.about.elevator_pitch);
  console.log();
}

if (data.about.insider_tip) {
  console.log('💡 INSIDER TIP:\n');
  console.log(data.about.insider_tip);
  console.log();
}

// Hours
if (Object.keys(data.hours).length > 0) {
  console.log('⏰ HOURS:');
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
    if (data.hours[day]) {
      console.log(`   ${day.charAt(0).toUpperCase() + day.slice(1)}: ${data.hours[day]}`);
    }
  });
  console.log();
}

// Menu
if (data.menu.length > 0) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`🍽️ MENU (${data.menu.length} items)\n`);

  const byCategory = {};
  data.menu.forEach(item => {
    if (!byCategory[item.category]) byCategory[item.category] = [];
    byCategory[item.category].push(item);
  });

  Object.entries(byCategory).forEach(([cat, items]) => {
    console.log(`📌 ${cat.toUpperCase()}\n`);
    items.forEach(item => {
      console.log(`   ${item.name}`);
      if (item.description) console.log(`   ${item.description}`);
      if (item.price) console.log(`   💵 ${item.price}`);
      console.log();
    });
  });
}

// Specials
if (data.specials.length > 0) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`⚡ SPECIALS (${data.specials.length})\n`);
  data.specials.forEach((special, idx) => {
    console.log(`${idx + 1}. ${special.name}`);
    if (special.description) console.log(`   ${special.description}`);
    if (special.discount) console.log(`   💰 ${special.discount}`);
    console.log();
  });
}

// Happy Hours
if (data.happy_hours.length > 0) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`🍺 HAPPY HOURS (${data.happy_hours.length})\n`);
  data.happy_hours.forEach((hh, idx) => {
    console.log(`${idx + 1}. ${hh.name}`);
    if (hh.days) console.log(`   Days: ${hh.days}`);
    if (hh.start_time && hh.end_time) console.log(`   Time: ${hh.start_time} - ${hh.end_time}`);
    console.log();
  });
}

// Events
if (data.events.length > 0) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`🎉 EVENTS (${data.events.length})\n`);
  data.events.forEach((event, idx) => {
    console.log(`${idx + 1}. ${event.name}`);
    if (event.day) console.log(`   Day: ${event.day}`);
    if (event.time) console.log(`   Time: ${event.time}`);
    console.log();
  });
}

console.log('═══════════════════════════════════════════════════════');
console.log('\n💾 View extracted JSON:\n');
console.log(`   cat extracted-restaurants/${match.file}\n`);
