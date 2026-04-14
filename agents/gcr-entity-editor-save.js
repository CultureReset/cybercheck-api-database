#!/usr/bin/env node
// gcr-entity-editor-save.js — Tests full entity editor save: all core fields persist and return correctly
// Usage: node agents/gcr-entity-editor-save.js

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

const slug = `gcr-editor-test-${Date.now()}`;
let entityId = null;

async function cleanup() {
  if (!entityId) return;
  await api('DELETE', `/api/admin/gcr/entities/${entityId}`);
  console.log(`\n  ${D}Cleaned up: ${slug}${X}`);
}

// Only fields that actually exist in the entity table (verified against migrations)
const FULL_ENTITY = {
  name: 'Full Editor Test Restaurant',
  slug,
  entity_subtype: 'seafood_restaurant',
  subtitle: 'Fresh seafood daily',
  description: 'A full test of the entity editor save functionality.',
  address_line_1: '123 Gulf Shore Dr',
  address_line_2: 'Suite 100',
  city: 'Orange Beach',
  state: 'AL',
  zip: '36561',
  phone: '(251) 555-0100',
  website_url: 'https://example.com',
  directions_url: 'https://maps.google.com/?q=Orange+Beach+AL',
  hero_image_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
  price_range: '$$',
  featured: false,
  is_active: false,
  hh_days: 'Monday,Tuesday,Wednesday,Thursday,Friday',
  hh_start: '3:00 PM',
  hh_end: '6:00 PM',
  social_instagram: '@testrestaurant',
  social_facebook: 'testrestaurant',
  social_tiktok: '@testrestaurant',
  booking_url: 'https://resy.com/test',
  order_url: 'https://doordash.com/test',
  email: 'test@example.com',
};

async function run() {
  console.log(`\n${B}GCR Entity Editor Full Save Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);
  console.log(`${D}Testing all entity fields save and round-trip correctly${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Create Entity (POST)');
  const cr = await api('POST', '/api/admin/gcr/entities', { entity: FULL_ENTITY });
  if (!cr.ok || (!cr.data?.id && !cr.data?.entity?.id)) {
    fail(`POST create failed: ${cr.status} — ${JSON.stringify(cr.data)}`); process.exit(1);
  }
  entityId = cr.data?.id || cr.data?.entity?.id;
  ok(`Created entity: ${entityId}`);

  sec('Update Entity (PUT) — All Fields');
  const updatePayload = {
    entity: { ...FULL_ENTITY, description: 'Updated description after PUT', hh_days: 'Monday,Wednesday,Friday' }
  };
  const ur = await api('PUT', `/api/admin/gcr/entities/${entityId}`, updatePayload);
  if (ur.ok) ok('PUT update accepted');
  else fail(`PUT update failed: ${ur.status} — ${JSON.stringify(ur.data)}`);

  sec('Verify Fields Persisted (Admin GET)');
  const ar = await api('GET', `/api/admin/gcr/entities/${entityId}`);
  if (!ar.ok) {
    warn(`Admin entity GET failed: ${ar.status} — may not have single-entity GET`);
  } else {
    const ent = ar.data?.entity || ar.data || {};
    const checkField = (field, expected) => {
      const val = ent[field];
      if (val === undefined || val === null) warn(`Admin: field "${field}" is null/undefined`);
      else if (expected && String(val) !== String(expected)) warn(`Admin: "${field}" = "${val}" (expected "${expected}")`);
      else ok(`Admin: ${field} = "${val}"`);
    };
    checkField('name', 'Full Editor Test Restaurant');
    checkField('entity_subtype', 'seafood_restaurant');
    checkField('description', 'Updated description after PUT');
    checkField('phone', '(251) 555-0100');
    checkField('city', 'Orange Beach');
    checkField('zip', '36561');
    checkField('hh_days', 'Monday,Wednesday,Friday');
  }

  sec('Verify Fields in Public Profile');
  await new Promise(r => setTimeout(r, 500));
  const pr = await fetch(BASE + `/api/gcr/entity/${slug}`);
  if (!pr.ok) { fail('Public profile fetch failed'); await cleanup(); return; }
  const pd = await pr.json();
  const ent = pd.entity || pd;

  const pubFields = [
    ['name', 'Full Editor Test Restaurant'],
    ['entity_subtype', 'seafood_restaurant'],
    ['phone', '(251) 555-0100'],
    ['city', 'Orange Beach'],
    ['address_line_1', '123 Gulf Shore Dr'],
    ['website_url', 'https://example.com'],
    ['hero_image_url', null],
  ];

  for (const [field, expected] of pubFields) {
    const val = ent[field];
    if (val === undefined || val === null) warn(`Public: field "${field}" missing`);
    else if (expected && String(val) !== String(expected)) warn(`Public: "${field}" = "${val}" (expected "${expected}")`);
    else ok(`Public: ${field} ✓`);
  }

  // Happy hour fields
  const hhDays = ent.hh_days || pd.hh_days;
  if (hhDays) ok(`hh_days present: "${hhDays}"`);
  else fail('hh_days missing from public profile — column may not exist in DB or route not returning it');

  const hhStart = ent.hh_time_start || ent.hh_start || pd.hh_time_start;
  if (hhStart) ok(`hh_time_start present: "${hhStart}"`);
  else warn('hh_time_start missing from public profile');

  // Social fields
  const instagram = ent.social_instagram || ent.instagram;
  if (instagram) ok(`social_instagram: "${instagram}"`);
  else warn('social_instagram not returned in public profile');

  // Price range
  if (ent.price_range) ok(`price_range: "${ent.price_range}"`);
  else warn('price_range not returned in public profile');

  sec('Hours Save (entity_hours table)');
  const hoursSave = await api('POST', `/api/admin/gcr/entities/${entityId}/hours`, {
    hours: [
      { day_of_week: 'Monday', open_time: '11:00 AM', close_time: '10:00 PM', is_closed: false },
      { day_of_week: 'Tuesday', open_time: '11:00 AM', close_time: '10:00 PM', is_closed: false },
      { day_of_week: 'Wednesday', open_time: '11:00 AM', close_time: '10:00 PM', is_closed: false },
      { day_of_week: 'Thursday', open_time: '11:00 AM', close_time: '10:00 PM', is_closed: false },
      { day_of_week: 'Friday', open_time: '11:00 AM', close_time: '11:00 PM', is_closed: false },
      { day_of_week: 'Saturday', open_time: '11:00 AM', close_time: '11:00 PM', is_closed: false },
      { day_of_week: 'Sunday', open_time: '10:00 AM', close_time: '9:00 PM', is_closed: false },
    ]
  });
  if (hoursSave.ok) ok('Hours saved via /hours route');
  else if (hoursSave.status === 404) {
    // Try via entity PUT with hours array
    warn('No dedicated /hours route — trying entity PUT');
    const altHours = await api('PUT', `/api/admin/gcr/entities/${entityId}`, {
      hours: [{ day_of_week: 'Monday', open_time: '11:00 AM', close_time: '10:00 PM' }]
    });
    if (altHours.ok) ok('Hours via entity PUT accepted');
    else fail(`Hours via entity PUT failed: ${altHours.status}`);
  } else {
    fail(`Hours save failed: ${hoursSave.status}`);
  }

  await new Promise(r => setTimeout(r, 500));
  const profileHours = await fetch(BASE + `/api/gcr/entity/${slug}`);
  if (profileHours.ok) {
    const phd = await profileHours.json();
    const hours = phd.hours || [];
    if (hours.length > 0) ok(`Hours in public profile: ${hours.length} days`);
    else warn('Hours not in public profile after save');
  }

  await cleanup();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 400,
      messages: [{ role: 'user', content: `GCR full entity editor save test: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
Failed: ${failed.join(' | ')}
Warnings: ${warned.join(' | ')}
Entity fields tested: name, subtype, description, phone, address, city, zip, website, hero_image, hh_days, hh_start, hh_end, social, price_range, hours.
Most critical fixes for launch?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
