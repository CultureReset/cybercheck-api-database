#!/usr/bin/env node

const fs = require('fs');

console.log('='.repeat(80));
console.log('MERGE: Google + GCR (all data, no duplicates)');
console.log('='.repeat(80) + '\n');

const gcr = JSON.parse(fs.readFileSync('./gulf-coast-radar-full-export.json'));
const googleLocal = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));

const gcrObGs = gcr.data.entity.filter(e => {
  const city = (e.city || '').toLowerCase().trim();
  return city === 'orange beach' || city === 'gulf shores';
});

console.log('GCR OB+GS: ' + gcrObGs.length);
console.log('Google Local: ' + googleLocal.length + '\n');

// Build GCR lookup
const gcrByName = new Map();
const gcrByPhone = new Map();
const gcrById = new Map();

gcrObGs.forEach(e => {
  const name = (e.name || '').toLowerCase().trim();
  const phone = (e.phone || '').replace(/[^0-9]/g, '').slice(-10);
  gcrById.set(e.id, e);
  if (name) gcrByName.set(name, e);
  if (phone) gcrByPhone.set(phone, e);
});

// Process Google Local (PRIMARY)
const merged = [];
const usedGcrIds = new Set();
let overlaps = 0;
let newGoogle = 0;

googleLocal.forEach(google => {
  const name = (google.name || '').toLowerCase().trim();
  const phone = (google.phone || '').replace(/[^0-9]/g, '').slice(-10);

  let gcrMatch = null;
  if (gcrByName.has(name)) {
    gcrMatch = gcrByName.get(name);
  } else if (phone && gcrByPhone.has(phone)) {
    gcrMatch = gcrByPhone.get(phone);
  }

  if (gcrMatch) {
    overlaps++;
    usedGcrIds.add(gcrMatch.id);
  } else {
    newGoogle++;
  }

  let entry = {
    id: google.place_id || 'google_' + Math.random().toString(36).substr(2, 9),
    name: google.name,
    type: google.category || (gcrMatch?.entity_type),
    phone: google.phone || (gcrMatch?.phone),
    address: google.address || (gcrMatch?.address_line_1),
    city: google.city || (gcrMatch?.city),
    state: google.state || (gcrMatch?.state),
    zip: google.zip || (gcrMatch?.zip),
    website: google.website || (gcrMatch?.website_url),
    rating: google.rating || (gcrMatch?.rating),
    review_count: google.reviews_count || (gcrMatch?.review_count) || 0,
    latitude: google.lat || (gcrMatch?.latitude),
    longitude: google.lng || (gcrMatch?.longitude),
    description: gcrMatch?.description,
    photo: google.photo || (gcrMatch?.hero_image_url)
  };

  merged.push(entry);
});

// Summary
console.log('='.repeat(80));
console.log('FINAL MERGED DATA');
console.log('='.repeat(80));
console.log('Google businesses: ' + googleLocal.length);
console.log('  - Enhanced with GCR data (overlaps): ' + overlaps);
console.log('  - New from Google only: ' + newGoogle);
console.log('');
console.log('TOTAL BUSINESSES: ' + merged.length + '\n');

fs.writeFileSync('./consolidation/FINAL-MERGED-ALL.json', JSON.stringify(merged, null, 2));

console.log('✓ File saved: consolidation/FINAL-MERGED-ALL.json');
console.log('Ready to import ' + merged.length + ' businesses to new database');
