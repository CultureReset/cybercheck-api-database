#!/usr/bin/env node
// gcr-tags-features-upload.js — Tests saving tags, features, perfect_for via CSV and admin API
// Usage: node agents/gcr-tags-features-upload.js

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

const slug = `gcr-tags-test-${Date.now()}`;
let entityId = null;

async function cleanup() {
  if (!entityId) return;
  await api('DELETE', `/api/admin/gcr/entities/${entityId}`);
  console.log(`\n  ${D}Cleaned up: ${slug}${X}`);
}

async function run() {
  console.log(`\n${B}GCR Tags, Features & Perfect-For Upload Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Create Test Entity');
  const cr = await api('POST', '/api/admin/gcr/entities', {
    entity: { name: 'Tags Test Restaurant', slug, entity_subtype: 'seafood_restaurant',
      address_line_1: '500 Tags Blvd', city: 'Orange Beach', state: 'AL',
      is_active: false }
  });
  if (!cr.ok || (!cr.data?.id && !cr.data?.entity?.id)) {
    fail(`Entity create failed: ${cr.status}`); process.exit(1);
  }
  entityId = cr.data?.id || cr.data?.entity?.id;
  ok(`Created: ${slug} (id: ${entityId})`);

  sec('Save Tags via Dedicated Routes');
  const tagsList = ['Seafood', 'Waterfront', 'Happy Hour', 'Live Music', 'Family Friendly'];
  for (const tag of tagsList) {
    const r = await api('POST', `/api/admin/gcr/entities/${entityId}/tags`, { tag, tag_category: 'search' });
    if (r.ok) ok(`Tag added: "${tag}"`);
    else warn(`Tag route failed: ${r.status} — ${JSON.stringify(r.data)}`);
  }

  sec('Save Features via Dedicated Routes');
  const featuresList = ['Waterfront Dining', 'Full Bar', 'Outdoor Seating', 'Takeout Available'];
  for (const [i, label] of featuresList.entries()) {
    const r = await api('POST', `/api/admin/gcr/entities/${entityId}/features`, { label, sort_order: i });
    if (r.ok) ok(`Feature added: "${label}"`);
    else warn(`Feature route failed: ${r.status} — ${JSON.stringify(r.data)}`);
  }

  sec('Save Perfect-For via Dedicated Routes');
  const pfList = ['Date Night', 'Family Dinner', 'Happy Hour', 'Sunset Views'];
  for (const [i, label] of pfList.entries()) {
    const r = await api('POST', `/api/admin/gcr/entities/${entityId}/perfect-for`, { label, sort_order: i });
    if (r.ok) ok(`Perfect-for added: "${label}"`);
    else warn(`Perfect-for route failed: ${r.status} — ${JSON.stringify(r.data)}`);
  }

  sec('Verify Tags/Features/Perfect-For in Public Profile');
  await new Promise(r => setTimeout(r, 500));
  const pr = await fetch(BASE + `/api/gcr/entity/${slug}`);
  if (!pr.ok) { fail('Public profile fetch failed'); await cleanup(); return; }
  const pd = await pr.json();

  const tags = pd.tags || [];
  const features = pd.features || [];
  const perfectFor = pd.perfect_for || [];

  ok(`tags: ${JSON.stringify(tags)}`);
  ok(`features: ${JSON.stringify(features)}`);
  ok(`perfect_for: ${JSON.stringify(perfectFor)}`);

  if (tags.length > 0) ok(`${tags.length} tags returned`);
  else fail('No tags in public profile — check entity_tags table save');

  if (features.length > 0) ok(`${features.length} features returned`);
  else fail('No features in public profile — check entity_features table save');

  if (perfectFor.length > 0) ok(`${perfectFor.length} perfect_for items returned`);
  else fail('No perfect_for in public profile — check entity_perfect_for table save');

  sec('Verify Tag Content');
  const expectedTags = ['Seafood', 'Waterfront', 'Happy Hour'];
  const tagValues = Array.isArray(tags) ? tags.map(t => (t.tag || t.tag_name || t.name || (typeof t === 'string' ? t : '') || '').toLowerCase()) : [];
  for (const t of expectedTags) {
    if (tagValues.some(v => v.includes(t.toLowerCase()))) ok(`Tag found: "${t}"`);
    else warn(`Tag not found: "${t}" — check save format`);
  }

  sec('Tags in Listing Card (entities list)');
  // Tags should appear on entity listing data
  const listR = await api('GET', `/api/gcr/entities?limit=10`);
  const listEntities = listR.data?.entities || [];
  const testEntity = listEntities.find(e => e.slug === slug);
  if (testEntity) {
    const entityTags = testEntity.tags || [];
    if (entityTags.length > 0) ok(`Tags on listing card: ${entityTags.length} tags`);
    else warn('Tags not on entity listing data (may only be on full profile)');
  } else {
    warn('Test entity not in listings (is_active: false — expected)');
  }

  await cleanup();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `Tags/features/perfect_for test: ${passed.length} passed, ${failed.length} failed.
These save to entity_tags, entity_features, entity_perfect_for tables.
Issues: ${[...failed,...warned].join(' | ')}
The entity PUT route does a raw spread — does it also handle junction table saves?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
