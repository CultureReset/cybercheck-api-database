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
console.log('LINK ALL EVENTS USING VENUE MAPPING');
console.log('='.repeat(80) + '\n');

const allEvents = JSON.parse(fs.readFileSync('/Users/owner/tools/gulfmusiclive/output/events.json'));
const googleBiz = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));
const venueMapping = JSON.parse(fs.readFileSync('./consolidation/VENUE-MAPPING.json'));

console.log('Total events: ' + allEvents.length);
console.log('Venues in mapping: ' + venueMapping.length);
console.log('Google businesses: ' + googleBiz.length + '\n');

// Match each mapped venue to a Google business
const venueToPlaceId = new Map();

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
    venueToPlaceId.set(mappedVenue.toLowerCase(), {
      place_id: bestMatch.place_id,
      google_name: bestMatch.name,
      score: bestScore
    });
  }
});

console.log('Mapped ' + venueToPlaceId.size + ' venues to Google Place IDs\n');

// Link all events
const linkedEvents = [];
let linked = 0;
let unlinked = 0;

allEvents.forEach(e => {
  const venueName = (e.venueName || '').toLowerCase().trim();

  // Try direct match
  let placeIdData = venueToPlaceId.get(venueName);

  // Try fuzzy match if no direct match
  if (!placeIdData) {
    for (const [mappedVenue, data] of venueToPlaceId) {
      const score = similarity(venueName, mappedVenue);
      if (score > 0.75) {
        placeIdData = data;
        break;
      }
    }
  }

  if (placeIdData) {
    linkedEvents.push({
      event_id: e.id,
      event_name: e.title || e.name,
      artist: e.artist,
      performer_id: e.performerId,
      venue_name: e.venueName,
      place_id: placeIdData.place_id,
      start_date: e.startISO,
      end_date: e.endISO,
      ticket_url: e.ticketUrl,
      image: e.imageUrl
    });
    linked++;
  } else {
    unlinked++;
  }
});

console.log('='.repeat(80));
console.log('FINAL RESULTS');
console.log('='.repeat(80));
console.log('Events linked: ' + linked);
console.log('Events unlinked: ' + unlinked);
console.log('Match rate: ' + (linked / allEvents.length * 100).toFixed(1) + '%\n');

// Save
fs.writeFileSync('./consolidation/ALL-EVENTS-FINAL.json', JSON.stringify(linkedEvents, null, 2));

console.log('✓ consolidation/ALL-EVENTS-FINAL.json (' + linkedEvents.length + ' events with Place IDs)');
console.log('\nReady to add to MASTER-BUSINESSES.json');
