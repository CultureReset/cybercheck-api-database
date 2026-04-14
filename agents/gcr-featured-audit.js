#!/usr/bin/env node
// gcr-featured-audit.js — Tests featured entity flag, homepage featured slot, and featured API
// Usage: node agents/gcr-featured-audit.js

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

const slug = `gcr-featured-test-${Date.now()}`;
let entityId = null;

async function cleanup() {
  if (!entityId) return;
  await api('DELETE', `/api/admin/gcr/entities/${entityId}`);
  console.log(`\n  ${D}Cleaned up: ${slug}${X}`);
}

async function run() {
  console.log(`\n${B}GCR Featured Entities Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  sec('Check Featured API Endpoint');
  const featuredRoutes = [
    '/api/gcr/featured',
    '/api/gcr/entities?featured=true',
    '/api/gcr/entities?is_featured=true',
  ];

  let featuredRoute = null;
  for (const route of featuredRoutes) {
    const r = await fetch(BASE + route);
    if (r.ok) {
      const d = await r.json();
      const entities = d?.entities || d?.businesses || d?.featured || d || [];
      if (Array.isArray(entities)) {
        featuredRoute = route;
        ok(`Featured endpoint: ${route} — ${entities.length} featured entities`);
        if (entities.length > 0) {
          const e = entities[0];
          ok(`Featured entity example: "${e.name}" (${e.entity_subtype||'no subtype'})`);
        }
        break;
      }
    } else if (r.status === 404) {
      // try next
    } else {
      warn(`${route}: ${r.status}`);
    }
  }

  if (!featuredRoute) {
    fail('No featured entities endpoint found');
    console.log(`  ${D}The homepage "featured" section may pull from all entities or be static${X}`);
  }

  sec('Check Existing Featured Flag on Entities');
  const listR = await fetch(BASE + '/api/gcr/entities?limit=500');
  const listD = listR.ok ? await listR.json() : null;
  const entities = listD?.entities || listD?.businesses || [];

  const withFeatured = entities.filter(e => e.featured === true || e.is_featured === true);
  const withHeroImage = entities.filter(e => !!e.hero_image_url);

  ok(`Total active entities: ${entities.length}`);
  if (withFeatured.length > 0) ok(`${withFeatured.length} entities have featured=true`);
  else warn('No entities have featured=true flag set');

  ok(`${withHeroImage.length}/${entities.length} entities have hero images (needed for featured display)`);

  sec('Authentication + Test Featured Flag Save');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  const cr = await api('POST', '/api/admin/gcr/entities', {
    entity: { name: 'Featured Test Business', slug, entity_subtype: 'restaurant',
      address_line_1: '700 Feature Blvd', city: 'Orange Beach', state: 'AL',
      hero_image_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400',
      is_active: true, featured: true }
  });

  if (!cr.ok || (!cr.data?.id && !cr.data?.entity?.id)) {
    fail(`Create test entity failed: ${cr.status}`); process.exit(1);
  }
  entityId = cr.data?.id || cr.data?.entity?.id;
  ok(`Created test entity with featured=true (id: ${entityId})`);

  await new Promise(r => setTimeout(r, 500));

  sec('Verify Featured in Public API');
  // Check if featured entity appears in /api/gcr/featured or /api/gcr/entities?featured=true
  for (const route of featuredRoutes) {
    const r = await fetch(BASE + route);
    if (!r.ok) continue;
    const d = await r.json();
    const list = d?.entities || d?.businesses || d?.featured || d || [];
    const found = Array.isArray(list) ? list.find(e => e.slug === slug) : null;
    if (found) {
      ok(`Featured entity visible in ${route} ✓`);
      break;
    }
  }

  sec('Verify featured Field in Entity Listing');
  const listR2 = await fetch(BASE + '/api/gcr/entities?limit=1000');
  if (listR2.ok) {
    const d = await listR2.json();
    const list = d?.entities || d?.businesses || [];
    const found = list.find(e => e.slug === slug);
    if (found) {
      if (found.featured === true || found.is_featured === true) ok('featured=true visible in entity listing');
      else warn('Entity found in listing but featured field missing — check if featured is returned in entity list');
    }
  }

  sec('Unfeatured Toggle Test');
  const unfeaturedR = await api('PUT', `/api/admin/gcr/entities/${entityId}`, { featured: false });
  if (unfeaturedR.ok) ok('Toggle featured=false accepted');
  else fail(`Toggle to unfeatured failed: ${unfeaturedR.status}`);

  await cleanup();

  sec('Homepage Featured Section Config');
  const siteConfigs = [
    '/api/gcr/site-config',
    '/api/gcr/config',
    '/api/gcr/homepage',
  ];
  for (const route of siteConfigs) {
    const r = await fetch(BASE + route);
    if (r.ok) {
      const d = await r.json();
      ok(`Site config found at ${route}: ${JSON.stringify(Object.keys(d||{})).substring(0,80)}`);
      break;
    }
  }

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 250,
      messages: [{ role: 'user', content: `GCR featured entities audit: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
Featured route: ${featuredRoute || 'NOT FOUND'}.
${withFeatured.length} current featured entities. ${withHeroImage.length}/${entities.length} have hero images.
Issues: ${[...failed,...warned].join(' | ')}
For launch readiness?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
