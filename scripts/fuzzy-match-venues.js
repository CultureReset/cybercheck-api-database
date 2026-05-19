#!/usr/bin/env node

const fs = require('fs');

// Levenshtein similarity
function similarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;

  const editDistance = levenshtein(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(a, b) {
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

const unmatched = JSON.parse(fs.readFileSync('./consolidation/VENUES-NO-MATCH.json'));
const googleBiz = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));

console.log('='.repeat(80));
console.log('FUZZY MATCH UNMATCHED VENUES');
console.log('='.repeat(80) + '\n');

console.log('Finding similar matches for ' + unmatched.length + ' venues...\n');

const fuzzyMatches = [];
const stillNoMatch = [];

unmatched.forEach(v => {
  const vName = (v.venue_name || '').toLowerCase().trim();

  // Find top 3 similar matches
  const scores = googleBiz.map(g => ({
    business: g,
    score: similarity(vName, (g.name || '').toLowerCase().trim())
  }));

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  // Only accept if similarity > 70%
  if (best.score > 0.7) {
    fuzzyMatches.push({
      venue_name: v.venue_name,
      city: v.city,
      matched_business: best.business.name,
      place_id: best.business.place_id,
      similarity: (best.score * 100).toFixed(1) + '%',
      address: best.business.address,
      phone: best.business.phone
    });
  } else {
    stillNoMatch.push({
      venue_name: v.venue_name,
      city: v.city,
      top_match: best.business.name,
      similarity: (best.score * 100).toFixed(1) + '%'
    });
  }
});

console.log('='.repeat(80));
console.log('FUZZY MATCH RESULTS');
console.log('='.repeat(80));
console.log('Fuzzy matches (70%+ similar): ' + fuzzyMatches.length);
console.log('Still no match: ' + stillNoMatch.length + '\n');

// Save
const exactMatches = JSON.parse(fs.readFileSync('./consolidation/VENUES-MATCHED.json'));
const allMatches = [...exactMatches, ...fuzzyMatches];

fs.writeFileSync('./consolidation/VENUES-ALL-MATCHED.json', JSON.stringify(allMatches, null, 2));
fs.writeFileSync('./consolidation/VENUES-FUZZY-MATCHES.json', JSON.stringify(fuzzyMatches, null, 2));
fs.writeFileSync('./consolidation/VENUES-STILL-NO-MATCH.json', JSON.stringify(stillNoMatch, null, 2));

console.log('Files saved:');
console.log('  ✓ consolidation/VENUES-ALL-MATCHED.json (' + allMatches.length + ' total)');
console.log('  ✓ consolidation/VENUES-FUZZY-MATCHES.json (' + fuzzyMatches.length + ')');
console.log('  ✓ consolidation/VENUES-STILL-NO-MATCH.json (' + stillNoMatch.length + ')\n');

console.log('Fuzzy matches:');
fuzzyMatches.forEach(m => {
  console.log('  "' + m.venue_name + '" → "' + m.matched_business + '" (' + m.similarity + ')');
});

if (stillNoMatch.length > 0) {
  console.log('\nStill no match (review these):');
  stillNoMatch.forEach(n => {
    console.log('  "' + n.venue_name + '" (best match: "' + n.top_match + '" - ' + n.similarity + ')');
  });
}
