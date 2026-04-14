#!/usr/bin/env node
// gcr-category-pages-audit.js — Checks all 9 GCR category pages have config, entities, and render data
// Usage: node agents/gcr-category-pages-audit.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const GCR_FRONTEND = process.env.GCR_FRONTEND || 'https://gulfcoastradar.com';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`);}

const CATEGORIES = [
  { id: 'restaurants', label: 'Restaurants', subtypes: ['restaurant','bar','seafood_restaurant','casual_dining'] },
  { id: 'coffee-sweets', label: 'Coffee & Sweets', subtypes: ['coffee_shop','cafe','bakery','ice_cream'] },
  { id: 'shopping', label: 'Shopping', subtypes: ['boutique','retail','surf_shop','gift_shop'] },
  { id: 'things-to-do', label: 'Things To Do', subtypes: ['parasailing','kayak_rental','boat_rental','fishing_charter'] },
  { id: 'nightlife', label: 'Nightlife', subtypes: ['nightlife','nightclub','sports_bar','rooftop_bar'] },
  { id: 'services', label: 'Services', subtypes: ['services','salon','spa','photographer'] },
  { id: 'happy-hour', label: 'Happy Hour', subtypes: [] },
  { id: 'events', label: 'Events', subtypes: [] },
  { id: 'other', label: 'Other', subtypes: ['other','hotel','condo','resort'] },
];

async function run() {
  console.log(`\n${B}GCR Category Pages Audit${X}`);
  console.log(`${D}API: ${BASE}${X}\n`);

  sec('Entity Counts per Category');
  const r = await fetch(BASE + '/api/gcr/entities?limit=1000');
  const data = r.ok ? await r.json() : null;
  const entities = data?.entities || data?.businesses || [];
  ok(`Total active entities: ${entities.length}`);

  // Map entities to categories
  const SUBTYPE_MAP = {
    restaurant:'restaurants', restaurants:'restaurants', bar:'restaurants', bar_grill:'restaurants',
    hybrid_venue:'restaurants', seafood_restaurant:'restaurants', seafood:'restaurants',
    casual_dining:'restaurants', steakhouse:'restaurants', pizza:'restaurants',
    mexican:'restaurants', southern:'restaurants', breakfast_spot:'restaurants',
    beach_bar:'restaurants', food:'restaurants', dining:'restaurants',
    coffee_shop:'coffee-sweets', coffee_sweets:'coffee-sweets', cafe:'coffee-sweets',
    bakery:'coffee-sweets', ice_cream:'coffee-sweets', dessert_bar:'coffee-sweets', smoothie:'coffee-sweets',
    boutique:'shopping', souvenir:'shopping', retail:'shopping', shopping:'shopping',
    surf_shop:'shopping', gift_shop:'shopping', clothing:'shopping', art_gallery:'shopping',
    parasailing:'things-to-do', dolphin_cruise:'things-to-do', dolphin_cruises_tours:'things-to-do',
    snorkeling:'things-to-do', kayak_rental:'things-to-do', boat_rental:'things-to-do',
    boat_rentals:'things-to-do', fishing_charter:'things-to-do', 'charter_fishing':'things-to-do',
    tour:'things-to-do', attraction:'things-to-do', attractions:'things-to-do',
    jet_ski:'things-to-do', jet_ski_rentals_tours:'things-to-do', paddleboard:'things-to-do',
    banana_boat_rides:'things-to-do', banana_boat:'things-to-do', things_to_do:'things-to-do',
    rentals:'things-to-do', watersports:'things-to-do', amusement_park:'things-to-do',
    golf_course:'things-to-do', canoe_kayak_paddleboard:'things-to-do',
    nightlife:'nightlife', bar_club:'nightlife', nightclub:'nightlife',
    sports_bar:'nightlife', rooftop_bar:'nightlife', lounge:'nightlife',
    services:'services', service:'services', salon:'services', spa:'services',
    photographer:'services', photography:'services', wellness:'services',
    transportation:'services', concierge:'services', chair_rental:'services',
    grocery_delivery:'services', cleaning:'services', lawn_care:'services',
    pest_control:'services', salon_spa:'services', beauty_salon:'services',
    financial_services:'services', pharmacy:'services', bank:'services',
    gas_station:'services', car_wash:'services', medical_practice:'services',
    laundromat:'services', agency:'services',
    other:'other', hotel:'other', condo:'other', resort:'other', park:'other',
    convenience_store:'other', grocery_retailer:'other', florist:'other',
    real_estate:'other', parking:'other', vacation_rental:'other',
    influencer:'other', artist:'other',
  };

  const counts = {};
  let noSubtype = 0;
  for (const e of entities) {
    const raw = (e.entity_subtype||'').toLowerCase().replace(/-/g,'_');
    if (!raw) { noSubtype++; continue; }
    const cat = SUBTYPE_MAP[raw] || 'unknown';
    counts[cat] = (counts[cat]||0)+1;
  }

  for (const cat of CATEGORIES) {
    const count = counts[cat.id] || 0;
    if (count === 0 && !['happy-hour','events','nightlife'].includes(cat.id)) fail(`${cat.label}: 0 businesses — no one will appear on this page`);
    else if (count < 3 && !['happy-hour','events','nightlife'].includes(cat.id)) warn(`${cat.label}: only ${count} businesses`);
    else ok(`${cat.label}: ${count} businesses`);
  }

  if (noSubtype > 0) warn(`${noSubtype} entities have NO subtype — invisible on ALL category pages`);
  if (counts['unknown'] > 0) warn(`${counts['unknown']} entities have unknown subtypes — invisible`);

  sec('Category Page Config (API)');
  for (const cat of CATEGORIES) {
    const configR = await fetch(BASE + `/api/gcr/category-page-config/${cat.id}`);
    if (!configR.ok) {
      warn(`${cat.label}: no config endpoint (${configR.status})`);
      continue;
    }
    const config = await configR.json();
    const cfg = config?.config || config;
    const hasTitle = !!(cfg?.title || cfg?.hero_title);
    const hasHero = !!(cfg?.hero_image_url || cfg?.background_image_url);
    const hasDesc = !!(cfg?.description || cfg?.subtitle);

    if (!hasTitle && !hasHero) warn(`${cat.label}: no page config set yet — fill in Site Editor → Category Headers`);
    else if (!hasTitle) warn(`${cat.label}: missing title in config`);
    else if (!hasHero) warn(`${cat.label}: no hero image in config`);
    else ok(`${cat.label}: has title + hero ✓`);
  }

  sec('Happy Hour Data Check');
  const hhR = await fetch(BASE + '/api/gcr/happy-hours');
  if (!hhR.ok) {
    fail(`/api/gcr/happy-hours endpoint: ${hhR.status}`);
  } else {
    const hhData = await hhR.json();
    const hhList = hhData?.happy_hours || hhData?.entities || hhData || [];
    ok(`Happy hours endpoint: ${Array.isArray(hhList) ? hhList.length : 'non-array'} entries`);
    if (Array.isArray(hhList) && hhList.length === 0) warn('No happy hour data — hh_days/hh_start/hh_end may not be filled in');
  }

  sec('Events Data Check');
  const evR = await fetch(BASE + '/api/gcr/events');
  if (!evR.ok) {
    fail(`/api/gcr/events endpoint: ${evR.status}`);
  } else {
    const evData = await evR.json();
    const evList = evData?.events || evData || [];
    ok(`Events endpoint: ${Array.isArray(evList) ? evList.length : 'non-array'} events`);
    if (Array.isArray(evList) && evList.length === 0) warn('No events data');
  }

  sec('Homepage Category Cards Config');
  const homeR = await fetch(BASE + '/api/gcr/site-config');
  if (!homeR.ok) {
    const homeR2 = await fetch(BASE + '/api/gcr/config');
    if (!homeR2.ok) warn(`Site config endpoint not found (tried /api/gcr/site-config and /api/gcr/config)`);
    else {
      const cfg = await homeR2.json();
      ok(`Site config at /api/gcr/config: ${JSON.stringify(Object.keys(cfg||{}))}`);
    }
  } else {
    const cfg = await homeR.json();
    ok(`Site config found: ${JSON.stringify(Object.keys(cfg||{}))}`);
  }

  // Summary table
  console.log(`\n${B}${C}── Category Coverage Summary ${'─'.repeat(28)}${X}`);
  for (const cat of CATEGORIES) {
    const count = counts[cat.id] || 0;
    const bar = '█'.repeat(Math.min(count, 20)) + '░'.repeat(Math.max(0, 20-count));
    const color = count === 0 ? R : count < 3 ? Y : G;
    console.log(`  ${color}${cat.label.padEnd(20)}${X} ${bar} ${count}`);
  }

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY) {
    const emptyCats = CATEGORIES.filter(c => !counts[c.id] && !['happy-hour','events'].includes(c.id));
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      messages: [{ role: 'user', content: `GCR category pages audit: ${entities.length} total active businesses.
Category counts: ${Object.entries(counts).map(([k,v])=>`${k}:${v}`).join(', ')}
${noSubtype} entities have no subtype.
Empty categories: ${emptyCats.map(c=>c.label).join(', ')||'none'}.
Config missing for: categories that returned 404 or no title/hero.
${failed.length} failures, ${warned.length} warnings.
What's most urgent to fix for launch?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });
