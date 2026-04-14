#!/usr/bin/env node
// gcr-404-handling.js — Tests how the API handles bad/missing slugs, invalid IDs,
// missing required fields, and malformed requests. Verifies errors are clean JSON, not crashes.
// Usage: node agents/gcr-404-handling.js

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

async function req(method, path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  try {
    const r = await fetch(BASE + path, opts);
    let data; try { data = await r.json(); } catch { data = null; }
    return { status: r.status, data, ok: r.ok };
  } catch(e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

function checkErrorShape(label, res, expectedStatus) {
  if (res.status === 0) { fail(`${label} — network error`); return; }
  if (res.status !== expectedStatus) {
    warn(`${label} — expected ${expectedStatus}, got ${res.status}`);
    return;
  }
  if (!res.data) { fail(`${label} — returned empty body (status ${res.status})`); return; }
  if (typeof res.data !== 'object') { fail(`${label} — returned non-JSON`); return; }
  // Should have an error field
  if (res.data.error || res.data.message || res.data.entity === null) {
    ok(`${label} — clean error JSON (${res.status})`);
  } else {
    warn(`${label} — status ${res.status} but no error field in response`);
  }
}

async function run() {
  console.log(`\n${B}404 & Error Handling Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  // Login for admin tests
  let token = null;
  if (EMAIL && PASS) {
    const lr = await req('POST', '/api/admin/login', { username: EMAIL, password: PASS });
    if (lr.data?.token) { token = lr.data.token; ok('Admin login'); }
  }

  // ── Public endpoint bad slugs ──────────────────────────
  sec('Bad Slugs — Public API');
  const badSlugs = ['this-does-not-exist', 'fake-restaurant-abc123', '___invalid___', 'null', '1234567890'];
  for (const slug of badSlugs) {
    const r = await req('GET', `/api/gcr/entity/${slug}`);
    if (r.status === 404) {
      ok(`/entity/${slug} → 404`);
    } else if (r.status === 200 && r.data?.entity === null) {
      ok(`/entity/${slug} → 200 with null entity (acceptable)`);
    } else if (r.status === 200 && !r.data?.entity) {
      warn(`/entity/${slug} → 200 with no entity field`);
    } else if (r.status === 500) {
      fail(`/entity/${slug} → 500 crash (should be 404)`);
    } else {
      warn(`/entity/${slug} → unexpected status ${r.status}`);
    }
  }

  // ── Bad UUIDs in admin routes ──────────────────────────
  sec('Bad IDs — Admin API');
  if (token) {
    const badIds = ['00000000-0000-0000-0000-000000000000', 'not-a-uuid', '999999'];
    for (const id of badIds) {
      const r = await req('GET', `/api/admin/gcr/entities/${id}`, null, token);
      if (r.status === 404 || r.status === 400) {
        ok(`GET /entities/${id} → ${r.status} (correct)`);
      } else if (r.status === 500) {
        fail(`GET /entities/${id} → 500 crash`);
      } else {
        warn(`GET /entities/${id} → ${r.status}`);
      }
    }
  } else {
    warn('Skipping admin bad-ID tests — no auth credentials');
  }

  // ── Missing required fields ────────────────────────────
  sec('Missing Required Fields — Create Entity');
  if (token) {
    // Missing name
    const r1 = await req('POST', '/api/admin/gcr/entities', { entity: { slug: 'test-no-name' } }, token);
    if (r1.status === 400) ok('Missing name → 400 (correct)');
    else if (r1.status === 500) fail('Missing name → 500 crash (should be 400)');
    else warn(`Missing name → ${r1.status}`);

    // Missing slug
    const r2 = await req('POST', '/api/admin/gcr/entities', { entity: { name: 'Test No Slug' } }, token);
    if (r2.status === 400 || r2.status === 200) {
      // 200 is ok if API auto-generates slug from name
      ok(`Missing slug → ${r2.status} (auto-slug or 400 — both acceptable)`);
    } else if (r2.status === 500) {
      fail('Missing slug → 500 crash');
    }

    // Empty body
    const r3 = await req('POST', '/api/admin/gcr/entities', {}, token);
    if (r3.status === 400) ok('Empty body → 400');
    else if (r3.status === 500) fail('Empty body → 500 crash');
    else warn(`Empty body → ${r3.status}`);
  } else {
    warn('Skipping required-field tests — no auth credentials');
  }

  // ── Bad search queries ─────────────────────────────────
  sec('Edge Case Search Queries');
  const edgeCases = [
    { query: '', label: 'Empty string' },
    { query: '   ', label: 'Whitespace only' },
    { query: '<script>alert(1)</script>', label: 'XSS attempt' },
    { query: "' OR 1=1 --", label: 'SQL injection' },
    { query: 'a'.repeat(500), label: '500-char query' },
  ];
  for (const { query, label } of edgeCases) {
    const r = await req('POST', '/api/gcr/search', { query });
    if (r.status === 500) {
      fail(`Search "${label}" → 500 crash`);
    } else if (r.status === 400) {
      ok(`Search "${label}" → 400 (validation correct)`);
    } else if (r.status === 200) {
      ok(`Search "${label}" → 200 (handled gracefully)`);
    } else {
      warn(`Search "${label}" → ${r.status}`);
    }
  }

  // ── Auth protection ────────────────────────────────────
  sec('Auth Protection on Admin Routes');
  const protectedRoutes = [
    '/api/admin/gcr/entities',
    '/api/admin/gcr/businesses',
    '/api/admin/stats',
    '/api/admin/users',
  ];
  for (const path of protectedRoutes) {
    const r = await req('GET', path); // no token
    if (r.status === 401 || r.status === 403) ok(`${path} → ${r.status} (auth protected)`);
    else if (r.status === 200) fail(`${path} → 200 with no auth (exposed!)`);
    else warn(`${path} → ${r.status} (expected 401)`);
  }

  // Summary
  console.log(`\n${B}${'═'.repeat(56)}${X}`);
  console.log(`${B}404 & Error Handling: ${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(R+'Fatal: '+X+e.message); process.exit(1); });
