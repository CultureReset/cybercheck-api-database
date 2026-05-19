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
console.log('FUZZY MATCH UNLINKED EVENTS TO MAPPED VENUES');
console.log('='.repeat(80) + '\n');

const allEvents = JSON.parse(fs.readFileSync('/Users/owner/tools/gulfmusiclive/output/events.json'));
const linked = JSON.parse(fs.readFileSync('./consolidation/ALL-EVENTS-FINAL.json'));
const googleBiz = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));
const venueMapping = JSON.parse(fs.readFileSync('./consolidation/VENUE-MAPPING.json'));

const linkedVenues = new Set(linked.map(e => (e.venue_name || '').toLowerCase()));

// Build Google Place ID map from mapping
const mappedVenueToPlaceId = new Map();
venueMapping.forEach(mappedVenue => {
  let bestMatch = null;
  let bestScore = 0;

  googleBiz.forEach(g => {
    const score = similarity(mappedVenue, g.name);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = g;
    }
  });

  if (bestMatch && bestScore > 0.6) {
    mappedVenueToPlaceId.set(mappedVenue.toLowerCase(), bestMatch.place_id);
  }
});

// Fuzzy match unlinked events to mapped venues
const newlyLinked = [];
let newly = 0;

allEvents.forEach(e => {
  const eventVenue = (e.venueName || '').toLowerCase().trim();

  if (!linkedVenues.has(eventVenue)) {
    // Find best match in mapped venues
    let bestMappedVenue = null;
    let bestScore = 0;

    venueMapping.forEach(mapped => {
      const score = similarity(eventVenue, mapped.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        bestMappedVenue = mapped;
      }
    });

    // Accept if similarity > 60%
    if (bestScore > 0.6 && mappedVenueToPlaceId.has(bestMappedVenue.toLowerCase())) {
      const placeId = mappedVenueToPlaceId.get(bestMappedVenue.toLowerCase());

      newlyLinked.push({
        event_id: e.id,
        event_name: e.title || e.name,
        artist: e.artist,
        performer_id: e.performerId,
        venue_name: e.venueName,
        place_id: placeId,
        start_date: e.startISO,
        ticket_url: e.ticketUrl,
        similarity: (bestScore * 100).toFixed(1) + '%'
      });

      newly++;
    }
  }
});

console.log('Newly fuzzy matched: ' + newly);
console.log('');

// Combine with already linked
const allLinked = [...linked, ...newlyLinked];
const totalLinked = allLinked.length;
const totalEvents = allEvents.length;

console.log('='.repeat(80));
console.log('COMBINED RESULTS');
console.log('='.repeat(80));
console.log('Already linked: ' + linked.length);
console.log('Newly fuzzy matched: ' + newly);
console.log('Total linked: ' + totalLinked);
console.log('Unlinked: ' + (totalEvents - totalLinked));
console.log('Match rate: ' + (totalLinked / totalEvents * 100).toFixed(1) + '%\n');

fs.writeFileSync('./consolidation/ALL-EVENTS-WITH-VENUES-FINAL.json', JSON.stringify(allLinked, null, 2));

console.log('✓ ALL-EVENTS-WITH-VENUES-FINAL.json (' + totalLinked + '/' + totalEvents + ' events)');
