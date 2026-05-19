#!/usr/bin/env node

const fs = require('fs');

console.log('='.repeat(80));
console.log('CREATE MASTER CONSOLIDATED BUSINESSES FILE');
console.log('='.repeat(80) + '\n');

// Load all data sources
const googleBiz = JSON.parse(fs.readFileSync('./all-businesses-organized-ob-gs.json'));
const eventsWithVenues = JSON.parse(fs.readFileSync('./consolidation/EVENTS-WITH-VENUES.json'));

console.log('Google businesses: ' + googleBiz.length);
console.log('Events with venues: ' + eventsWithVenues.length + '\n');

// Create master file structure
const masterBusinesses = [];
const addedPlaceIds = new Set();

// Add all Google businesses as base
googleBiz.forEach(g => {
  const business = {
    place_id: g.place_id,
    name: g.name,
    type: g.category,
    address: g.address,
    city: g.city,
    state: g.state,
    zip: g.zip,
    phone: g.phone,
    website: g.website,
    rating: g.rating,
    review_count: g.reviews_count,
    latitude: g.lat,
    longitude: g.lng,
    price_level: g.price_level,
    hours: g.hours,
    photos: g.photos,
    amenities: g.amenities,
    services: g.services,
    events: [], // Will be populated
    source: 'google_places',
    last_updated: new Date().toISOString()
  };

  masterBusinesses.push(business);
  addedPlaceIds.add(g.place_id);
});

console.log('Added all Google businesses to master file\n');

// Link events to businesses
let eventsLinked = 0;
eventsWithVenues.forEach(event => {
  const business = masterBusinesses.find(b => b.place_id === event.place_id);

  if (business) {
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
});

console.log('Linked ' + eventsLinked + ' events to businesses\n');

// Summary
const businessesWithEvents = masterBusinesses.filter(b => b.events.length > 0);

console.log('='.repeat(80));
console.log('MASTER FILE SUMMARY');
console.log('='.repeat(80));
console.log('Total businesses: ' + masterBusinesses.length);
console.log('Businesses with events: ' + businessesWithEvents.length);
console.log('Total events linked: ' + eventsLinked + '\n');

// Save master file
fs.writeFileSync('./MASTER-BUSINESSES.json', JSON.stringify(masterBusinesses, null, 2));

console.log('✓ Master file created: MASTER-BUSINESSES.json\n');

console.log('Structure of each business:');
console.log('  - place_id (unique identifier)');
console.log('  - name, type, address, city, state, zip');
console.log('  - phone, website, rating, review_count');
console.log('  - latitude, longitude');
console.log('  - hours, photos, amenities, services');
console.log('  - events[] (linked from GulfMusicLive)');
console.log('  - source (where data came from)');
console.log('  - last_updated (timestamp)\n');

console.log('Ready to add more data. Use place_id to link all related data.');
