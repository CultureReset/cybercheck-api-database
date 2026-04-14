#!/usr/bin/env node
// gcr-homepage-render.js — Checks all data needed for GCR homepage to render is available
// Usage: node agents/gcr-homepage-render.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`);}

const CATEGORY_CARDS = [
  { id: 'restaurants', label: 'Restaurants', href: '/restaurants.html' },
  { id: 'coffee-sweets', label: 'Coffee & Sweets', href: '/coffee-sweets.html' },
  { id: 'shopping', label: 'Shopping', href: '/shopping.html' },
  { id: 'things-to-do', label: 'Things To Do', href: '/things-to-do.html' },
  { id: 'nightlife', label: 'Nightlife', href: '/nightlife.html' },
  { id: 'services', label: 'Services', href: '/services.html' },
  { id: 'happy-hour', label: 'Happy Hour', href: '/happy-hour.html' },
  { id: 'events', label: 'Events', href: '/events.html' },
  { id: 'other', label: 'Other', href: '/other.html' },
];

async function run() {
  console.log(`\n${B}GCR Homepage Data Render Check${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);
  console.log(`${D}Checking all API calls the homepage depends on${X}\n`);

  sec('Core Data Endpoints');

  // 1. Entities list (powers category cards and featured section)
  const entR = await fetch(BASE + '/api/gcr/entities?limit=500');
  if (!entR.ok) {
    fail(`/api/gcr/entities: ${entR.status}`);
  } else {
    const d = await entR.json();
    const entities = d?.entities || d?.businesses || [];
    ok(`/api/gcr/entities: ${entities.length} active entities`);
    if (entities.length === 0) fail('No active entities — homepage will show empty');
    else if (entities.length < 10) warn(`Only ${entities.length} active entities — homepage may look sparse`);
  }

  // 2. Events
  const evR = await fetch(BASE + '/api/gcr/events');
  if (!evR.ok) fail(`/api/gcr/events: ${evR.status}`);
  else {
    const d = await evR.json();
    const events = d?.events || d || [];
    ok(`/api/gcr/events: ${Array.isArray(events) ? events.length : 'non-array'} events`);
  }

  // 3. Specials
  const spR = await fetch(BASE + '/api/gcr/specials');
  if (!spR.ok) fail(`/api/gcr/specials: ${spR.status}`);
  else {
    const d = await spR.json();
    const specials = d?.specials || d || [];
    ok(`/api/gcr/specials: ${Array.isArray(specials) ? specials.length : 'non-array'} specials`);
  }

  // 4. Happy hours
  const hhR = await fetch(BASE + '/api/gcr/happy-hours');
  if (!hhR.ok) fail(`/api/gcr/happy-hours: ${hhR.status}`);
  else {
    const d = await hhR.json();
    const hh = d?.happy_hours || d?.entities || d || [];
    ok(`/api/gcr/happy-hours: ${Array.isArray(hh) ? hh.length : 'non-array'} entries`);
  }

  sec('Site Config (Hero + Category Cards)');

  const siteConfigRoutes = ['/api/gcr/site-config', '/api/gcr/config', '/api/gcr/site-settings'];
  let siteConfig = null;
  for (const route of siteConfigRoutes) {
    const r = await fetch(BASE + route);
    if (r.ok) {
      siteConfig = await r.json();
      ok(`Site config at: ${route}`);
      break;
    }
  }

  if (!siteConfig) {
    warn('No site config endpoint — homepage hero may be hardcoded in HTML');
  } else {
    const cfg = siteConfig?.config || siteConfig;
    // Check homepage hero
    if (cfg?.hero_title || cfg?.homepage_hero_title) ok('Homepage hero title configured');
    else warn('Homepage hero title not in site config');

    if (cfg?.hero_image_url || cfg?.homepage_hero_image) ok('Homepage hero image configured');
    else warn('Homepage hero image not configured');
  }

  sec('Category Page Configs (for category card images)');
  let configuredCount = 0;
  for (const cat of CATEGORY_CARDS) {
    const r = await fetch(BASE + `/api/gcr/category-page-config/${cat.id}`);
    if (!r.ok) {
      warn(`${cat.label}: no page config (${r.status})`);
      continue;
    }
    const d = await r.json();
    const cfg = d?.config || d;
    const hasHero = !!(cfg?.hero_image_url || cfg?.background_image_url || cfg?.image_url);
    const hasTitle = !!(cfg?.title || cfg?.hero_title || cfg?.heading);
    if (hasHero && hasTitle) {
      configuredCount++;
      ok(`${cat.label}: title + hero configured ✓`);
    } else {
      warn(`${cat.label}: missing ${!hasTitle?'title':''}${!hasTitle&&!hasHero?' + ':''}${!hasHero?'hero':''}`);
    }
  }
  ok(`${configuredCount}/${CATEGORY_CARDS.length} category pages fully configured`);

  sec('Entity Data Quality for Homepage Cards');
  const entR2 = await fetch(BASE + '/api/gcr/entities?limit=500');
  const entities2 = entR2.ok ? ((await entR2.json())?.entities || []) : [];

  const withImage = entities2.filter(e => !!e.hero_image_url).length;
  const withSubtype = entities2.filter(e => !!e.entity_subtype).length;
  const withAddress = entities2.filter(e => !!e.address_line_1).length;
  const withPhone = entities2.filter(e => !!e.phone).length;

  ok(`hero_image_url: ${withImage}/${entities2.length} (${Math.round(withImage/Math.max(entities2.length,1)*100)}%)`);
  ok(`entity_subtype: ${withSubtype}/${entities2.length} (${Math.round(withSubtype/Math.max(entities2.length,1)*100)}%)`);
  ok(`address: ${withAddress}/${entities2.length} (${Math.round(withAddress/Math.max(entities2.length,1)*100)}%)`);
  ok(`phone: ${withPhone}/${entities2.length} (${Math.round(withPhone/Math.max(entities2.length,1)*100)}%)`);

  if (withSubtype < entities2.length * 0.9) warn(`${entities2.length - withSubtype} entities missing subtype — won't appear on category pages`);
  if (withImage < entities2.length * 0.5) warn(`Only ${withImage} entities have hero images — listing cards will look blank`);

  sec('Response Time Check');
  const timings = {};
  const endpoints = [
    '/api/gcr/entities?limit=500',
    '/api/gcr/events',
    '/api/gcr/specials',
  ];
  for (const ep of endpoints) {
    const start = Date.now();
    await fetch(BASE + ep);
    const ms = Date.now() - start;
    timings[ep] = ms;
    if (ms > 3000) warn(`${ep}: ${ms}ms (slow)`);
    else ok(`${ep}: ${ms}ms`);
  }

  // Overall readiness score
  const score = Math.round((passed.length / (passed.length + failed.length + warned.length)) * 100);
  console.log(`\n${B}Homepage readiness score: ${score}%${X}`);

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 350,
      messages: [{ role: 'user', content: `GCR homepage render check: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
${entities2.length} active entities. ${configuredCount}/9 category pages configured.
Hero images: ${withImage}/${entities2.length}. Subtypes: ${withSubtype}/${entities2.length}.
Failed: ${failed.join(' | ')}
Warnings: ${warned.join(' | ')}
What must be done before the homepage looks good at launch?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });
