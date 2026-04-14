#!/usr/bin/env node
// ============================================================
// test-api-health.js — GCR Admin API Health Checker
// Tests every admin + GCR endpoint and reports pass/fail
//
// Usage:
//   node agents/test-api-health.js
//   node agents/test-api-health.js --base http://localhost:3000
//   ADMIN_EMAIL=you@email.com ADMIN_PASS=yourpass node agents/test-api-health.js
// ============================================================

const BASE = process.env.API_BASE || process.argv.find(a => a.startsWith('--base='))?.split('=')[1] || 'http://localhost:3000';
const EMAIL = process.env.ADMIN_EMAIL || process.argv.find(a => a.startsWith('--email='))?.split('=')[1];
const PASS  = process.env.ADMIN_PASS  || process.argv.find(a => a.startsWith('--pass='))?.split('=')[1];

let token = null;
let results = [];
let entityId = null;
let entitySlug = null;

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

function pad(str, len) { return String(str).padEnd(len, ' '); }

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function check(label, method, path, body, opts = {}) {
  const start = Date.now();
  try {
    const { status, data } = await req(method, path, body);
    const ms = Date.now() - start;
    const ok = opts.expectedStatus ? status === opts.expectedStatus : status < 400;
    const isArray = Array.isArray(data);
    const isEmpty = isArray && data.length === 0;
    const hasError = data && data.error;

    let symbol, color;
    if (!ok || hasError) { symbol = '✗'; color = RED; }
    else if (isEmpty && opts.warnEmpty !== false) { symbol = '○'; color = YELLOW; }
    else { symbol = '✓'; color = GREEN; }

    const detail = hasError ? ` — ${data.error}` :
      isArray ? ` (${data.length} items)` :
      (data && typeof data === 'object' && Object.keys(data).length > 0) ? ` (${Object.keys(data).slice(0,3).join(', ')}...)` : '';

    const line = `  ${color}${symbol}${RESET} ${pad(label, 38)} ${DIM}${pad(status, 5)} ${pad(ms+'ms', 7)}${RESET}${detail}`;
    console.log(line);

    results.push({ label, status, ok: ok && !hasError, isEmpty, ms, error: hasError ? data.error : null });

    // Capture first entity for detail tests
    // /api/gcr/entities returns { entities: [...], businesses: [...], total: N }
    const entityList = isArray ? data : (data?.entities || data?.businesses || []);
    if ((path === '/api/gcr/entities' || path === '/api/admin/gcr/entities') && entityList.length > 0 && !entitySlug) {
      entityId = entityList[0].id;
      entitySlug = entityList[0].slug;
    }
    if (path === '/api/admin/gcr/businesses' && isArray && data.length > 0 && !entityId) {
      entityId = data[0].id;
      entitySlug = data[0].slug;
    }

    return { status, data, ok: ok && !hasError };
  } catch (e) {
    const ms = Date.now() - start;
    console.log(`  ${RED}✗${RESET} ${pad(label, 38)} ${DIM}${'ERR'.padEnd(5)} ${(ms+'ms').padEnd(7)}${RESET} — ${e.message}`);
    results.push({ label, status: 0, ok: false, error: e.message, ms });
    return { status: 0, data: null, ok: false };
  }
}

function section(title) {
  console.log(`\n${BOLD}${CYAN}── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}${RESET}`);
}

async function login() {
  if (!EMAIL || !PASS) {
    console.log(`\n${YELLOW}⚠  No credentials provided.${RESET}`);
    console.log(`   Set ADMIN_EMAIL and ADMIN_PASS env vars, or pass --email= --pass=`);
    console.log(`   ${DIM}Skipping auth-required endpoints.${RESET}\n`);
    return false;
  }
  console.log(`\n${DIM}Logging in as ${EMAIL}...${RESET}`);
  const { status, data } = await req('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (status === 200 && data?.token) {
    token = data.token;
    console.log(`${GREEN}✓ Logged in${RESET} ${DIM}(${data.name || EMAIL})${RESET}`);
    return true;
  }
  console.log(`${RED}✗ Login failed — status ${status}${RESET}`, data?.error || '');
  return false;
}

async function run() {
  console.log(`\n${BOLD}CyberCheck / GCR API Health Check${RESET}`);
  console.log(`${DIM}Base: ${BASE}${RESET}`);
  console.log(`${DIM}Time: ${new Date().toLocaleString()}${RESET}`);

  // ── AUTH ────────────────────────────────────────────────
  const loggedIn = await login();

  // ── PUBLIC GCR ROUTES ───────────────────────────────────
  section('Public GCR Routes');
  await check('GET /api/gcr/entities',            'GET',  '/api/gcr/entities');
  const pubEnt = await check('GET /api/gcr/entity/:slug','GET', entitySlug ? `/api/gcr/entity/${entitySlug}` : '/api/gcr/entity/test');
  await check('GET /api/gcr/events',              'GET',  '/api/gcr/events');
  await check('GET /api/gcr/happy-hours',         'GET',  '/api/gcr/happy-hours');
  await check('GET /api/gcr/specials',            'GET',  '/api/gcr/specials');
  await check('GET /api/gcr/categories',          'GET',  '/api/gcr/categories');
  await check('GET /api/gcr/featured',            'GET',  '/api/gcr/featured');
  await check('GET /api/gcr/trending',            'GET',  '/api/gcr/trending');
  await check('POST /api/gcr/search',             'POST', '/api/gcr/search', { query: 'restaurant' });
  await check('POST /api/gcr/search-structured',  'POST', '/api/gcr/search-structured', { query: 'restaurants' });

  if (!loggedIn) {
    section('Admin Routes (skipped — not logged in)');
    console.log(`  ${YELLOW}○${RESET} All admin routes require auth token`);
    printSummary();
    return;
  }

  // ── ADMIN OVERVIEW ──────────────────────────────────────
  section('Admin Overview');
  await check('GET /api/admin/stats',             'GET',  '/api/admin/stats');
  await check('GET /api/admin/businesses',        'GET',  '/api/admin/businesses');
  await check('GET /api/admin/users',             'GET',  '/api/admin/users');
  await check('GET /api/admin/system/health',     'GET',  '/api/admin/system/health');

  // ── GCR ADMIN BUSINESSES ────────────────────────────────
  section('GCR Admin — Businesses / Entities');
  await check('GET /api/admin/gcr/businesses',    'GET',  '/api/admin/gcr/businesses');
  await check('GET /api/admin/gcr/entities',      'GET',  '/api/admin/gcr/entities');

  if (entityId) {
    await check(`GET /api/admin/gcr/entities/:id`,  'GET', `/api/admin/gcr/entities/${entityId}`);
    await check(`GET entities/:id/sections`,         'GET', `/api/admin/gcr/entities/${entityId}/sections`);
  }

  // ── GCR ADMIN EVENTS ────────────────────────────────────
  section('GCR Admin — Events & Specials');
  await check('GET /api/admin/gcr/events',        'GET',  '/api/admin/gcr/events');
  await check('GET /api/admin/gcr/specials',      'GET',  '/api/admin/gcr/specials');

  // ── GCR ADMIN BUSINESS TOOLS ────────────────────────────
  section('GCR Admin — Business Tools');
  await check('GET /api/admin/gcr/reviews',       'GET',  '/api/admin/gcr/reviews');
  await check('GET /api/admin/gcr/customers',     'GET',  '/api/admin/gcr/customers');
  await check('GET /api/admin/gcr/coupons',       'GET',  '/api/admin/gcr/coupons');
  await check('GET /api/admin/gcr/analytics',     'GET',  '/api/admin/gcr/analytics');

  if (entityId) {
    await check('GET /api/admin/gcr/seo/:id',     'GET',  `/api/admin/gcr/seo/${entityId}`);
    await check('GET /api/admin/gcr/messaging/:id','GET', `/api/admin/gcr/messaging/${entityId}`);
  }

  // ── AI / RAG ────────────────────────────────────────────
  section('AI & RAG');
  await check('GET /api/admin/ai-settings',       'GET',  '/api/admin/ai-settings');
  await check('GET /api/admin/rag-status',        'GET',  '/api/admin/rag-status');

  // ── SECTIONS / CONTENT ──────────────────────────────────
  if (entityId) {
    section('Sections Content (first entity)');
    const secRes = await req('GET', `/api/admin/gcr/entities/${entityId}/sections`);
    if (secRes.data && Array.isArray(secRes.data) && secRes.data.length > 0) {
      const secId = secRes.data[0].id;
      await check('GET sections/:id/bullets',   'GET', `/api/admin/gcr/sections/${secId}/bullets`);
      await check('GET sections/:id/groups',    'GET', `/api/admin/gcr/sections/${secId}/groups`);
      await check('GET sections/:id/cards',     'GET', `/api/admin/gcr/sections/${secId}/cards`);
      await check('GET sections/:id/photos',    'GET', `/api/admin/gcr/sections/${secId}/photos`);
    } else {
      console.log(`  ${DIM}○ No sections found for entity — skipping section content tests${RESET}`);
    }
  }

  printSummary();
}

function printSummary() {
  const total   = results.length;
  const passed  = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok && !r.isEmpty).length;
  const empty   = results.filter(r => r.ok && r.isEmpty).length;
  const broken  = results.filter(r => !r.ok);

  console.log(`\n${BOLD}${'═'.repeat(58)}${RESET}`);
  console.log(`${BOLD}Results: ${GREEN}${passed} passed${RESET}  ${YELLOW}${empty} empty${RESET}  ${RED}${failed} failed${RESET}  ${DIM}/ ${total} total${RESET}`);

  if (broken.length > 0) {
    console.log(`\n${BOLD}${RED}Failed endpoints:${RESET}`);
    broken.forEach(r => {
      console.log(`  ${RED}✗${RESET} ${r.label} ${DIM}(status: ${r.status})${RESET}${r.error ? ' — ' + r.error : ''}`);
    });
  }

  const slow = results.filter(r => r.ms > 2000);
  if (slow.length > 0) {
    console.log(`\n${YELLOW}Slow responses (>2s):${RESET}`);
    slow.forEach(r => console.log(`  ${YELLOW}⚡${RESET} ${r.label} ${DIM}${r.ms}ms${RESET}`));
  }

  console.log(`\n${DIM}Run with ADMIN_EMAIL=x ADMIN_PASS=y to test auth-required routes.${RESET}\n`);
}

run().catch(e => { console.error(RED + 'Fatal: ' + RESET + e.message); process.exit(1); });
