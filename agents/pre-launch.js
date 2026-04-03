#!/usr/bin/env node
// ============================================================
// pre-launch.js — GCR Pre-Launch Checklist
// Runs a full suite of checks before going live:
//   ✓ All public API endpoints respond correctly
//   ✓ All admin API endpoints respond correctly
//   ✓ Required data exists (entities, categories, events, etc.)
//   ✓ No broken slugs or missing hero images
//   ✓ Search works
//   ✓ Entity pages load all sections
//   ✓ Happy hour, specials, featured data
//   ✓ Response time benchmarks
//
// Usage:
//   ADMIN_EMAIL=x ADMIN_PASS=y node agents/pre-launch.js
//   ADMIN_EMAIL=x ADMIN_PASS=y node agents/pre-launch.js --base https://cybercheck-api-database.vercel.app
// ============================================================

require('dotenv').config();

const BASE   = process.argv.find(a => a.startsWith('--base='))?.split('=')[1] || process.env.API_BASE || 'http://localhost:3000';
const EMAIL  = process.env.ADMIN_EMAIL;
const PASS   = process.env.ADMIN_PASS;

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', D = '\x1b[2m', X = '\x1b[0m', B = '\x1b[1m';

let token    = null;
let checks   = [];
let warnings = [];
let failures = [];

function pass(label, detail = '')  { console.log(`  ${G}✓${X} ${label}${detail ? ' ' + D + detail + X : ''}`); checks.push({ label, ok: true }); }
function fail(label, reason = '')  { console.log(`  ${R}✗${X} ${label}${reason ? ' — ' + R + reason + X : ''}`); checks.push({ label, ok: false, reason }); failures.push({ label, reason }); }
function warn(label, detail = '')  { console.log(`  ${Y}⚠${X} ${label}${detail ? ' ' + D + detail + X : ''}`); checks.push({ label, ok: 'warn', detail }); warnings.push({ label, detail }); }
function section(t)                { console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0, 50-t.length))}${X}`); }

async function get(path) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const t = Date.now();
  const res = await fetch(BASE + path, { headers: h });
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, ms: Date.now() - t };
}

async function post(path, body) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const t = Date.now();
  const res = await fetch(BASE + path, { method: 'POST', headers: h, body: JSON.stringify(body) });
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, ms: Date.now() - t };
}

async function run() {
  console.log(`\n${B}GCR Pre-Launch Checklist${X}`);
  console.log(`${D}Target: ${BASE}${X}`);
  console.log(`${D}Time:   ${new Date().toLocaleString()}${X}`);

  // ── AUTH ──────────────────────────────────────────────────
  section('Authentication');
  if (EMAIL && PASS) {
    const r = await post('/api/admin/login', { username: EMAIL, password: PASS });
    if (r.status === 200 && r.data?.token) {
      token = r.data.token;
      pass('Admin login');
    } else {
      fail('Admin login', r.data?.error || `status ${r.status}`);
    }
  } else {
    warn('Admin credentials not set', 'Set ADMIN_EMAIL and ADMIN_PASS to test admin routes');
  }

  // ── PUBLIC API HEALTH ─────────────────────────────────────
  section('Public API Health');

  const entRes = await get('/api/gcr/entities');
  if (entRes.status === 200) {
    const entities = entRes.data?.entities || [];
    const total    = entRes.data?.total || entities.length;
    if (total > 0) pass(`Entities endpoint`, `${total} entities`);
    else           fail('Entities endpoint', 'Returns 0 entities — no data loaded');
    if (entRes.ms > 3000) warn(`Entities slow`, `${entRes.ms}ms — consider caching`);
    else if (entRes.ms > 1500) warn(`Entities response time`, `${entRes.ms}ms`);

    // Check first entity has required fields
    const e = entities[0];
    if (e) {
      if (e.name)           pass('Entities have names');
      else                  fail('Entities missing name field');
      if (e.slug)           pass('Entities have slugs');
      else                  fail('Entities missing slug field');
      if (e.hero_image_url) pass('Entities have hero images');
      else                  warn('Entities missing hero images', 'hero_image_url is null on first entity');
      if (e.entity_subtype) pass('Entities have subtypes');
      else                  warn('Entities missing entity_subtype');

      // Test single entity page
      const slug = e.slug;
      const singleRes = await get(`/api/gcr/entity/${slug}`);
      if (singleRes.status === 200 && singleRes.data?.entity) {
        pass(`Entity detail page loads`, slug);
        const ent = singleRes.data.entity;
        const sections = singleRes.data.sections || [];
        if (sections.length > 0) pass(`Entity has sections`, `${sections.length} sections`);
        else                      warn(`Entity has no sections`, `${slug} has no content sections`);
      } else {
        fail(`Entity detail page`, `${slug} returned ${singleRes.status}`);
      }
    }

    // Check entities with missing hero images across all
    const noHero = entities.filter(e => !e.hero_image_url);
    if (noHero.length > 0) warn(`${noHero.length} entities missing hero images`, noHero.slice(0, 3).map(e => e.slug).join(', ') + (noHero.length > 3 ? '...' : ''));

    // Check for duplicate slugs
    const slugs = entities.map(e => e.slug);
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
    if (dupes.length > 0) fail('Duplicate slugs found', dupes.join(', '));
    else pass('No duplicate slugs');

  } else {
    fail('Entities endpoint', `status ${entRes.status}`);
  }

  // Events
  const evRes = await get('/api/gcr/events');
  if (evRes.status === 200) {
    const count = Array.isArray(evRes.data) ? evRes.data.length : 0;
    if (count > 0) pass(`Events`, `${count} events`);
    else           warn('Events', 'No events loaded');
  } else fail('Events endpoint', `status ${evRes.status}`);

  // Specials
  const spRes = await get('/api/gcr/specials');
  if (spRes.status === 200) {
    const count = Array.isArray(spRes.data) ? spRes.data.length : 0;
    if (count > 0) pass(`Specials`, `${count} specials`);
    else           warn('Specials', 'No specials loaded');
  } else fail('Specials endpoint', `status ${spRes.status}`);

  // Happy hours
  const hhRes = await get('/api/gcr/happy-hours');
  if (hhRes.status === 200) {
    const count = Array.isArray(hhRes.data) ? hhRes.data.length : 0;
    if (count > 0) pass(`Happy hours`, `${count} schedules`);
    else           warn('Happy hours', 'No happy hour data loaded');
  } else fail('Happy hours endpoint', `status ${hhRes.status}`);

  // Categories
  const catRes = await get('/api/gcr/categories');
  if (catRes.status === 200) {
    const count = Array.isArray(catRes.data) ? catRes.data.length : 0;
    if (count >= 5) pass(`Categories`, `${count} categories`);
    else            warn('Categories', `Only ${count} — expected at least 5`);
  } else fail('Categories endpoint', `status ${catRes.status}`);

  // Featured
  const featRes = await get('/api/gcr/featured');
  if (featRes.status === 200) {
    const count = Array.isArray(featRes.data) ? featRes.data.length : 0;
    if (count > 0) pass(`Featured entities`, `${count} featured`);
    else           warn('Featured entities', 'No featured entities set');
  } else fail('Featured endpoint', `status ${featRes.status}`);

  // Search
  section('Search Functionality');
  const srchRes = await post('/api/gcr/search', { query: 'restaurant' });
  if (srchRes.status === 200 && srchRes.data?.results !== undefined) {
    const count = srchRes.data.results?.length || 0;
    if (count > 0) pass(`Search returns results`, `"restaurant" → ${count} results`);
    else           warn('Search returns no results for "restaurant"');
  } else fail('Search endpoint', `status ${srchRes.status}`);

  const srch2 = await post('/api/gcr/search-structured', { query: 'happy hour' });
  if (srch2.status === 200) pass('Structured search works');
  else fail('Structured search', `status ${srch2.status}`);

  // ── ADMIN ROUTES ──────────────────────────────────────────
  if (token) {
    section('Admin Routes');

    const statsRes = await get('/api/admin/stats');
    if (statsRes.status === 200) pass('Admin stats', JSON.stringify(statsRes.data).slice(0, 60));
    else fail('Admin stats', `status ${statsRes.status}`);

    const bizRes = await get('/api/admin/businesses');
    if (bizRes.status === 200) pass('Admin businesses', `${Array.isArray(bizRes.data) ? bizRes.data.length : '?'} businesses`);
    else fail('Admin businesses', `status ${bizRes.status}`);

    const gcrBizRes = await get('/api/admin/gcr/businesses');
    if (gcrBizRes.status === 200) {
      const count = Array.isArray(gcrBizRes.data) ? gcrBizRes.data.length : 0;
      if (count > 0) pass('GCR businesses (admin)', `${count} entities`);
      else           warn('GCR businesses (admin)', 'Returns 0 entities');
    } else fail('GCR businesses (admin)', `status ${gcrBizRes.status}`);

    const entAdminRes = await get('/api/admin/gcr/entities');
    if (entAdminRes.status === 200) {
      const list = Array.isArray(entAdminRes.data) ? entAdminRes.data : (entAdminRes.data?.entities || []);
      if (list.length > 0) {
        pass('GCR entities (admin)', `${list.length} entities`);
        // Test sections for first entity
        const firstId = list[0].id;
        const secRes = await get(`/api/admin/gcr/entities/${firstId}/sections`);
        if (secRes.status === 200) pass('Entity sections load');
        else fail('Entity sections', `status ${secRes.status}`);
      } else warn('GCR entities (admin)', 'Returns 0 entities');
    } else fail('GCR entities (admin)', `status ${entAdminRes.status}`);

    const evAdminRes = await get('/api/admin/gcr/events');
    if (evAdminRes.status === 200) pass('GCR events (admin)', `${Array.isArray(evAdminRes.data) ? evAdminRes.data.length : '?'} events`);
    else fail('GCR events (admin)', `status ${evAdminRes.status}`);

    const spAdminRes = await get('/api/admin/gcr/specials');
    if (spAdminRes.status === 200) pass('GCR specials (admin)', `${Array.isArray(spAdminRes.data) ? spAdminRes.data.length : '?'} specials`);
    else fail('GCR specials (admin)', `status ${spAdminRes.status}`);

    const revRes = await get('/api/admin/gcr/reviews');
    if (revRes.status === 200) pass('Reviews endpoint (admin)');
    else fail('Reviews endpoint (admin)', `status ${revRes.status}`);

    const custRes = await get('/api/admin/gcr/customers');
    if (custRes.status === 200) pass('Customers endpoint (admin)');
    else fail('Customers endpoint (admin)', `status ${custRes.status}`);

    const aiRes = await get('/api/admin/ai-settings');
    if (aiRes.status === 200) pass('AI settings');
    else fail('AI settings', `status ${aiRes.status}`);

    const ragRes = await get('/api/admin/rag-status');
    if (ragRes.status === 200) pass('RAG status');
    else warn('RAG status', `status ${ragRes.status}`);
  }

  // ── PERFORMANCE ───────────────────────────────────────────
  section('Performance Benchmarks');
  const perfTests = [
    { label: 'Entities load', path: '/api/gcr/entities', threshold: 2000 },
    { label: 'Events load',   path: '/api/gcr/events',   threshold: 1000 },
    { label: 'Specials load', path: '/api/gcr/specials', threshold: 1000 },
  ];
  for (const t of perfTests) {
    const r = await get(t.path);
    if (r.ms < t.threshold)         pass(`${t.label}`, `${r.ms}ms`);
    else if (r.ms < t.threshold * 2) warn(`${t.label} slow`, `${r.ms}ms (target <${t.threshold}ms)`);
    else                             fail(`${t.label} too slow`, `${r.ms}ms (target <${t.threshold}ms)`);
  }

  // ── SUMMARY ───────────────────────────────────────────────
  const total   = checks.length;
  const passed  = checks.filter(c => c.ok === true).length;
  const warned  = checks.filter(c => c.ok === 'warn').length;
  const failed  = checks.filter(c => c.ok === false).length;

  console.log(`\n${B}${'═'.repeat(58)}${X}`);
  console.log(`${B}Pre-Launch: ${G}${passed} passed${X}  ${Y}${warned} warnings${X}  ${R}${failed} failures${X}  ${D}/ ${total} total${X}`);

  if (failed === 0 && warned <= 3) {
    console.log(`\n${G}${B}✓ READY TO LAUNCH${X}`);
  } else if (failed === 0) {
    console.log(`\n${Y}${B}⚠ LAUNCH WITH CAUTION — ${warned} warnings to address${X}`);
  } else {
    console.log(`\n${R}${B}✗ NOT READY — ${failed} failures must be fixed${X}`);
    failures.forEach(f => console.log(`  ${R}→${X} ${f.label}${f.reason ? ': ' + f.reason : ''}`));
  }

  if (warnings.length > 0) {
    console.log(`\n${Y}Warnings:${X}`);
    warnings.forEach(w => console.log(`  ${Y}⚠${X} ${w.label}${w.detail ? ': ' + D + w.detail + X : ''}`));
  }

  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(R + 'Fatal: ' + X + e.message); process.exit(1); });
