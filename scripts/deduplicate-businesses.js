#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple Levenshtein distance for fuzzy matching
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function stringSimilarity(a, b) {
  const max = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / max;
}

function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function extractPhone(str) {
  if (!str) return '';
  return str.replace(/[^0-9]/g, '').slice(-10); // Last 10 digits
}

console.log('='.repeat(80));
console.log('BUSINESS DEDUPLICATION - GCR vs Profiles');
console.log('='.repeat(80) + '\n');

// Load data
console.log('Loading databases...');
const gcr = JSON.parse(fs.readFileSync('./gulf-coast-radar-full-export.json'));
const prof = JSON.parse(fs.readFileSync('./profiles-full-export.json'));

const gcrEntities = gcr.data.entity || [];
const profBusinesses = prof.data.businesses || [];

console.log(`✓ GCR: ${gcrEntities.length} entities`);
console.log(`✓ Profiles: ${profBusinesses.length} businesses\n`);

// Extract business info
const gcrBiz = gcrEntities.map(e => ({
  id: e.id,
  source: 'gcr',
  name: e.name || '',
  phone: extractPhone(e.phone || ''),
  address: normalize(e.address || ''),
  city: e.city || '',
  state: e.state || '',
  original: e
}));

const profBiz = profBusinesses.map(b => ({
  id: b.site_id,
  source: 'profiles',
  name: b.name || '',
  phone: extractPhone(b.phone || ''),
  address: normalize(b.address || ''),
  city: b.city || '',
  state: b.state || '',
  original: b
}));

console.log('Matching businesses...\n');

const matches = [];
const unmatched = {
  gcr: [...gcrBiz],
  profiles: [...profBiz]
};

// Match by phone (exact)
for (let i = 0; i < profBiz.length; i++) {
  const prof = profBiz[i];
  if (!prof.phone) continue;

  const match = gcrBiz.find(g => g.phone === prof.phone);
  if (match) {
    matches.push({
      type: 'phone',
      confidence: 1.0,
      gcr_id: match.id,
      prof_id: prof.id,
      gcr_name: match.name,
      prof_name: prof.name,
      phone: prof.phone
    });
    unmatched.gcr = unmatched.gcr.filter(x => x.id !== match.id);
    unmatched.profiles = unmatched.profiles.filter(x => x.id !== prof.id);
  }
}

// Match by name (fuzzy 70%+) + address/city
for (let i = 0; i < unmatched.profiles.length; i++) {
  const prof = unmatched.profiles[i];
  if (!prof.name) continue;

  for (let j = 0; j < unmatched.gcr.length; j++) {
    const gcr = unmatched.gcr[j];
    if (!gcr.name) continue;

    const nameSim = stringSimilarity(prof.name, gcr.name);
    const addressMatch = prof.address && gcr.address && prof.address.includes(gcr.address.split(' ')[0]);
    const cityMatch = prof.city && gcr.city && prof.city.toLowerCase() === gcr.city.toLowerCase();

    if (nameSim >= 0.7 && (addressMatch || cityMatch)) {
      matches.push({
        type: 'name+location',
        confidence: nameSim,
        gcr_id: gcr.id,
        prof_id: prof.id,
        gcr_name: gcr.name,
        prof_name: prof.name,
        address: gcr.address || prof.address
      });
      unmatched.gcr = unmatched.gcr.filter(x => x.id !== gcr.id);
      unmatched.profiles = unmatched.profiles.filter(x => x.id !== prof.id);
      break;
    }
  }
}

// Results
console.log('='.repeat(80));
console.log('RESULTS');
console.log('='.repeat(80));
console.log(`Matches found: ${matches.length}`);
console.log(`GCR unmatched: ${unmatched.gcr.length}`);
console.log(`Profiles unmatched: ${unmatched.profiles.length}`);
console.log(`\nTotal unique businesses: ${matches.length + unmatched.gcr.length + unmatched.profiles.length}`);

// Save results
const dedup = {
  summary: {
    total_matches: matches.length,
    gcr_unmatched: unmatched.gcr.length,
    profiles_unmatched: unmatched.profiles.length,
    total_unique: matches.length + unmatched.gcr.length + unmatched.profiles.length
  },
  matches: matches.slice(0, 50), // First 50
  gcr_only: unmatched.gcr.slice(0, 30).map(b => ({ id: b.id, name: b.name, phone: b.phone })),
  profiles_only: unmatched.profiles.slice(0, 30).map(b => ({ id: b.id, name: b.name, phone: b.phone }))
};

fs.writeFileSync('./consolidation/DEDUP-RESULTS.json', JSON.stringify(dedup, null, 2));
console.log('\n✓ Results saved to consolidation/DEDUP-RESULTS.json');

console.log('\nTop matches:');
matches.slice(0, 10).forEach((m, i) => {
  console.log(`  ${i + 1}. [${m.type}] "${m.gcr_name}" ↔ "${m.prof_name}" (${(m.confidence * 100).toFixed(0)}%)`);
});
