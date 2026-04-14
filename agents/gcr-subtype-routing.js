#!/usr/bin/env node
// gcr-subtype-routing.js — Checks every entity's subtype maps to a valid GCR category page
// Usage: node agents/gcr-subtype-routing.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';

// All valid subtypes mapped to category pages (from gcr-listings.js)
const VALID_SUBTYPES = {
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
  snorkeling:'things-to-do', kayak_rental:'things-to-do', canoe_kayak_paddleboard:'things-to-do',
  boat_rental:'things-to-do', boat_rentals:'things-to-do', fishing_charter:'things-to-do',
  tour:'things-to-do', attraction:'things-to-do', jet_ski:'things-to-do',
  jet_ski_rentals_tours:'things-to-do', paddleboard:'things-to-do', banana_boat:'things-to-do',
  things_to_do:'things-to-do',
  nightlife:'nightlife', bar_club:'nightlife', nightclub:'nightlife',
  sports_bar:'nightlife', rooftop_bar:'nightlife', lounge:'nightlife',
  services:'services', service:'services', salon:'services', spa:'services',
  photographer:'services', photography:'services', wellness:'services',
  transportation:'services', concierge:'services', chair_rental:'services',
  other:'other', hotel:'other', condo:'other', resort:'other', park:'other',
};

async function run() {
  console.log(`\n${B}GCR Subtype Routing Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  const r = await fetch(BASE + '/api/gcr/entities?limit=1000');
  const data = await r.json();
  const entities = data.entities || data.businesses || [];
  console.log(`  Checking ${entities.length} active entities...\n`);

  const noSubtype = [];
  const unknownSubtype = {};
  const correctRouting = {};
  const subtypeCounts = {};

  for (const e of entities) {
    const raw = (e.entity_subtype || '').toLowerCase().replace(/-/g,'_');
    if (!raw) { noSubtype.push(e); continue; }
    subtypeCounts[raw] = (subtypeCounts[raw]||0)+1;
    if (VALID_SUBTYPES[raw]) {
      const page = VALID_SUBTYPES[raw];
      correctRouting[page] = (correctRouting[page]||0)+1;
    } else {
      unknownSubtype[raw] = unknownSubtype[raw] || [];
      unknownSubtype[raw].push(e.name);
    }
  }

  // Results
  console.log(`${B}${C}── Routing Summary ${'─'.repeat(37)}${X}`);
  for (const [page, count] of Object.entries(correctRouting).sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${G}✓${X} ${page.padEnd(20)} ${count} businesses`);
  }

  if (noSubtype.length) {
    console.log(`\n${B}${R}── ${noSubtype.length} entities with NO subtype (show on NO category page) ${'─'.repeat(10)}${X}`);
    noSubtype.slice(0,20).forEach(e => console.log(`  ${R}✗${X} ${e.name} (slug: ${e.slug})`));
    if (noSubtype.length > 20) console.log(`  ${D}...and ${noSubtype.length-20} more${X}`);
  }

  const unknownKeys = Object.keys(unknownSubtype);
  if (unknownKeys.length) {
    console.log(`\n${B}${Y}── ${unknownKeys.length} unknown subtypes (entities won't route correctly) ${'─'.repeat(10)}${X}`);
    for (const [subtype, names] of Object.entries(unknownSubtype)) {
      console.log(`  ${Y}⚠${X} "${subtype}" — ${names.slice(0,3).join(', ')}${names.length>3?` +${names.length-3} more`:''}`);
    }
    console.log(`\n${D}Fix: Add these subtypes to SUBTYPE_TO_CATEGORY in gcr-listings.js, or update the entity_subtype values in admin.${X}`);
  }

  const totalRouted = entities.length - noSubtype.length - unknownKeys.reduce((s,k)=>s+unknownSubtype[k].length,0);
  console.log(`\n${B}${totalRouted}/${entities.length} entities route to a valid category page${X}`);
  console.log(`${R}${noSubtype.length} invisible (no subtype)${X}  ${Y}${unknownKeys.reduce((s,k)=>s+unknownSubtype[k].length,0)} unknown subtype${X}`);

  // Haiku
  if (process.env.ANTHROPIC_API_KEY && (noSubtype.length || unknownKeys.length)) {
    console.log(`\n${D}Analyzing with Claude Haiku...${X}`);
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      messages: [{ role: 'user', content: `GCR category routing audit: ${entities.length} businesses.
${noSubtype.length} have NO entity_subtype — they won't appear on any category page.
Unknown subtypes: ${unknownKeys.map(k=>`"${k}"(${unknownSubtype[k].length})`).join(', ')}
Correct routing: ${Object.entries(correctRouting).map(([p,c])=>`${p}:${c}`).join(', ')}
What subtype values should the unknown ones map to? Give a fix mapping for each unknown subtype.` }]
    });
    console.log('\n' + msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });
