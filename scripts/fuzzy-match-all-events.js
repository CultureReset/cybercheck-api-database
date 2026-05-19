#!/usr/bin/env node

const fs = require('fs');

function similarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1.0;
  const editDistance = levenshtein(longer.toLowerCase(), shorter.toLowerCase());
  return (longer.length - editDistance) / longer.length;
}

function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

console.log('='.repeat(80));
console.log('FUZZY MATCH ALL UNMATCHED EVENTS');
console.log('='.repeat(80) + '\n');

const allEvents = JSON.parse(fs.readFileSync('/Users/owner/tools/gulfmusiclive/output/events.json'));
const matched = JSON.parse(fs.readFileSync('./consolidation/EVENTS-WITH-VENUES.json'));
const googleBiz = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));

const matchedVenueNames = new Set(matched.map(e => (e.venue_name || '').toLowerCase()));

// Get unmatched events
const unmatchedEvents = allEvents.filter(e => !matchedVenueNames.has((e.venueName || '').toLowerCase()));

console.log('Total events: ' + allEvents.length);
console.log('Already matched: ' + matched.length);
console.log('Unmatched: ' + unmatchedEvents.length + '\n');

// Fuzzy match each unmatched event
const newMatches = [];
const stillUnmatched = [];

unmatchedEvents.forEach(event => {
  const venueName = (event.venueName || '').toLowerCase().trim();

  // Find best match in Google businesses
  let bestMatch = null;
  let bestScore = 0;

  googleBiz.forEach(g => {
    const gName = (g.name || '').toLowerCase().trim();
    const score = similarity(venueName, gName);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = g;
    }
  });

  // Accept if similarity > 70%
  if (bestScore > 0.7) {
    newMatches.push({
      event_id: event.id,
      event_name: event.title || event.name,
      artist: event.artist,
      venue_name: event.venueName,
      matched_business: bestMatch.name,
      place_id: bestMatch.place_id,
      city: bestMatch.city,
      similarity: (bestScore * 100).toFixed(1) + '%',
      start_date: event.startISO,
      ticket_url: event.ticketUrl
    });
  } else {
    stillUnmatched.push({
      event_name: event.title || event.name,
      venue_name: event.venueName,
      best_match: bestMatch?.name,
      similarity: (bestScore * 100).toFixed(1) + '%'
    });
  }
});

console.log('='.repeat(80));
console.log('RESULTS');
console.log('='.repeat(80));
console.log('Fuzzy matched (70%+): ' + newMatches.length);
console.log('Still unmatched: ' + stillUnmatched.length);
console.log('');
console.log('TOTAL EVENTS NOW MATCHED: ' + (matched.length + newMatches.length) + '/' + allEvents.length);
console.log('Match rate: ' + ((matched.length + newMatches.length) / allEvents.length * 100).toFixed(1) + '%\n');

// Combine all matches
const allMatches = [...matched, ...newMatches];
fs.writeFileSync('./consolidation/ALL-EVENTS-FINAL.json', JSON.stringify(allMatches, null, 2));
fs.writeFileSync('./consolidation/EVENTS-FUZZY-MATCHED.json', JSON.stringify(newMatches, null, 2));
fs.writeFileSync('./consolidation/EVENTS-STILL-NO-VENUE.json', JSON.stringify(stillUnmatched, null, 2));

console.log('✓ consolidation/ALL-EVENTS-FINAL.json (' + allMatches.length + ' events)');
console.log('✓ consolidation/EVENTS-FUZZY-MATCHED.json (' + newMatches.length + ' new)');
console.log('✓ consolidation/EVENTS-STILL-NO-VENUE.json (' + stillUnmatched.length + ')');
