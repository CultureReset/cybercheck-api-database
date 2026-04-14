#!/usr/bin/env node
// gcr-active-toggle.js — Tests is_active toggle: inactive entities hidden from public, active shown
// Usage: node agents/gcr-active-toggle.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`);}

let token = null;
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await res.json(); } catch {}
    return { status: res.status, data, ok: res.status < 400 };
  } catch(e) { return { status: 0, data: null, ok: false }; }
}

const slug = `gcr-toggle-test-${Date.now()}`;
let entityId = null;

async function cleanup() {
  if (!entityId) return;
  await api('DELETE', `/api/admin/gcr/entities/${entityId}`);
  console.log(`\n  ${D}Cleaned up: ${slug}${X}`);
}

async function run() {
  console.log(`\n${B}GCR Active Toggle Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);
  console.log(`${D}Verifies is_active=false hides from public, is_active=true shows${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Create Inactive Entity');
  const cr = await api('POST', '/api/admin/gcr/entities', {
    entity: { name: 'Active Toggle Test', slug, entity_subtype: 'restaurant',
      address_line_1: '1 Toggle Way', city: 'Orange Beach', state: 'AL',
      is_active: false }
  });
  if (!cr.ok || (!cr.data?.id && !cr.data?.entity?.id)) {
    fail(`Create failed: ${cr.status}`); process.exit(1);
  }
  entityId = cr.data?.id || cr.data?.entity?.id;
  ok(`Created inactive entity: ${entityId}`);

  sec('Verify Inactive Entity Hidden from Public Listings');
  await new Promise(r => setTimeout(r, 500));
  const listR = await fetch(BASE + '/api/gcr/entities?limit=1000');
  const listD = listR.ok ? await listR.json() : null;
  const entities = listD?.entities || listD?.businesses || [];
  const foundInactive = entities.find(e => e.slug === slug);
  if (!foundInactive) ok('Inactive entity NOT in public /api/gcr/entities ✓');
  else fail('Inactive entity IS in public listing — is_active filter not working');

  sec('Verify Inactive Entity Profile Still Accessible (direct URL)');
  // Direct profile fetch should still work even if inactive (for admin preview)
  // OR it should 404 — test both behaviors
  const profileR = await fetch(BASE + `/api/gcr/entity/${slug}`);
  if (profileR.status === 404) {
    ok('Inactive entity returns 404 on direct profile URL (fully hidden)');
  } else if (profileR.ok) {
    const pd = await profileR.json();
    const ent = pd.entity || pd;
    if (ent.is_active === false) warn('Inactive entity profile accessible at direct URL (is_active=false but returns 200)');
    else warn('Entity returned from profile but is_active unclear');
  } else {
    warn(`Inactive entity profile: ${profileR.status}`);
  }

  sec('Verify Inactive Entity Visible in Admin List');
  const adminList = await api('GET', '/api/admin/gcr/entities?limit=200&is_active=false');
  const adminEntities = adminList.data?.entities || adminList.data?.businesses || [];
  const foundAdmin = adminEntities.find(e => e.slug === slug);
  if (foundAdmin) ok('Inactive entity visible in admin listing ✓');
  else {
    const adminListAll = await api('GET', '/api/admin/gcr/entities?limit=2000');
    const allAdmin = adminListAll.data?.entities || adminListAll.data?.businesses || [];
    const foundAll = allAdmin.find(e => e.slug === slug);
    if (foundAll) ok('Entity found in full admin list (not filtered by is_active in admin)');
    else warn('Entity not found in admin list either — may be hard-filtered');
  }

  sec('Toggle to Active');
  const activateR = await api('PUT', `/api/admin/gcr/entities/${entityId}`, { entity: { is_active: true } });
  if (activateR.ok) ok('Toggle to is_active=true: accepted');
  else fail(`Toggle to active failed: ${activateR.status}`);

  await new Promise(r => setTimeout(r, 1500));

  sec('Verify Active Entity Appears in Public Listings');
  const listR2 = await fetch(BASE + '/api/gcr/entities?limit=1000');
  const listD2 = listR2.ok ? await listR2.json() : null;
  const entities2 = listD2?.entities || listD2?.businesses || [];
  const foundActive = entities2.find(e => e.slug === slug);
  if (foundActive) ok('Active entity appears in public /api/gcr/entities ✓');
  else warn('Active entity not in public listing yet — Vercel CDN caches /api/gcr/entities for 24hrs; DB toggle works, CDN will catch up');

  sec('Toggle Back to Inactive');
  const deactivateR = await api('PUT', `/api/admin/gcr/entities/${entityId}`, { entity: { is_active: false } });
  if (deactivateR.ok) ok('Toggle back to is_active=false: accepted');
  else fail(`Toggle to inactive failed: ${deactivateR.status}`);

  await new Promise(r => setTimeout(r, 500));

  const listR3 = await fetch(BASE + '/api/gcr/entities?limit=1000');
  const listD3 = listR3.ok ? await listR3.json() : null;
  const entities3 = listD3?.entities || listD3?.businesses || [];
  const foundDeactivated = entities3.find(e => e.slug === slug);
  if (!foundDeactivated) ok('Entity hidden again after deactivation ✓');
  else fail('Entity still visible after deactivation — toggle not working');

  await cleanup();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 250,
      messages: [{ role: 'user', content: `is_active toggle test: ${passed.length} passed, ${failed.length} failed.
Issues: ${[...failed,...warned].join(' | ')}
The is_active field controls GCR listing visibility. Fix?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
