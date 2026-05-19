#!/usr/bin/env node
/**
 * CSV SUMMARY OF ALL EXTRACTED RESTAURANT DATA
 * Creates a spreadsheet view of what data exists for each restaurant
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const scrapedDir = './scraped-menus';

const folders = fs.readdirSync(scrapedDir)
  .filter(f => {
    const fullPath = path.join(scrapedDir, f);
    return fs.statSync(fullPath).isDirectory() && !f.startsWith('_');
  })
  .sort();

console.log(`📊 Processing ${folders.length} restaurants for CSV export...\n`);

const csvData = [];

folders.forEach((folderName, idx) => {
  const folderPath = path.join(scrapedDir, folderName);
  const dataPath = path.join(folderPath, 'data.json');
  const rawPath = path.join(folderPath, 'raw.json');

  try {
    let businessData = {};
    if (fs.existsSync(dataPath)) {
      businessData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }

    const businessName = businessData.business_name || folderName;
    const contact = businessData.contact || {};
    const about = businessData.about || {};

    // Count menu items
    let menuCount = 0;
    if (businessData.menu && businessData.menu.categories) {
      businessData.menu.categories.forEach(cat => {
        if (cat.items) menuCount += cat.items.length;
      });
    }

    // Count drinks
    let drinkCount = 0;
    if (businessData.drinks && businessData.drinks.categories) {
      businessData.drinks.categories.forEach(cat => {
        if (cat.items) drinkCount += cat.items.length;
      });
    }

    // Count specials
    const specialCount = (businessData.specials || []).length;

    // Count happy hours
    const hhCount = (businessData.happy_hours || []).length;

    // Count events
    const eventCount = (businessData.events || []).length;

    // Count tags
    const tagCount = (businessData.tags || []).length;

    // Count sections
    const sectionCount = (businessData.menu && businessData.menu.categories ? businessData.menu.categories.length : 0);

    const row = {
      'Name': businessName,
      'Type': businessData.type || '',
      'City': contact.city || '',
      'Phone': contact.phone || '',
      'Email': contact.email || '',
      'Website': businessData.url || '',
      'Has Description': about.description ? 'YES' : 'NO',
      'Menu Items': menuCount,
      'Menu Categories': sectionCount,
      'Drinks': drinkCount,
      'Specials': specialCount,
      'Happy Hours': hhCount,
      'Events': eventCount,
      'Tags': tagCount,
      'Total Data Points': menuCount + drinkCount + specialCount + hhCount + eventCount + tagCount,
      'Folder': folderName,
      'Has Raw JSON': fs.existsSync(rawPath) ? 'YES' : 'NO'
    };

    csvData.push(row);
    if ((idx + 1) % 50 === 0) {
      console.log(`✓ Processed ${idx + 1}/${folders.length}`);
    }

  } catch (error) {
    console.log(`❌ Error processing ${folderName}: ${error.message}`);
  }
});

// Create Excel workbook
const ws = XLSX.utils.json_to_sheet(csvData);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Restaurants');

// Set column widths
ws['!cols'] = [
  { wch: 25 }, // Name
  { wch: 15 }, // Type
  { wch: 15 }, // City
  { wch: 15 }, // Phone
  { wch: 20 }, // Email
  { wch: 25 }, // Website
  { wch: 12 }, // Has Description
  { wch: 12 }, // Menu Items
  { wch: 15 }, // Menu Categories
  { wch: 10 }, // Drinks
  { wch: 10 }, // Specials
  { wch: 12 }, // Happy Hours
  { wch: 10 }, // Events
  { wch: 10 }, // Tags
  { wch: 15 }, // Total Data Points
  { wch: 25 }, // Folder
  { wch: 12 }  // Has Raw JSON
];

const outputPath = './ALL-RESTAURANTS-DATA-SUMMARY.xlsx';
XLSX.writeFile(wb, outputPath);

console.log(`\n✅ CSV Export Complete!\n`);
console.log(`📁 File: ${outputPath}`);
console.log(`📊 Total restaurants: ${csvData.length}\n`);

// Stats
const withMenu = csvData.filter(r => r['Menu Items'] > 0).length;
const withDrinks = csvData.filter(r => r['Drinks'] > 0).length;
const withSpecials = csvData.filter(r => r['Specials'] > 0).length;
const withHH = csvData.filter(r => r['Happy Hours'] > 0).length;
const withEvents = csvData.filter(r => r['Events'] > 0).length;
const totalMenuItems = csvData.reduce((sum, r) => sum + r['Menu Items'], 0);
const totalDrinks = csvData.reduce((sum, r) => sum + r['Drinks'], 0);

console.log('📈 SUMMARY STATISTICS\n');
console.log(`Restaurants with menu items: ${withMenu} (${Math.round(withMenu/csvData.length*100)}%)`);
console.log(`Restaurants with drinks: ${withDrinks} (${Math.round(withDrinks/csvData.length*100)}%)`);
console.log(`Restaurants with specials: ${withSpecials} (${Math.round(withSpecials/csvData.length*100)}%)`);
console.log(`Restaurants with happy hours: ${withHH} (${Math.round(withHH/csvData.length*100)}%)`);
console.log(`Restaurants with events: ${withEvents} (${Math.round(withEvents/csvData.length*100)}%)`);
console.log(`\nTotal menu items across all: ${totalMenuItems}`);
console.log(`Total drinks across all: ${totalDrinks}`);

// Top 5
const sorted = [...csvData].sort((a, b) => b['Total Data Points'] - a['Total Data Points']);
console.log('\n🏆 TOP 5 BY TOTAL DATA POINTS\n');
sorted.slice(0, 5).forEach((r, idx) => {
  console.log(`${idx + 1}. ${r['Name']} - ${r['Total Data Points']} items (Menu: ${r['Menu Items']}, Drinks: ${r['Drinks']}, Specials: ${r['Specials']}, HH: ${r['Happy Hours']}, Events: ${r['Events']})`);
});

console.log('\n═════════════════════════════════════════════════════════\n');
