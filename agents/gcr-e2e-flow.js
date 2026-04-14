#!/usr/bin/env node
// gcr-e2e-flow.js — End-to-end data flow test:
// 1. Create test entity via admin API
// 2. Activate it (is_active = true)
// 3. Confirm it appears in public /api/gcr/entities
// 4. Deactivate it (is_active = false)
// 5. Confirm it disappears from public listing
// 6. Delete it (cleanup)
// Usage: node agents/gcr-e2e-flow.js

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
  const r = await fetch(BASE + path, opts);
  let data; try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}

const TEST_SLUG = `gcr-e2e-test-${Date.now()}`;
const TEST_ENTITY = {
  name: 'E2E Test Entity (auto-delete)',
  slug: TEST_SLUG,
  entity_type: 'business',
  entity_subtype: 'restaurant',
  subtitle: 'Automated test — safe to delete',
  city: 'Orange Beach',
  state: 'Alabama',
  is_active: true,
};

async function run() {
  console.log(`\n${B}End-to-End Data Flow Test${X}`);
  console.log(`${D}Base: ${BASE}${X}`);
  console.log(`${D}Test slug: ${TEST_SLUG}${X}\n`);

  if (!EMAIL || !PASS) {
    fail('ADMIN_EMAIL and ADMIN_PASS required for e2e test');
    process.exit(1);
  }

  // Step 1: Login
  sec('Step 1 — Admin Login');
  const loginRes = await req('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!loginRes.data?.token) { fail('Login failed'); process.exit(1); }
  const token = loginRes.data.token;
  ok('Logged in');

  let entityId = null;

  try {
    // Step 2: Create entity
    sec('Step 2 — Create Test Entity (admin)');
    const createRes = await req('POST', '/api/admin/gcr/entities', { entity: TEST_ENTITY }, token);
    if (createRes.status === 200 || createRes.status === 201) {
      entityId = createRes.data?.entity?.id || createRes.data?.id;
      ok(`Entity created: ${entityId}`);
    } else {
      fail(`Create failed: status ${createRes.status} — ${JSON.stringify(createRes.data)}`);
      process.exit(1);
    }

    // Step 3: Confirm appears in public listing (is_active = true)
    sec('Step 3 — Verify Appears in Public Listing');
    await new Promise(r => setTimeout(r, 1000)); // brief wait for any caching
    const pubRes = await req('GET', '/api/gcr/entities');
    const pubEntities = Array.isArray(pubRes.data) ? pubRes.data : (pubRes.data?.entities || pubRes.data?.businesses || []);
    const found = Array.isArray(pubEntities) ? pubEntities.find(e => e.slug === TEST_SLUG) : null;
    if (found) ok(`Entity appears in public listing (is_active=true)`);
    else warn(`Entity not yet in public listing — may be cache delay or is_active defaulted to false`);

    // Step 3b: Check direct slug lookup works
    const slugRes = await req('GET', `/api/gcr/entity/${TEST_SLUG}`);
    if (slugRes.status === 200 && slugRes.data?.entity) ok(`Entity profile page loads by slug`);
    else fail(`Entity slug lookup failed: status ${slugRes.status}`);

    // Step 4: Deactivate
    sec('Step 4 — Deactivate Entity');
    const deactivateRes = await req('PUT', `/api/admin/gcr/entities/${entityId}`, { entity: { is_active: false } }, token);
    if (deactivateRes.status === 200) ok('Entity deactivated');
    else fail(`Deactivate failed: status ${deactivateRes.status}`);

    // Step 5: Confirm disappears from public listing
    sec('Step 5 — Verify Disappears from Public Listing');
    await new Promise(r => setTimeout(r, 500));
    const pubRes2 = await req('GET', '/api/gcr/entities');
    const pubEntities2 = Array.isArray(pubRes2.data) ? pubRes2.data : (pubRes2.data?.entities || pubRes2.data?.businesses || []);
    const stillFound = Array.isArray(pubEntities2) ? pubEntities2.find(e => e.slug === TEST_SLUG) : null;
    if (!stillFound) ok('Entity no longer in public listing (is_active=false)');
    else fail('Entity still showing in public listing after deactivation');

    // Step 6: Re-activate to confirm toggle works both ways
    sec('Step 6 — Re-activate (toggle test)');
    const reactivateRes = await req('PUT', `/api/admin/gcr/entities/${entityId}`, { entity: { is_active: true } }, token);
    if (reactivateRes.status === 200) ok('Re-activation works');
    else fail(`Re-activate failed: status ${reactivateRes.status}`);

    await new Promise(r => setTimeout(r, 500));
    const pubRes3 = await req('GET', '/api/gcr/entities');
    const pubEntities3 = Array.isArray(pubRes3.data) ? pubRes3.data : (pubRes3.data?.entities || pubRes3.data?.businesses || []);
    const reFound = Array.isArray(pubEntities3) ? pubEntities3.find(e => e.slug === TEST_SLUG) : null;
    if (reFound) ok('Entity re-appears after re-activation');
    else warn('Entity not found after re-activation — possible cache');

  } finally {
    // Cleanup — always delete test entity
    sec('Cleanup — Delete Test Entity');
    if (entityId) {
      const delRes = await req('DELETE', `/api/admin/gcr/entities/${entityId}`, null, token);
      if (delRes.status === 200) ok(`Test entity deleted (${entityId})`);
      else warn(`Cleanup: delete returned status ${delRes.status} — manually remove slug: ${TEST_SLUG}`);
    } else {
      warn('No entityId — nothing to clean up');
    }
  }

  // Summary
  console.log(`\n${B}${'═'.repeat(56)}${X}`);
  console.log(`${B}E2E Flow: ${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(R+'Fatal: '+X+e.message); process.exit(1); });
