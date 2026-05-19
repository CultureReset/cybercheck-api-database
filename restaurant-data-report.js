#!/usr/bin/env node
/**
 * RESTAURANT DATA COMPLETENESS REPORT
 * Shows which restaurants have the most complete data for import to database
 */

const fs = require('fs');
const path = require('path');

const extractedDir = './extracted-restaurants';
const indexPath = path.join(extractedDir, 'INDEX.json');

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

console.log('📊 RESTAURANT DATA COMPLETENESS REPORT\n');
console.log('═══════════════════════════════════════════════════════\n');

// Categorize by data completeness
const categories = {
  'COMPLETE (Menu + Specials + HH + Events)': [],
  'FULL MENU (50+ items)': [],
  'GOOD MENU (20-49 items)': [],
  'BASIC MENU (5-19 items)': [],
  'MINIMAL MENU (1-4 items)': [],
  'SPECIALS ONLY': [],
  'NO DATA': []
};

index.forEach(r => {
  const totalItems = r.menu_items + r.drinks + r.specials + r.happy_hours + r.events;

  if (r.menu_items >= 50 && r.specials > 0 && r.happy_hours > 0 && r.events > 0) {
    categories['COMPLETE (Menu + Specials + HH + Events)'].push(r);
  } else if (r.menu_items >= 50) {
    categories['FULL MENU (50+ items)'].push(r);
  } else if (r.menu_items >= 20) {
    categories['GOOD MENU (20-49 items)'].push(r);
  } else if (r.menu_items >= 5) {
    categories['BASIC MENU (5-19 items)'].push(r);
  } else if (r.menu_items >= 1) {
    categories['MINIMAL MENU (1-4 items)'].push(r);
  } else if (r.specials > 0 || r.happy_hours > 0 || r.events > 0) {
    categories['SPECIALS ONLY'].push(r);
  } else {
    categories['NO DATA'].push(r);
  }
});

// Display categories
Object.entries(categories).forEach(([cat, restaurants]) => {
  if (restaurants.length === 0) return;

  console.log(`\n${cat} (${restaurants.length})\n`);
  console.log('─'.repeat(60));

  restaurants.sort((a, b) => (b.menu_items + b.specials + b.happy_hours + b.events) - (a.menu_items + a.specials + a.happy_hours + a.events));

  restaurants.slice(0, 15).forEach(r => {
    const total = r.menu_items + r.specials + r.happy_hours + r.events;
    const parts = [];
    if (r.menu_items > 0) parts.push(`Menu: ${r.menu_items}`);
    if (r.specials > 0) parts.push(`Specials: ${r.specials}`);
    if (r.happy_hours > 0) parts.push(`HH: ${r.happy_hours}`);
    if (r.events > 0) parts.push(`Events: ${r.events}`);

    console.log(`${r.name}`);
    console.log(`  📊 ${parts.join(' | ')}`);
    console.log(`  📞 ${r.phone || 'No phone'}`);
    console.log(`  📁 ${r.folder}\n`);
  });

  if (restaurants.length > 15) {
    console.log(`   ... and ${restaurants.length - 15} more\n`);
  }
});

// Summary stats
console.log('\n═══════════════════════════════════════════════════════\n');
console.log('📈 SUMMARY STATISTICS\n');

const withMenu = index.filter(r => r.menu_items > 0).length;
const withSpecials = index.filter(r => r.specials > 0).length;
const withHH = index.filter(r => r.happy_hours > 0).length;
const withEvents = index.filter(r => r.events > 0).length;
const withContact = index.filter(r => r.phone).length;
const totalMenuItems = index.reduce((sum, r) => sum + r.menu_items, 0);
const totalSpecials = index.reduce((sum, r) => sum + r.specials, 0);

console.log(`Total Restaurants: ${index.length}`);
console.log(`With Menu Data: ${withMenu} (${Math.round(withMenu/index.length*100)}%)`);
console.log(`With Specials: ${withSpecials} (${Math.round(withSpecials/index.length*100)}%)`);
console.log(`With Happy Hours: ${withHH} (${Math.round(withHH/index.length*100)}%)`);
console.log(`With Events: ${withEvents} (${Math.round(withEvents/index.length*100)}%)`);
console.log(`With Phone: ${withContact} (${Math.round(withContact/index.length*100)}%)`);
console.log(`\nTotal Menu Items: ${totalMenuItems}`);
console.log(`Total Specials: ${totalSpecials}`);

console.log('\n═══════════════════════════════════════════════════════');
console.log('\n💾 To view a specific restaurant:\n');
console.log('   node view-restaurant-data.js "restaurant name"\n');
console.log('Examples:\n');
console.log('   node view-restaurant-data.js "Bahama Bob"');
console.log('   node view-restaurant-data.js "Sea-N-Suds"');
console.log('   node view-restaurant-data.js "High Tide"\n');
