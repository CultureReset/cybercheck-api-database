#!/usr/bin/env node
// ============================================================
// gcr-system-audit.js — Full 3-Repo System Audit (Claude Haiku)
// Tests every API endpoint called by all 3 repos:
//   1. launching-GCR      (public frontend)
//   2. cybercheck-login   (admin dashboard)
//   3. cybercheck-api-database (API / Vercel backend)
//
// Usage:
//   node agents/gcr-system-audit.js
//   ADMIN_EMAIL=x ADMIN_PASS=y node agents/gcr-system-audit.js
//   node agents/gcr-system-audit.js --base https://cybercheck-api-database.vercel.app
// ============================================================

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE  = process.argv.find(a => a.startsWith('--base='))?.split('=')[1] || process.env.API_BASE || 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', D = '\x1b[2m', X = '\x1b[0m', B = '\x1b[1m';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let token = null;
const collected = {};

// ── HTTP helpers ───────────────────────────────────────────

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

async function probe(label, path, method = 'GET', body = null, opts = {}) {
  const r = await api(method, path, body);
  const arr = Array.isArray(r.data) ? r.data
    : (r.data?.entities || r.data?.businesses || r.data?.events
    || r.data?.specials || r.data?.results || r.data?.reviews
    || r.data?.customers || r.data?.coupons || null);
  const count  = arr ? arr.length : null;
  const hasErr = r.data?.error;
  const isSkip = opts.skipToken && !token;

  let sym, col;
  if (isSkip)         { sym = '-'; col = D; }
  else if (!r.ok || hasErr) { sym = '✗'; col = R; }
  else if (count === 0)     { sym = '○'; col = Y; }
  else                      { sym = '✓'; col = G; }

  const detail = hasErr ? ` — ${r.data.error}` :
    count !== null ? ` (${count})` :
    (r.data && typeof r.data === 'object') ? ` {${Object.keys(r.data).slice(0,4).join(', ')}}` : '';

  const note = isSkip ? ' [skipped — no auth]' : '';
  console.log(`  ${col}${sym}${X} ${(method + ' ' + path).padEnd(50, ' ')} ${D}${r.status||'---'}${X}${detail}${D}${note}${X}`);

  collected[label] = {
    path, method, status: r.status, ok: r.ok && !hasErr,
    count, empty: count === 0, error: hasErr ? r.data.error : r.error || null,
    data: r.data, skipped: isSkip,
  };
  return r;
}

function section(t) { console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0, 54 - t.length))}${X}`); }
function note(msg)  { console.log(`  ${D}${msg}${X}`); }

// ── Auth ──────────────────────────────────────────────────

async function login() {
  if (!EMAIL || !PASS) {
    console.log(`\n${Y}⚠  No credentials — admin endpoints will show as skipped.${X}`);
    console.log(`   ADMIN_EMAIL=x ADMIN_PASS=y node agents/gcr-system-audit.js\n`);
    return false;
  }
  const r = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (r.ok && r.data?.token) {
    token = r.data.token;
    console.log(`${G}✓ Logged in as ${r.data.name || EMAIL}${X}\n`);
    return true;
  }
  console.log(`${R}✗ Login failed — ${r.data?.error || 'unknown'}${X}\n`);
  return false;
}

// ── Probe all endpoints ───────────────────────────────────

async function runAllProbes() {

  // ════════════════════════════════════════════════════════
  // REPO 1: launching-GCR — Public Frontend API calls
  // These are called by gcr-api.js on page load
  // ════════════════════════════════════════════════════════

  section('REPO 1 — launching-GCR: Public API (gcr-api.js)');
  const entRes = await probe('pub:entities',          '/api/gcr/entities?limit=500');
  await probe('pub:events',                           '/api/gcr/events');
  await probe('pub:specials',                         '/api/gcr/specials');
  await probe('pub:happy-hours',                      '/api/gcr/happy-hours');

  section('launching-GCR: Category Page Config (gcr-config.js)');
  note('Each category page calls GET /api/gcr/category-page-config/:cat on load');
  const cats = ['restaurants','things-to-do','nightlife','coffee-sweets','shopping','hotels','services','events','specials','happy-hours','deals','artists','public-spots'];
  for (const cat of cats) {
    await probe(`pub:cat-config:${cat}`, `/api/gcr/category-page-config/${cat}`);
  }

  section('launching-GCR: Search (search.html)');
  await probe('pub:search:restaurant',   '/api/gcr/search', 'POST', { query: 'restaurant' });
  await probe('pub:search:happy-hour',   '/api/gcr/search', 'POST', { query: 'happy hour' });
  await probe('pub:search:seafood',      '/api/gcr/search', 'POST', { query: 'seafood' });

  section('launching-GCR: Entity Profiles (profile.html)');
  const entities = (entRes.data?.entities || entRes.data?.businesses || (Array.isArray(entRes.data) ? entRes.data : []));
  const sample5  = entities.slice(0, 5);
  if (sample5.length > 0) {
    for (const e of sample5) {
      await probe(`pub:profile:${e.slug}`, `/api/gcr/entity/${encodeURIComponent(e.slug)}`);
    }
  } else {
    note('No entities found — skipping profile tests');
  }

  section('launching-GCR: RAG / Concierge (concierge.html)');
  await probe('pub:ask',    '/api/gcr/ask',    'POST', { question: 'Where can I get seafood?' });

  // ════════════════════════════════════════════════════════
  // REPO 2: cybercheck-login — Admin Dashboard API calls
  // Organized exactly by sidebar nav section
  // ════════════════════════════════════════════════════════

  const sk = { skipToken: true };

  section('REPO 2 — cybercheck-login: Overview Page');
  await probe('adm:stats',                      '/api/admin/stats',                'GET', null, sk);
  await probe('adm:businesses',                 '/api/admin/businesses',           'GET', null, sk);
  await probe('adm:gcr-businesses-overview',    '/api/admin/gcr/businesses',       'GET', null, sk);

  section('cybercheck-login: Businesses (CyberCheck legacy)');
  await probe('adm:businesses-list',            '/api/admin/businesses',           'GET', null, sk);
  await probe('adm:users',                      '/api/admin/users',                'GET', null, sk);
  await probe('adm:bookings',                   '/api/admin/bookings',             'GET', null, sk);
  await probe('adm:system-health',              '/api/admin/system/health',        'GET', null, sk);

  section('cybercheck-login: GCR Businesses (gcr-businesses page)');
  await probe('adm:gcr-businesses',             '/api/admin/gcr/businesses',       'GET', null, sk);

  section('cybercheck-login: GCR Entity Editor (gcr-entity-editor page)');
  const adminEntRes = await probe('adm:gcr-entities',  '/api/admin/gcr/entities', 'GET', null, sk);
  const adminEnts   = adminEntRes.data?.entities || adminEntRes.data?.businesses || (Array.isArray(adminEntRes.data) ? adminEntRes.data : []);

  if (token && adminEnts.length > 0) {
    const e = adminEnts[0];
    await probe('adm:gcr-entity-get',            `/api/admin/gcr/entities/${e.id}`);
    await probe('adm:gcr-entity-sections',       `/api/admin/gcr/entities/${e.id}/sections`);
    await probe('adm:gcr-entity-features',       `/api/admin/gcr/entities/${e.id}/features`);

    // Sections content — grab first section
    const secRes = await api('GET', `/api/admin/gcr/entities/${e.id}/sections`);
    const secs   = Array.isArray(secRes.data) ? secRes.data : [];
    if (secs.length > 0) {
      const sid = secs[0].id;
      section('cybercheck-login: Section Content Editor');
      await probe('adm:sec-rich-text-get',       `/api/admin/gcr/sections/${sid}/rich-text-get`);
      await probe('adm:sec-bullets',             `/api/admin/gcr/sections/${sid}/bullets`);
      await probe('adm:sec-groups',              `/api/admin/gcr/sections/${sid}/groups`);
      await probe('adm:sec-cards',               `/api/admin/gcr/sections/${sid}/cards`);
      await probe('adm:sec-photos',              `/api/admin/gcr/sections/${sid}/photos`);
    } else {
      note(`Entity "${e.name}" has no sections yet`);
    }
  } else if (!token) {
    note('Entity editor routes require auth — pass ADMIN_EMAIL + ADMIN_PASS');
  } else {
    note('No entities found to test entity editor');
  }

  section('cybercheck-login: GCR Site Editor (gcr-site-editor page)');
  note('Site Editor has 4 tabs: Home Hero · Category Cards · Page Headers · Entity Pages');
  await probe('adm:site-config',                '/api/admin/gcr/site-config',      'GET', null, sk);
  await probe('adm:category-cards',             '/api/admin/gcr/category-cards',   'GET', null, sk);

  section('cybercheck-login: Site Editor — Page Headers tab');
  note('Saves page title / description / hero image per category page');
  for (const cat of ['restaurants','happy-hours','events','things-to-do','nightlife']) {
    await probe(`adm:cat-page-config:${cat}`,   `/api/admin/gcr/category-page-config/${cat}`, 'GET', null, sk);
  }

  section('cybercheck-login: Site Editor — Page Assignments tab');
  note('Controls which entity sections appear on category listing pages');
  for (const cat of ['restaurants','happy-hours']) {
    await probe(`adm:page-assignments:${cat}`,  `/api/admin/gcr/page-assignments/${cat}`,     'GET', null, sk);
  }

  section('cybercheck-login: Site Editor — Entity Pages tab');
  if (token && adminEnts.length > 0) {
    const e = adminEnts[0];
    await probe('adm:entity-pages',             `/api/admin/gcr/entity-pages/${e.id}`);
  } else {
    await probe('adm:entity-pages-sample',      '/api/admin/gcr/entity-pages/test',    'GET', null, sk);
  }

  section('cybercheck-login: GCR Events page');
  await probe('adm:gcr-events',                 '/api/admin/gcr/events',           'GET', null, sk);

  section('cybercheck-login: GCR Specials page');
  await probe('adm:gcr-specials',               '/api/admin/gcr/specials',         'GET', null, sk);

  section('cybercheck-login: Bulk Upload page');
  note('Import endpoints — tested for 404 only (no POST data sent)');
  const importRoutes = [
    '/api/admin/gcr/import-csv',
    '/api/admin/gcr/import-menu',
    '/api/admin/gcr/import-drinks',
    '/api/admin/gcr/import-events',
    '/api/admin/gcr/import-specials',
    '/api/admin/gcr/import-happyhour',
    '/api/admin/gcr/import-section-based',
  ];
  for (const r of importRoutes) {
    // POST with empty body — 400 = route exists, 404 = route missing
    const res = await api('POST', r, {});
    const exists = res.status !== 404;
    const sym    = exists ? `${G}✓${X}` : `${R}✗${X}`;
    const status = exists ? `${res.status} (exists)` : `${R}404 MISSING${X}`;
    console.log(`  ${sym} POST ${r.padEnd(46)} ${D}${status}${X}`);
    collected[`import:${r}`] = { path: r, method: 'POST', status: res.status, ok: exists, error: res.status === 404 ? 'MISSING' : null };
  }

  section('cybercheck-login: AI / RAG page');
  await probe('adm:ai-settings',                '/api/admin/ai-settings',          'GET', null, sk);
  await probe('adm:rag-status',                 '/api/admin/rag-status',           'GET', null, sk);
  await probe('pub:gcr-ask-rag',                '/api/gcr/ask',       'POST', { question: 'test' });

  section('cybercheck-login: Reviews / Customers / Coupons / Analytics');
  await probe('adm:reviews',                    '/api/admin/gcr/reviews',          'GET', null, sk);
  await probe('adm:customers',                  '/api/admin/gcr/customers',        'GET', null, sk);
  await probe('adm:coupons',                    '/api/admin/gcr/coupons',          'GET', null, sk);
  await probe('adm:analytics',                  '/api/admin/gcr/analytics',        'GET', null, sk);

  if (token && adminEnts.length > 0) {
    const e = adminEnts[0];
    await probe('adm:messaging',                `/api/admin/gcr/messaging/${e.id}`);
    await probe('adm:seo',                      `/api/admin/gcr/seo/${e.id}`);
  }

  section('cybercheck-login: Business-level CyberCheck data');
  note('Used in Business Data tab for old CyberCheck businesses');
  if (token) {
    const bizRes = await api('GET', '/api/admin/businesses');
    const bizList = Array.isArray(bizRes.data) ? bizRes.data : [];
    if (bizList.length > 0) {
      const b = bizList[0];
      await probe('adm:biz-full',               `/api/admin/businesses/${b.id || b.site_id}/full`);
      await probe('adm:gcr-biz-data',           `/api/admin/gcr/business-data/${b.site_id || b.id}`);
    } else {
      note('No CyberCheck businesses found');
    }
  } else {
    note('Requires auth — skipping business detail tests');
  }

  // ════════════════════════════════════════════════════════
  // REPO 3: cybercheck-api-database — Misc / utility routes
  // ════════════════════════════════════════════════════════

  section('REPO 3 — cybercheck-api-database: Misc Routes');
  await probe('misc:upload-image',              '/api/admin/gcr/upload-image',     'POST', null, sk);
  await probe('misc:auto-activate-top5',        '/api/admin/gcr/auto-activate-top5', 'POST', null, sk);
  await probe('misc:scrape-url',                '/api/admin/scrape-url',           'POST', null, sk);
  await probe('misc:ai-organize',               '/api/admin/ai-organize',          'POST', null, sk);
  await probe('misc:ai-save-business',          '/api/admin/ai-save-business',     'POST', null, sk);
}

// ── Haiku analysis ─────────────────────────────────────────

async function analyzeWithHaiku() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(`\n${Y}⚠  ANTHROPIC_API_KEY not set — printing raw summary instead.${X}`);
    printRawSummary();
    return;
  }

  section('Claude Haiku — Cross-Repo Analysis');
  console.log(`${D}Sending ${Object.keys(collected).length} probe results to Haiku...${X}\n`);

  const failed  = Object.entries(collected).filter(([,v]) => !v.ok && !v.skipped);
  const empty   = Object.entries(collected).filter(([,v]) => v.ok && v.empty);
  const missing = Object.entries(collected).filter(([,v]) => v.status === 404);
  const working = Object.entries(collected).filter(([,v]) => v.ok && !v.empty);

  const catConfigs = cats_status();
  const importStatus = Object.entries(collected)
    .filter(([k]) => k.startsWith('import:'))
    .map(([k, v]) => ({ route: v.path, exists: v.ok }));

  const auditData = {
    base: BASE,
    authenticated: !!token,
    summary: { working: working.length, empty: empty.length, missing: missing.length, failed: failed.length, total: Object.keys(collected).length },
    missingRoutes:  missing.map(([, v]) => ({ method: v.method, path: v.path })),
    failedRoutes:   failed.map(([, v]) => ({ method: v.method, path: v.path, status: v.status, error: v.error })),
    emptyRoutes:    empty.map(([, v])   => ({ path: v.path })),
    categoryPageConfigs: catConfigs,
    importRoutes: importStatus,
  };

  const prompt = `You are auditing Gulf Coast Radar (GCR) — a local discovery platform for Orange Beach & Gulf Shores, AL.
The system has 3 repos that must all work together:
  1. launching-GCR       → public frontend (category pages, search, profiles, concierge)
  2. cybercheck-login    → admin dashboard (entity editor, site editor, events, specials, bulk upload, AI tools)
  3. cybercheck-api-database → Vercel REST API connecting admin to public

Here are the live probe results across all 3 repos:

${JSON.stringify(auditData, null, 2)}

Analyze and report:
1. Which routes return 404 (MISSING — route doesn't exist in the API at all)?
2. Which routes return errors (BROKEN — route exists but fails)?
3. Which routes return empty data (may be unseeded or filter issue)?
4. Which category pages have NO config set (no title, no hero image)?
5. Which import/bulk-upload routes are missing?
6. What is the most critical gap preventing the site from working end-to-end?
7. Quick wins — what can be fixed fast?

Format exactly as:
🔴 MISSING ROUTES (404s)
🟠 BROKEN ROUTES (errors)
🟡 EMPTY DATA
🏗️ CATEGORY PAGES WITHOUT CONFIG
📦 MISSING IMPORT ROUTES
🎯 CRITICAL GAP
⚡ QUICK WINS`;

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1100,
      messages: [{ role: 'user', content: prompt }],
    });
    console.log(msg.content[0].text);
  } catch (e) {
    console.log(`${R}Haiku unavailable: ${e.message}${X}`);
    printRawSummary();
  }
}

function cats_status() {
  const cats = ['restaurants','things-to-do','nightlife','coffee-sweets','shopping','hotels','services','events','specials','happy-hours','deals','artists','public-spots'];
  return cats.map(cat => {
    const k = `pub:cat-config:${cat}`;
    const v = collected[k];
    const d = v?.data || {};
    return { cat, routeOk: v?.ok, hasTitle: !!(d.page_title), hasHero: !!(d.hero_image_url) };
  });
}

function printRawSummary() {
  const failed  = Object.entries(collected).filter(([,v]) => !v.ok && !v.skipped);
  const missing = failed.filter(([,v]) => v.status === 404);
  const broken  = failed.filter(([,v]) => v.status !== 404 && v.status !== 0);
  const empty   = Object.entries(collected).filter(([,v]) => v.ok && v.empty);
  const working = Object.entries(collected).filter(([,v]) => v.ok && !v.empty);

  console.log(`\n${B}${'═'.repeat(58)}${X}`);
  console.log(`${B}${G}${working.length} working${X}  ${Y}${empty.length} empty${X}  ${R}${missing.length} missing (404)${X}  ${R}${broken.length} broken${X}`);

  if (missing.length > 0) {
    console.log(`\n${R}Missing routes (404):${X}`);
    missing.forEach(([, v]) => console.log(`  ${R}✗${X} ${v.method} ${v.path}`));
  }
  if (broken.length > 0) {
    console.log(`\n${Y}Broken routes (errors):${X}`);
    broken.forEach(([, v]) => console.log(`  ${Y}✗${X} ${v.method} ${v.path} — ${v.error || v.status}`));
  }
}

async function run() {
  console.log(`\n${B}GCR 3-Repo System Audit${X}  ${D}(Claude Haiku)${X}`);
  console.log(`${D}Base: ${BASE}${X}`);
  console.log(`${D}Time: ${new Date().toLocaleString()}${X}`);
  await login();
  await runAllProbes();
  await analyzeWithHaiku();
  console.log();
}

run().catch(e => { console.error(R + 'Fatal: ' + X + e.message); process.exit(1); });
