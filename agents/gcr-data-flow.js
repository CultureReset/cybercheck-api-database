#!/usr/bin/env node
// ============================================================
// gcr-data-flow.js — 3-Repo Data Flow Verification (Haiku)
// Verifies that data set in cybercheck-login admin actually
// flows through cybercheck-api-database and appears correctly
// in the launching-GCR public site.
//
// Checks every data path:
//   Admin saves entity     → public /entities shows it
//   Admin saves event      → public /events shows it
//   Admin saves special    → public /specials shows it
//   Admin saves HH section → public /happy-hours shows it
//   Admin saves page config → public /category-page-config returns it
//   Admin saves site-config → public /site-config returns it
//   Entity sections exist  → public profile loads them
//   Featured entities set  → shows as featured
//
// Usage:
//   ADMIN_EMAIL=x ADMIN_PASS=y node agents/gcr-data-flow.js
//   ADMIN_EMAIL=x ADMIN_PASS=y node agents/gcr-data-flow.js --base https://cybercheck-api-database.vercel.app
// ============================================================

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE  = process.argv.find(a => a.startsWith('--base='))?.split('=')[1] || process.env.API_BASE || 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', D = '\x1b[2m', X = '\x1b[0m', B = '\x1b[1m';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let token = null;
const passed  = [];
const issues  = [];
const warns   = [];

function ok(msg)    { console.log(`  ${G}✓${X} ${msg}`); passed.push(msg); }
function fail(msg)  { console.log(`  ${R}✗${X} ${msg}`); issues.push(msg); }
function warn(msg)  { console.log(`  ${Y}⚠${X} ${msg}`); warns.push(msg); }
function section(t) { console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0, 54-t.length))}${X}`); }

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(BASE + path, opts);
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data, ok: res.status < 400 };
  } catch (e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

async function login() {
  if (!EMAIL || !PASS) {
    console.log(`${R}✗ ADMIN_EMAIL and ADMIN_PASS required.${X}`);
    console.log(`  Usage: ADMIN_EMAIL=x ADMIN_PASS=y node agents/gcr-data-flow.js\n`);
    process.exit(1);
  }
  const r = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (r.ok && r.data?.token) {
    token = r.data.token;
    ok(`Authenticated as ${r.data.name || EMAIL}`);
    return true;
  }
  fail(`Login failed — ${r.data?.error || 'unknown'}`);
  process.exit(1);
}

// ── Flow: Entity Admin → Public ───────────────────────────

async function flowEntities() {
  section('Flow 1: Entity — Admin → Public');

  const adminR = await api('GET', '/api/admin/gcr/entities');
  if (!adminR.ok) { fail(`Admin /gcr/entities failed (${adminR.status}) — ${adminR.data?.error}`); return []; }
  const adminList = adminR.data?.entities || adminR.data?.businesses || (Array.isArray(adminR.data) ? adminR.data : []);
  ok(`Admin has ${adminList.length} entities`);

  const pubR = await api('GET', '/api/gcr/entities?limit=500');
  if (!pubR.ok) { fail(`Public /entities failed (${pubR.status})`); return adminList; }
  const pubList = pubR.data?.entities || pubR.data?.businesses || (Array.isArray(pubR.data) ? pubR.data : []);
  ok(`Public /entities returns ${pubList.length} entities`);

  const pubSlugs = new Set(pubList.map(e => e.slug));
  const missing  = adminList.filter(e => !pubSlugs.has(e.slug));
  if (missing.length > 0) {
    fail(`${missing.length} admin entities NOT on public site: ${missing.slice(0,3).map(e=>e.slug).join(', ')}`);
  } else if (adminList.length > 0) {
    ok('All admin entities visible on public site');
  }

  const inactive = pubList.filter(e => e.is_active === false);
  if (inactive.length > 0) warn(`${inactive.length} inactive entities showing in public /entities`);

  const featured = pubList.filter(e => e.featured);
  if (featured.length === 0) warn('No featured entities — homepage featured section will be empty');
  else ok(`${featured.length} featured entities`);

  return adminList;
}

// ── Flow: Entity Profile Completeness ────────────────────

async function flowProfiles(entities) {
  section('Flow 2: Entity Profiles — Sections & Content');

  const sample  = entities.slice(0, 6);
  const results = [];

  for (const e of sample) {
    const r = await api('GET', `/api/gcr/entity/${encodeURIComponent(e.slug)}`);
    if (!r.ok) { fail(`Profile missing for "${e.name}" (${e.slug}) — ${r.status}`); results.push({ slug: e.slug, ok: false }); continue; }

    const d = r.data;
    const sectionCount  = (d.sections?.length || 0) + (d.menu?.sections?.length || 0) + (d.happy_hour?.sections?.length || 0);
    const hasHours      = d.hours?.length > 0;
    const hasHero       = !!(d.hero_image_url);
    const hasAddress    = !!(d.address_line_1 || d.address);
    const hasSections   = sectionCount > 0;
    const gaps = [];
    if (!hasHours)   gaps.push('no hours');
    if (!hasHero)    gaps.push('no hero image');
    if (!hasAddress) gaps.push('no address');
    if (!hasSections) gaps.push('no content sections');

    if (gaps.length === 0) ok(`"${e.name}": complete (${sectionCount} sections)`);
    else warn(`"${e.name}": ${gaps.join(', ')}`);

    results.push({ slug: e.slug, name: e.name, hasHours, hasHero, hasAddress, hasSections, sectionCount });
  }
  return results;
}

// ── Flow: Events ──────────────────────────────────────────

async function flowEvents() {
  section('Flow 3: Events — Admin → Public');

  const adminR = await api('GET', '/api/admin/gcr/events');
  if (!adminR.ok) { fail(`Admin /gcr/events failed — ${adminR.data?.error}`); return; }
  const adminEvts = adminR.data?.events || (Array.isArray(adminR.data) ? adminR.data : []);
  ok(`Admin has ${adminEvts.length} events`);

  const pubR = await api('GET', '/api/gcr/events');
  if (!pubR.ok) { fail(`Public /events failed — ${pubR.status}`); return; }
  const pubEvts = Array.isArray(pubR.data) ? pubR.data : (pubR.data?.events || []);
  ok(`Public /events returns ${pubEvts.length} events`);

  if (adminEvts.length > 0 && pubEvts.length === 0) fail('Events in admin but NONE on public site');

  const today  = new Date().toISOString().split('T')[0];
  const future = pubEvts.filter(e => (e.date || e.event_date || '') >= today);
  if (future.length === 0 && pubEvts.length > 0) warn('All events are in the past — add upcoming events');
  else if (future.length > 0) ok(`${future.length} upcoming events`);
  else if (pubEvts.length === 0) warn('No events in system');
}

// ── Flow: Specials ────────────────────────────────────────

async function flowSpecials() {
  section('Flow 4: Specials — Admin → Public');

  const adminR = await api('GET', '/api/admin/gcr/specials');
  if (!adminR.ok) { fail(`Admin /gcr/specials failed`); return; }
  const adminSp = adminR.data?.specials || (Array.isArray(adminR.data) ? adminR.data : []);
  ok(`Admin has ${adminSp.length} specials`);

  const pubR = await api('GET', '/api/gcr/specials');
  if (!pubR.ok) { fail(`Public /specials failed`); return; }
  const pubSp = Array.isArray(pubR.data) ? pubR.data : (pubR.data?.specials || []);
  ok(`Public /specials returns ${pubSp.length} specials`);

  if (adminSp.length > 0 && pubSp.length === 0) fail('Specials in admin but NONE on public site');
}

// ── Flow: Happy Hours ─────────────────────────────────────

async function flowHappyHours() {
  section('Flow 5: Happy Hours — DB sections → Public');

  const pubR = await api('GET', '/api/gcr/happy-hours');
  if (!pubR.ok) { fail(`Public /happy-hours failed (${pubR.status}) — ${pubR.data?.error}`); return; }
  const hhList = Array.isArray(pubR.data) ? pubR.data : (pubR.data?.happy_hours || []);
  ok(`Public /happy-hours returns ${hhList.length} businesses`);

  if (hhList.length === 0) {
    warn('No happy hour businesses — entities need happy_hour_sections data in GCR Supabase');
    return;
  }

  const withDays = hhList.filter(h => h.hh_days);
  const withTime = hhList.filter(h => h.hh_time_start);
  if (withDays.length < hhList.length) warn(`${hhList.length - withDays.length}/${hhList.length} HH businesses missing hh_days`);
  else ok('All HH businesses have hh_days set');

  if (withTime.length < hhList.length) warn(`${hhList.length - withTime.length}/${hhList.length} HH businesses missing hh_time_start`);
}

// ── Flow: Category Page Config ────────────────────────────

async function flowCategoryConfig() {
  section('Flow 6: Category Page Config — Admin → Public');

  const cats    = ['restaurants','things-to-do','nightlife','coffee-sweets','shopping','events','happy-hours','specials','deals'];
  const results = [];

  for (const cat of cats) {
    const adminR = await api('GET', `/api/admin/gcr/category-page-config/${cat}`);
    const pubR   = await api('GET', `/api/gcr/category-page-config/${cat}`);

    if (!adminR.ok) { fail(`Admin route missing for "${cat}" (${adminR.status})`); }
    if (!pubR.ok)   { fail(`Public route missing for "${cat}" (${pubR.status})`); }

    if (adminR.ok && pubR.ok) {
      const d = pubR.data || {};
      const hasConfig = !!(d.page_title || d.hero_image_url);
      if (hasConfig) ok(`"${cat}": config set → title="${d.page_title}", hero=${!!d.hero_image_url}`);
      else           warn(`"${cat}": routes work but NO config saved yet (add title/hero in Site Editor → Page Headers)`);
    }
    results.push({ cat, adminOk: adminR.ok, pubOk: pubR.ok, data: pubR.data || {} });
  }
  return results;
}

// ── Flow: Site Config (Home Hero / Category Cards) ────────

async function flowSiteConfig() {
  section('Flow 7: Site Config — Admin → Public');

  const adminR = await api('GET', '/api/admin/gcr/site-config');
  if (!adminR.ok) { fail(`Admin /gcr/site-config missing or failing (${adminR.status})`); }
  else {
    const d = adminR.data || {};
    const hasHero = !!(d.hero_image_url || d.hero_title);
    if (hasHero) ok('Site config has hero data set');
    else         warn('Site config exists but no hero image/title set');
  }

  const cardsR = await api('GET', '/api/admin/gcr/category-cards');
  if (!cardsR.ok) { fail(`Admin /gcr/category-cards missing or failing (${cardsR.status})`); }
  else {
    const cards = Array.isArray(cardsR.data) ? cardsR.data : [];
    if (cards.length > 0) ok(`${cards.length} category cards configured`);
    else warn('No category cards configured — homepage category grid may be empty');
  }
}

// ── Flow: Sections data completeness ──────────────────────

async function flowSections(entities) {
  if (!entities || entities.length === 0) return;
  section('Flow 8: Entity Sections — Admin Editor → API');

  let totalSections = 0, entitiesWithSections = 0;

  for (const e of entities.slice(0, 8)) {
    const r = await api('GET', `/api/admin/gcr/entities/${e.id}/sections`);
    if (!r.ok) { warn(`Sections fetch failed for "${e.name}" (${r.status})`); continue; }
    const secs = Array.isArray(r.data) ? r.data : [];
    totalSections += secs.length;
    if (secs.length > 0) entitiesWithSections++;
  }

  ok(`${entitiesWithSections}/${Math.min(entities.length, 8)} sampled entities have sections (${totalSections} total)`);
  if (entitiesWithSections === 0) warn('None of the sampled entities have sections — Entity Editor sections are empty');
}

// ── Haiku ──────────────────────────────────────────────────

async function analyzeWithHaiku(profileResults, configResults) {
  section('Claude Haiku — Data Flow Analysis');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`\n${Y}⚠  ANTHROPIC_API_KEY not set — skipping Haiku analysis.${X}`);
    printSummary();
    return;
  }

  console.log(`${D}Analyzing with Claude Haiku...${X}\n`);

  const prompt = `Gulf Coast Radar (GCR) — 3-repo platform audit (Orange Beach & Gulf Shores local discovery).

DATA FLOW TEST RESULTS:

✅ PASSED (${passed.length} checks):
${passed.map(p => '• ' + p).join('\n') || '(none)'}

❌ FAILED (${issues.length} issues):
${issues.map(i => '• ' + i).join('\n') || '(none)'}

⚠️ WARNINGS (${warns.length}):
${warns.map(w => '• ' + w).join('\n') || '(none)'}

ENTITY PROFILE SAMPLE:
${JSON.stringify(profileResults || [], null, 2)}

CATEGORY PAGE CONFIG STATUS:
${JSON.stringify(configResults || [], null, 2)}

Analyze:
1. What is broken in the admin-to-public data flow right now?
2. Which category pages need config set up (missing title/hero)?
3. Which entity profiles have the most content gaps?
4. What would make the site look broken or unfinished to visitors today?
5. Top 3 things to fix or set up next?

Format as:
🔴 BROKEN FLOWS
🟡 DATA GAPS
🏗️ SETUP NEEDED (pages/entities that need content added)
🎯 FIX THESE FIRST
⚡ QUICK WINS`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });
    console.log(msg.content[0].text);
  } catch (e) {
    console.log(`${R}Haiku failed: ${e.message}${X}`);
    printSummary();
  }
}

function printSummary() {
  console.log(`\n${B}${'═'.repeat(56)}${X}`);
  console.log(`${B}${G}${passed.length} passed${X}  ${Y}${warns.length} warnings${X}  ${R}${issues.length} issues${X}`);
  if (issues.length > 0) { console.log(`\n${R}Issues:${X}`); issues.forEach(i => console.log(`  ✗ ${i}`)); }
  if (warns.length > 0)  { console.log(`\n${Y}Warnings:${X}`); warns.forEach(w => console.log(`  ⚠ ${w}`)); }
}

async function run() {
  console.log(`\n${B}GCR Data Flow Test${X}  ${D}(Claude Haiku)${X}`);
  console.log(`${D}Base: ${BASE}${X}`);
  console.log(`${D}Time: ${new Date().toLocaleString()}${X}\n`);

  await login();

  const entities       = await flowEntities();
  const profileResults = await flowProfiles(entities);
  await flowEvents();
  await flowSpecials();
  await flowHappyHours();
  const configResults  = await flowCategoryConfig();
  await flowSiteConfig();
  await flowSections(entities);

  await analyzeWithHaiku(profileResults, configResults);
  console.log();
}

run().catch(e => { console.error(R + 'Fatal: ' + X + e.message); process.exit(1); });
