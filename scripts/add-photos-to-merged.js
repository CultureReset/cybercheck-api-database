#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('ADD PHOTOS TO MERGED BUSINESSES');
console.log('='.repeat(80) + '\n');

// Load merged data
const merged = JSON.parse(fs.readFileSync('./consolidation/FINAL-MERGED-ALL.json'));

console.log('Loaded: ' + merged.length + ' businesses\n');

// Photo directories
const photoDirs = [
  './activity-photos',
  './restaurant-photos',
  './shopping-services-photos',
  './specialty-photos'
];

// Build photo map by Place ID
const photoMap = new Map();

photoDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log('⚠ ' + dir + ' not found');
    return;
  }

  const items = fs.readdirSync(dir).filter(item => item !== '.DS_Store');

  items.forEach(placeId => {
    const folderPath = path.join(dir, placeId);
    if (!fs.statSync(folderPath).isDirectory()) return;

    const photos = fs.readdirSync(folderPath)
      .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
      .map(f => path.join(dir, placeId, f));

    if (photos.length > 0) {
      photoMap.set(placeId, photos);
    }
  });
});

console.log('Found photos for ' + photoMap.size + ' Place IDs\n');

// Add photos to merged businesses
let withPhotos = 0;
let totalPhotos = 0;

merged.forEach(business => {
  const placeId = business.id;

  if (photoMap.has(placeId)) {
    business.photos = photoMap.get(placeId);
    withPhotos++;
    totalPhotos += business.photos.length;
  }
});

console.log('='.repeat(80));
console.log('RESULTS');
console.log('='.repeat(80));
console.log('Businesses with photos: ' + withPhotos);
console.log('Total photos added: ' + totalPhotos);
console.log('Average per business: ' + (totalPhotos / withPhotos || 0).toFixed(1) + '\n');

// Save updated data
fs.writeFileSync('./consolidation/FINAL-MERGED-ALL.json', JSON.stringify(merged, null, 2));

console.log('✓ Photos linked to businesses');
console.log('✓ File updated: consolidation/FINAL-MERGED-ALL.json');
