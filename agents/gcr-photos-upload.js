#!/usr/bin/env node
// gcr-photos-upload.js — Tests photo URL save to entity_photos and verifies gallery in public API
// Usage: node agents/gcr-photos-upload.js

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

// Test photo URLs (real CDN, known good)
const TEST_PHOTOS = [
  { photo_url: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800', caption: 'Restaurant Interior', sort_order: 1 },
  { photo_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800', caption: 'Food Plating', sort_order: 2 },
  { photo_url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800', caption: 'Signature Dish', sort_order: 3 },
];

const slug = `gcr-photos-test-${Date.now()}`;
let entityId = null;

async function cleanup() {
  if (!entityId) return;
  await api('DELETE', `/api/admin/gcr/entities/${entityId}`);
  console.log(`\n  ${D}Cleaned up: ${slug}${X}`);
}

async function run() {
  console.log(`\n${B}GCR Photos Upload Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Create Test Entity');
  const cr = await api('POST', '/api/admin/gcr/entities', {
    entity: { name: 'Photo Test Venue', slug, entity_subtype: 'restaurant',
      hero_image_url: TEST_PHOTOS[0].photo_url,
      is_active: false }
  });
  if (!cr.ok || (!cr.data?.id && !cr.data?.entity?.id)) {
    fail(`Entity create failed: ${cr.status}`); process.exit(1);
  }
  entityId = cr.data?.id || cr.data?.entity?.id;
  ok(`Created: ${slug} (id: ${entityId})`);

  // Check hero_image_url saved
  sec('Verify Hero Image URL Save');
  const ep = await api('GET', `/api/admin/gcr/entities/${entityId}`);
  if (ep.ok) {
    const ent = ep.data?.entity || ep.data || {};
    if (ent.hero_image_url) ok(`hero_image_url saved: ${ent.hero_image_url.substring(0,60)}...`);
    else warn('hero_image_url not on entity after save');
  } else {
    warn(`Could not fetch entity from admin: ${ep.status}`);
  }

  sec('Save Gallery Photos');
  const photoRows = TEST_PHOTOS.map((p, i) => ({
    slug,
    photo_image_url: p.photo_url,
    photo_caption: p.caption,
    photo_sort_order: i,
    photo_is_cover: i === 0 ? 'true' : 'false',
  }));
  const photosRoute = await api('POST', '/api/admin/gcr/import-photos', photoRows);
  if (photosRoute.ok) ok(`Photos imported: ${JSON.stringify(photosRoute.data)}`);
  else fail(`Photos import failed: ${photosRoute.status} — ${JSON.stringify(photosRoute.data)}`);

  sec('Verify Photos in Public Profile');
  await new Promise(r => setTimeout(r, 500));
  const pr = await fetch(BASE + `/api/gcr/entity/${slug}`);
  if (!pr.ok) { fail('Public profile fetch failed'); await cleanup(); return; }
  const pd = await pr.json();

  const photos = pd.photos || pd.gallery || [];
  ok(`photos/gallery count: ${photos.length}`);

  if (photos.length === 0) {
    fail('No photos in public profile — entity_photos table may need separate route or photos not being joined in gcr.js');
  } else {
    photos.slice(0,3).forEach((p, i) => {
      const url = p.photo_url || p.url || p.image_url || '';
      ok(`Photo ${i+1}: ${url.substring(0,60)}...`);
    });
    // Check captions
    const withCaption = photos.filter(p => p.caption || p.alt);
    if (withCaption.length > 0) ok(`${withCaption.length} photos have captions`);
    else warn('No captions on photos');
  }

  sec('Verify Hero Image in Public Profile');
  const ent = pd.entity || pd;
  if (ent.hero_image_url) ok(`Public entity.hero_image_url present`);
  else fail('hero_image_url missing from public entity profile');

  sec('Photo URL Validation (HEAD check)');
  for (const p of TEST_PHOTOS.slice(0, 2)) {
    try {
      const r = await fetch(p.photo_url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (r.ok) ok(`Photo URL accessible: ${r.status}`);
      else warn(`Photo URL returned: ${r.status}`);
    } catch(e) {
      warn(`Photo URL check failed: ${e.message}`);
    }
  }

  await cleanup();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 250,
      messages: [{ role: 'user', content: `GCR photos upload test: ${passed.length} passed, ${failed.length} failed.
Photos save to entity_photos table and hero_image_url on entity table.
Issues: ${[...failed,...warned].join(' | ')}
What's missing?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
