#!/usr/bin/env node

const fs = require('fs');

console.log('='.repeat(80));
console.log('ADD ALL MATCHED VENUES TO MASTER FILE');
console.log('='.repeat(80) + '\n');

// Load data
const master = JSON.parse(fs.readFileSync('./MASTER-BUSINESSES.json'));
const exactMatch = JSON.parse(fs.readFileSync('./consolidation/VENUES-EXACT-MATCH.json'));
const eventsWithVenues = JSON.parse(fs.readFileSync('./consolidation/EVENTS-WITH-VENUES.json'));

console.log('Master file: ' + master.length + ' businesses');
console.log('Exact matched venues: ' + exactMatch.length);
console.log('Events with venues: ' + eventsWithVenues.length + '\n');

// Add exact matched venues that aren't already in master
let added = 0;
const addedPlaceIds = new Set(master.map(b => b.place_id));

exactMatch.forEach(venue => {
  // Check if already in master
  if (!addedPlaceIds.has(venue.place_id)) {
    const business = {
      place_id: venue.place_id,
      name: venue.google_name,
      type: 'venue',
      address: venue.address,
      city: venue.city,
      state: 'AL',
      phone: venue.phone,
      website: null,
      rating: null,
      review_count: null,
      latitude: null,
      longitude: null,
      hours: null,
      photos: [],
      amenities: [],
      services: [],
      events: [],
      source: 'gulfmusiclive_venues',
      last_updated: new Date().toISOString()
    };

    master.push(business);
    addedPlaceIds.add(venue.place_id);
    added++;
  }
});

console.log('Added ' + added + ' new venues to master\n');

// Link events to venues
let eventsLinked = 0;
eventsWithVenues.forEach(event => {
  const business = master.find(b => b.place_id === event.place_id);

  if (business) {
    // Check if event already exists
    const eventExists = business.events.some(e => e.event_id === event.event_id);

    if (!eventExists) {
      business.events.push({
        event_id: event.event_id,
        name: event.event_name,
        artist: event.artist,
        date: event.start_date,
        ticket_url: event.ticket_url,
        image: event.image
      });
      eventsLinked++;
    }
  }
});

console.log('Linked ' + eventsLinked + ' events\n');

// Save updated master
fs.writeFileSync('./MASTER-BUSINESSES.json', JSON.stringify(master, null, 2));

console.log('='.repeat(80));
console.log('UPDATED MASTER FILE');
console.log('='.repeat(80));
console.log('Total businesses: ' + master.length);

const withEvents = master.filter(b => b.events.length > 0);
console.log('Businesses with events: ' + withEvents.length);
console.log('Total events: ' + master.reduce((sum, b) => sum + b.events.length, 0) + '\n');

console.log('✓ Updated: MASTER-BUSINESSES.json');
