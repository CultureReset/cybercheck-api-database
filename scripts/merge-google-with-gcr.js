#!/usr/bin/env node

const fs = require('fs');

console.log('='.repeat(80));
console.log('MERGE: Google Local + GCR (keep newer/better data)');
console.log('='.repeat(80) + '\n');

const gcr = JSON.parse(fs.readFileSync('./gulf-coast-radar-full-export.json'));
const googleLocal = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));

const gcrObGs = gcr.data.entity.filter(e => {
  const city = (e.city || '').toLowerCase().trim();
  return city === 'orange beach' || city === 'gulf shores';
});

console.log('GCR OB+GS: ' + gcrObGs.length);
console.log('Google Local: ' + googleLocal.length + '\n');

// Build lookup
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

// Merge results
const merged = [];
const usedGcrIds = new Set();
let overlaps = 0;
let newFromGoogle = 0;

// Process Google Local
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

    merged.push({
      id: gcrMatch.id,
      name: google.name || gcrMatch.name,
      type: gcrMatch.entity_type || google.category,
      phone: google.phone || gcrMatch.phone,
      address: google.address || gcrMatch.address_line_1,
      city: google.city || gcrMatch.city,
      state: google.state || gcrMatch.state,
      zip: gcrMatch.zip,
      website: google.website || gcrMatch.website_url,
      rating: gcrMatch.rating || google.rating,
      review_count: gcrMatch.review_count || google.reviews_count,
      latitude: gcrMatch.latitude,
      longitude: gcrMatch.longitude
    });
  } else {
    newFromGoogle++;

    merged.push({
      id: 'google_' + Math.random().toString(36).substr(2, 9),
      name: google.name,
      type: google.category,
      phone: google.phone,
      address: google.address,
      city: google.city,
      state: google.state,
      zip: google.zip,
      website: google.website,
      rating: google.rating,
      review_count: google.reviews_count,
      latitude: google.lat,
      longitude: google.lng
    });
  }
});

// Add GCR-only businesses
const gcrOnlyCount = gcrObGs.filter(e => !usedGcrIds.has(e.id)).length;
gcrObGs.forEach(e => {
  if (!usedGcrIds.has(e.id)) {
    merged.push({
      id: e.id,
      name: e.name,
      type: e.entity_type,
      phone: e.phone,
      address: e.address_line_1,
      city: e.city,
      state: e.state,
      zip: e.zip,
      website: e.website_url,
      rating: e.rating,
      review_count: e.review_count,
      latitude: e.latitude,
      longitude: e.longitude
    });
  }
});

// Summary
console.log('='.repeat(80));
console.log('MERGE RESULTS');
console.log('='.repeat(80));
console.log('Overlaps (merged with Google data): ' + overlaps);
console.log('New from Google: ' + newFromGoogle);
console.log('GCR-only: ' + gcrOnlyCount);
console.log('');
console.log('Total merged: ' + merged.length);

fs.writeFileSync('./consolidation/MERGED-GCR-GOOGLE.json', JSON.stringify(merged, null, 2));

console.log('✓ Merged data saved to consolidation/MERGED-GCR-GOOGLE.json\n');
console.log('Breakdown:');
console.log('  - ' + overlaps + ' businesses updated with Google data');
console.log('  - ' + newFromGoogle + ' new businesses from Google');
console.log('  - ' + gcrOnlyCount + ' GCR-only businesses');
console.log('  - ' + merged.length + ' TOTAL businesses ready to import');
