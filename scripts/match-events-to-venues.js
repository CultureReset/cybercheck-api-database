#!/usr/bin/env node

const fs = require('fs');

console.log('='.repeat(80));
console.log('MATCH EVENTS TO VENUES WITH PLACE IDS');
console.log('='.repeat(80) + '\n');

// Load data
const exactMatch = JSON.parse(fs.readFileSync('./consolidation/VENUES-EXACT-MATCH.json'));
const googleBiz = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));
const gulfMusicLiveEvents = JSON.parse(fs.readFileSync('/Users/owner/tools/gulfmusiclive/output/events.json'));

console.log('Exact matched venues: ' + exactMatch.length);
console.log('Google businesses: ' + googleBiz.length);
console.log('GulfMusicLive events: ' + gulfMusicLiveEvents.length + '\n');

// Build venue lookup by Google name
const venuesByGoogleName = new Map();
googleBiz.forEach(g => {
  const key = (g.name || '').toLowerCase().trim();
  if (!venuesByGoogleName.has(key)) {
    venuesByGoogleName.set(key, []);
  }
  venuesByGoogleName.get(key).push(g);
});

// Add Tacky Jacks all 3 locations
const tackyJacksLocations = googleBiz.filter(g =>
  (g.name || '').toLowerCase().includes('tacky jacks')
);

console.log('Found Tacky Jacks locations:');
tackyJacksLocations.forEach(t => {
  console.log('  - ' + t.name + ' (' + t.city + ') → ' + t.place_id);
});

// Now match events to venues
const eventsWithVenues = [];
let matchedCount = 0;

gulfMusicLiveEvents.forEach(event => {
  const eventVenueName = (event.venueName || '').toLowerCase().trim();
  const eventCity = (event.locationCity || '').toLowerCase().trim();

  let matchedVenue = null;

  // Check exact match venues
  const exactMatchVenue = exactMatch.find(v =>
    (v.venue_name || '').toLowerCase().trim() === eventVenueName &&
    (v.city || '').toLowerCase().includes(eventCity.split(' ')[0])
  );

  if (exactMatchVenue) {
    matchedVenue = {
      venue_name: exactMatchVenue.venue_name,
      place_id: exactMatchVenue.place_id,
      city: exactMatchVenue.city
    };
  } else if (eventVenueName.includes('tacky')) {
    // Match Tacky Jacks by event location city
    let tackyMatch;

    if (eventCity.includes('gulf')) {
      // Event in Gulf Shores → use Tacky Jacks Gulf Shores
      tackyMatch = tackyJacksLocations.find(t =>
        t.name.toLowerCase().includes('gulf shores')
      );
    } else if (eventCity.includes('orange')) {
      // Event in Orange Beach → use Tacky Jacks Orange Beach
      tackyMatch = tackyJacksLocations.find(t =>
        t.name.toLowerCase().includes('orange beach')
      );
    } else {
      // Default to first match
      tackyMatch = tackyJacksLocations[0];
    }

    if (tackyMatch) {
      matchedVenue = {
        venue_name: tackyMatch.name,
        place_id: tackyMatch.place_id,
        city: tackyMatch.city
      };
    }
  }

  if (matchedVenue) {
    matchedCount++;
    eventsWithVenues.push({
      event_id: event.id,
      event_name: event.title || event.name,
      artist: event.artist,
      performer_id: event.performerId,
      venue_name: matchedVenue.venue_name,
      place_id: matchedVenue.place_id,
      city: matchedVenue.city,
      start_date: event.startISO,
      end_date: event.endISO,
      ticket_url: event.ticketUrl,
      image: event.imageUrl
    });
  }
});

console.log('\n' + '='.repeat(80));
console.log('RESULTS');
console.log('='.repeat(80));
console.log('Events matched to venues: ' + matchedCount + '/' + gulfMusicLiveEvents.length);

// Save
fs.writeFileSync('./consolidation/EVENTS-WITH-VENUES.json', JSON.stringify(eventsWithVenues, null, 2));

console.log('\n✓ consolidation/EVENTS-WITH-VENUES.json (' + eventsWithVenues.length + ' events)\n');

// Show sample
console.log('Sample events:');
eventsWithVenues.slice(0, 5).forEach(e => {
  console.log('  "' + e.event_name + '" by ' + e.artist);
  console.log('    @ ' + e.venue_name + ' (' + e.place_id + ')');
  console.log('    ' + e.start_date);
});

console.log('\n... and ' + (eventsWithVenues.length - 5) + ' more');
