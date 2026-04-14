#!/usr/bin/env node
// gcr-activity-cards.js — Verifies activity entities have the right fields for card rendering:
// duration_text, capacity_max, min_age, price_from, booking_url
// Also checks activity subtypes route to things-to-do category
// Usage: node agents/gcr-activity-cards.js

require('dotenv').config();

const BASE  = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m)  { console.log(`  ${G}✓${X} ${m}`); passed.push(m); }
function fail(m){ console.log(`  ${R}✗${X} ${m}`); failed.push(m); }
function warn(m){ console.log(`  ${Y}⚠${X} ${m}`); warned.push(m); }
function sec(t) { console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`); }

const ACTIVITY_SUBTYPES = new Set([
  'fishing_charter','parasailing','dolphin_cruise','boat_rental','kayak_rental',
  'snorkeling','jet_ski','paddleboard','banana_boat','tour','attraction',
  'things_to_do','activity','sunset_cruise','pontoon_rental','wave_runner',
  'scuba_diving','glass_bottom_boat','airboat_tour'
]);

const THINGS_TO_DO_SUBTYPES = ACTIVITY_SUBTYPES;

async function get(path, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const r = await fetch(BASE + path, { headers: h });
  let data; try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}

async function run() {
  console.log(`\n${B}Activity Cards Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  // Login
  let token = null;
  if (EMAIL && PASS) {
    const r = await fetch(BASE + '/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: EMAIL, password: PASS })
    });
    const d = await r.json();
    if (d.token) { token = d.token; ok('Admin login'); }
    else fail('Admin login failed');
  }

  // Fetch all entities
  sec('Fetch Entities');
  const { status, data } = await get('/api/gcr/entities', token);
  if (status !== 200) { fail(`Entities endpoint: status ${status}`); return; }
  const entities = data?.entities || data || [];
  if (!entities.length) { fail('No entities returned'); return; }
  ok(`${entities.length} entities fetched`);

  // Find activity entities
  sec('Activity Entity Fields');
  const activities = entities.filter(e => ACTIVITY_SUBTYPES.has(e.entity_subtype));
  if (activities.length === 0) {
    warn('No activity entities found — add some things-to-do businesses');
  } else {
    ok(`${activities.length} activity entities found`);

    let hasDuration = 0, hasCapacity = 0, hasMinAge = 0, hasPriceFrom = 0, hasBookingUrl = 0;
    for (const e of activities) {
      if (e.duration_text)  hasDuration++;
      if (e.capacity_max)   hasCapacity++;
      if (e.min_age)        hasMinAge++;
      if (e.price_from)     hasPriceFrom++;
      if (e.booking_url)    hasBookingUrl++;
    }

    const pct = n => `${n}/${activities.length}`;
    hasDuration  > 0 ? ok(`duration_text set: ${pct(hasDuration)}`)   : warn(`duration_text missing on all activity entities`);
    hasCapacity  > 0 ? ok(`capacity_max set: ${pct(hasCapacity)}`)    : warn(`capacity_max missing on all activity entities`);
    hasMinAge    > 0 ? ok(`min_age set: ${pct(hasMinAge)}`)           : warn(`min_age missing on all activity entities`);
    hasPriceFrom > 0 ? ok(`price_from set: ${pct(hasPriceFrom)}`)    : warn(`price_from missing on all activity entities — cards won't show starting price`);
    hasBookingUrl> 0 ? ok(`booking_url set: ${pct(hasBookingUrl)}`)  : warn(`booking_url missing on all activity entities — Book Now button won't link`);

    // Sample output for first few
    sec('Sample Activity Cards Preview');
    for (const e of activities.slice(0, 5)) {
      const parts = [
        e.duration_text  ? `⏱ ${e.duration_text}` : '⏱ —',
        e.capacity_max   ? `👥 up to ${e.capacity_max}` : '👥 —',
        e.min_age        ? `🔞 ${e.min_age}+` : '🔞 —',
        e.price_from     ? `💲from $${e.price_from}` : '💲 —',
        e.booking_url    ? '📅 Book Now ✓' : '📅 no booking URL',
      ].join('  ');
      console.log(`  ${D}${e.name} (${e.entity_subtype})${X}`);
      console.log(`    ${parts}`);
    }
  }

  // Check subtype routing
  sec('Subtype → things-to-do Routing');
  const subtypesFound = [...new Set(activities.map(e => e.entity_subtype))];
  const unrouted = subtypesFound.filter(s => !THINGS_TO_DO_SUBTYPES.has(s));
  if (unrouted.length > 0) fail(`Subtypes not routed to things-to-do: ${unrouted.join(', ')}`);
  else if (subtypesFound.length > 0) ok(`All activity subtypes route to things-to-do: ${subtypesFound.join(', ')}`);

  // Check restaurants don't bleed over
  sec('Restaurant Cards — No Activity Fields Required');
  const restaurants = entities.filter(e => ['restaurant','bar','bar_grill','seafood_restaurant','casual_dining'].includes(e.entity_subtype));
  if (restaurants.length > 0) {
    const withBookingUrl = restaurants.filter(e => e.booking_url);
    ok(`${restaurants.length} restaurant entities found`);
    if (withBookingUrl.length > 0) ok(`${withBookingUrl.length} restaurants also have booking_url (reservation link)`);
  }

  // Summary
  console.log(`\n${B}${'═'.repeat(56)}${X}`);
  console.log(`${B}Activity Cards: ${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(R+'Fatal: '+X+e.message); process.exit(1); });
