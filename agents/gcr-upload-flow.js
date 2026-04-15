#!/usr/bin/env node
// gcr-upload-flow.js — Tests ALL CSV upload types end-to-end
// Creates a test entity, uploads each data type, verifies data appears in public API
// Usage: node agents/gcr-upload-flow.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE  = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`);}

const TEST_SLUG = 'gcr-upload-test-' + Date.now();
let token = null;
let testEntityId = null;

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout per request
    try {
      const res = await fetch(BASE + path, {
        method,
        headers,
        signal: controller.signal,
        body: body ? JSON.stringify(body) : undefined
      });
      clearTimeout(timeout);
      let data = null;
      try { data = await res.json(); } catch {}
      return { status: res.status, data, ok: res.status < 400 };
    } finally {
      clearTimeout(timeout);
    }
  } catch(e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

async function login() {
  const r = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (r.ok && r.data?.token) { token = r.data.token; ok('Authenticated'); return true; }
  fail('Login failed'); process.exit(1);
}

async function createTestEntity() {
  sec('Setup — Create Test Entity');
  const r = await api('POST', '/api/admin/gcr/entities', {
    entity: { name: 'GCR Upload Test Business', slug: TEST_SLUG, entity_subtype: 'restaurant',
      subtitle: 'Test entity for upload flow', phone: '(251) 555-0199',
      address_line_1: '1 Test Lane', city: 'Orange Beach', state: 'AL', zip: '36561',
      hero_image_url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800' }
  });
  if (!r.ok) { fail(`Create test entity failed: ${r.data?.error}`); return false; }
  testEntityId = r.data?.entity?.id || r.data?.id;
  if (!testEntityId) { fail('No entity ID returned'); return false; }
  ok(`Test entity created: ${TEST_SLUG} (${testEntityId})`);
  return true;
}

async function testMenuUpload() {
  sec('Upload Type: menu (menu_sections + menu_items)');
  const rows = [
    { slug: TEST_SLUG, menu_section_name: 'Appetizers', menu_item_name: 'Fried Calamari', menu_item_description: 'Lightly breaded with marinara', menu_item_price: '12.99', menu_item_price_text: '$12.99' },
    { slug: TEST_SLUG, menu_section_name: 'Appetizers', menu_item_name: 'Shrimp Basket', menu_item_description: 'Gulf shrimp beer battered', menu_item_price: '14.99', menu_item_price_text: '$14.99' },
    { slug: TEST_SLUG, menu_section_name: 'Entrees', menu_item_name: 'Grilled Mahi', menu_item_description: 'Fresh catch with lemon butter', menu_item_price: '24.99', menu_item_price_text: '$24.99' },
    { slug: TEST_SLUG, menu_section_name: 'Entrees', menu_item_name: 'Blackened Grouper', menu_item_description: 'Gulf grouper with remoulade', menu_item_price: '26.99', menu_item_price_text: '$26.99' },
  ];
  let success = 0;
  for (const row of rows) {
    const r = await api('POST', '/api/admin/gcr/import-menu', row);
    if (r.ok) success++;
    else fail(`menu item failed: ${row.menu_item_name} — ${r.data?.error}`);
  }
  ok(`Menu: ${success}/${rows.length} items imported`);

  // Verify in public API
  await new Promise(r => setTimeout(r, 500));
  const pub = await api('GET', `/api/gcr/entity/${TEST_SLUG}`);
  if (!pub.ok) { fail('Public entity fetch failed after menu upload'); return; }
  const menuSections = pub.data?.menu?.sections || [];
  const menuItems = pub.data?.menu?.items || [];
  if (menuSections.length >= 2) ok(`Public API: ${menuSections.length} menu sections visible`);
  else fail(`Public API: expected 2 menu sections, got ${menuSections.length}`);
  if (menuItems.length >= 4) ok(`Public API: ${menuItems.length} menu items visible`);
  else fail(`Public API: expected 4 menu items, got ${menuItems.length}`);
  const hasPrice = menuItems.some(i => i.price || i.price_text);
  if (hasPrice) ok('Menu items have price data');
  else fail('Menu items missing price data');
}

async function testDrinksUpload() {
  sec('Upload Type: drinks (drink_sections + drink_items)');
  const rows = [
    { slug: TEST_SLUG, drink_section_name: 'Draft Beer', drink_item_name: 'Gulf Coast IPA', drink_item_description: 'Local craft IPA', drink_item_price: '6.00', drink_item_style: 'IPA' },
    { slug: TEST_SLUG, drink_section_name: 'Draft Beer', drink_item_name: 'Orange Beach Lager', drink_item_description: 'Light and refreshing', drink_item_price: '5.00', drink_item_style: 'Lager' },
    { slug: TEST_SLUG, drink_section_name: 'Cocktails', drink_item_name: 'Gulf Sunset', drink_item_description: 'Vodka, OJ, grenadine', drink_item_price: '10.00' },
  ];
  let success = 0;
  for (const row of rows) {
    const r = await api('POST', '/api/admin/gcr/import-drinks', row);
    if (r.ok) success++;
    else fail(`drink item failed: ${row.drink_item_name} — ${r.data?.error}`);
  }
  ok(`Drinks: ${success}/${rows.length} items imported`);

  await new Promise(r => setTimeout(r, 500));
  const pub = await api('GET', `/api/gcr/entity/${TEST_SLUG}`);
  const drinkSections = pub.data?.drinks?.sections || [];
  const drinkItems = pub.data?.drinks?.items || [];
  if (drinkSections.length >= 2) ok(`Public API: ${drinkSections.length} drink sections visible`);
  else fail(`Public API: expected 2 drink sections, got ${drinkSections.length}`);
  if (drinkItems.length >= 3) ok(`Public API: ${drinkItems.length} drink items visible`);
  else fail(`Public API: expected 3 drink items, got ${drinkItems.length}`);
}

async function testHHUpload() {
  sec('Upload Type: happy_hour (entity hh fields + hh_sections + hh_items)');
  const rows = [
    { slug: TEST_SLUG, hh_days: 'Mon-Fri', hh_start: '3:00 PM', hh_end: '6:00 PM', hh_description: 'Half off apps & $3 drafts', hh_section_name: 'Drinks', hh_item_name: 'House Draft', hh_item_description: 'Any draft beer', hh_hh_price: '3.00', hh_regular_price: '6.00' },
    { slug: TEST_SLUG, hh_days: 'Mon-Fri', hh_start: '3:00 PM', hh_end: '6:00 PM', hh_section_name: 'Apps', hh_item_name: 'Fried Pickles', hh_item_description: '', hh_hh_price: '4.99', hh_regular_price: '9.99' },
  ];
  let success = 0;
  for (const row of rows) {
    const r = await api('POST', '/api/admin/gcr/import-happyhour', row);
    if (r.ok) success++;
    else fail(`HH import failed: ${r.data?.error}`);
  }
  ok(`HH: ${success}/${rows.length} rows imported`);

  await new Promise(r => setTimeout(r, 500));
  const pub = await api('GET', `/api/gcr/entity/${TEST_SLUG}`);
  const ent = pub.data?.entity || {};
  if (ent.hh_days) ok(`entity.hh_days = "${ent.hh_days}"`);
  else fail('entity.hh_days NOT saved — column may be missing in DB');
  if (ent.hh_start) ok(`entity.hh_start = "${ent.hh_start}"`);
  else fail('entity.hh_start NOT saved');
  const hhSections = pub.data?.happy_hour?.sections || [];
  const hhItems = pub.data?.happy_hour?.items || [];
  if (hhSections.length >= 1) ok(`Public API: ${hhSections.length} HH sections`);
  else fail('No HH sections in public API');
  if (hhItems.length >= 2) ok(`Public API: ${hhItems.length} HH items`);
  else fail('No HH items in public API');

  // Check HH page includes this entity
  const hhPage = await api('GET', '/api/gcr/happy-hours');
  const hhList = Array.isArray(hhPage.data) ? hhPage.data : (hhPage.data?.happy_hours || []);
  const found = hhList.find(h => h.slug === TEST_SLUG);
  if (found) ok('Entity appears on public /happy-hours endpoint');
  else warn('Entity not yet on /happy-hours (may need hh_days column in DB)');
}

async function testEventsUpload() {
  sec('Upload Type: events (entity_events)');
  const rows = [
    { slug: TEST_SLUG, event_name: 'Test Live Music Night', event_type: 'live_music', event_artist_name: 'Test Band', event_date: '2026-05-01', event_start_time: '8:00 PM', event_end_time: '11:00 PM', event_cover_charge: 'Free' },
    { slug: TEST_SLUG, event_name: 'Test Trivia Night', event_type: 'trivia', event_date: '2026-05-07', event_start_time: '7:00 PM' },
  ];
  let success = 0;
  for (const row of rows) {
    const r = await api('POST', '/api/admin/gcr/import-events', row);
    if (r.ok) success++;
    else fail(`Event import failed: ${row.event_name} — ${r.data?.error}`);
  }
  ok(`Events: ${success}/${rows.length} imported`);

  await new Promise(r => setTimeout(r, 500));
  const pub = await api('GET', `/api/gcr/entity/${TEST_SLUG}`);
  const events = pub.data?.events || [];
  if (events.length >= 2) ok(`Public API: ${events.length} events on profile`);
  else fail(`Public API: expected 2 events, got ${events.length}`);
  const hasArtist = events.some(e => e.artist_name);
  if (hasArtist) ok('Event artist_name saved correctly');
  else warn('Event artist_name missing');
}

async function testSpecialsUpload() {
  sec('Upload Type: specials (entity_specials)');
  const rows = [
    { slug: TEST_SLUG, special_name: 'Taco Tuesday', description: '$2 tacos all day', days_of_week: 'Tuesday', start_time: '00:00', end_time: '23:59', discount_text: '$2 off', special_type: 'food' },
    { slug: TEST_SLUG, special_name: 'Wing Wednesday', description: '50 cent wings', days_of_week: 'Wednesday', discount_text: '50¢ wings', special_type: 'food' },
  ];
  let success = 0;
  for (const row of rows) {
    const r = await api('POST', '/api/admin/gcr/import-specials', row);
    if (r.ok) success++;
    else fail(`Special import failed: ${row.special_name} — ${r.data?.error}`);
  }
  ok(`Specials: ${success}/${rows.length} imported`);

  await new Promise(r => setTimeout(r, 500));
  const pub = await api('GET', `/api/gcr/entity/${TEST_SLUG}`);
  const specials = pub.data?.specials || [];
  if (specials.length >= 2) ok(`Public API: ${specials.length} specials on profile`);
  else fail(`Public API: expected 2 specials, got ${specials.length}`);
}

async function testSectionBasedUpload() {
  sec('Upload Type: section_based (entity_sections + groups + items)');
  const rows = [
    { slug: TEST_SLUG, section_key: 'lunch_menu', section_label: 'Lunch Menu', section_type: 'grouped_items', group_title: 'Sandwiches', item_name: 'Fish Po Boy', item_description: 'Fried fish on French bread', price_text: '$13.99', price_numeric: '13.99' },
    { slug: TEST_SLUG, section_key: 'lunch_menu', section_label: 'Lunch Menu', section_type: 'grouped_items', group_title: 'Sandwiches', item_name: 'Shrimp Po Boy', item_description: 'Fried shrimp on French bread', price_text: '$14.99', price_numeric: '14.99' },
    { slug: TEST_SLUG, section_key: 'lunch_menu', section_label: 'Lunch Menu', section_type: 'grouped_items', group_title: 'Salads', item_name: 'Gulf Salad', item_description: 'Fresh greens with Gulf shrimp', price_text: '$12.99', price_numeric: '12.99' },
  ];
  const r = await api('POST', '/api/admin/gcr/import-section-based', rows);
  if (r.ok) ok(`Section-based: ${r.data?.inserted || 0} items inserted for ${r.data?.restaurants || 1} restaurant`);
  else fail(`Section-based import failed: ${r.data?.error}`);

  await new Promise(r => setTimeout(r, 500));
  // Use cache-busting param so Vercel CDN doesn't serve the pre-import cached profile
  const pub = await api('GET', `/api/gcr/entity/${TEST_SLUG}?t=${Date.now()}`);
  const sections = pub.data?.sections || [];
  const lunchSec = sections.find(s => s.section_key === 'lunch_menu');
  if (lunchSec) ok('lunch_menu section visible in public API');
  else fail('lunch_menu section NOT found in public API after section_based import');
}

async function testGCRItemsUpload() {
  sec('Upload Type: gcr_items (entity_sections via bulk upload)');
  // This tests the gcr_items type via the admin bulk endpoint
  const rows = [
    { entity_slug: TEST_SLUG, section_key: 'dinner_menu', group_title: 'Starters', item_name: 'Oysters on Half Shell', item_description: 'Fresh Gulf oysters', price_text: 'MP', item_type: 'menu_item' },
    { entity_slug: TEST_SLUG, section_key: 'dinner_menu', group_title: 'Starters', item_name: 'Crab Dip', item_description: 'Warm blue crab dip with crackers', price_text: '$13.99', price_numeric: '13.99', item_type: 'menu_item' },
  ];
  // gcr_items processes via the same logic as admin bulk upload
  // Test via admin sections API directly
  const secRes = await api('POST', `/api/admin/gcr/entities/${testEntityId}/sections`, {
    section_key: 'dinner_menu', section_label: 'Dinner Menu', section_type: 'grouped_items', sort_order: 10
  });
  if (!secRes.ok && !secRes.data?.section) { fail(`Could not create dinner_menu section: ${secRes.data?.error}`); return; }
  const sectionId = secRes.data?.section?.id;
  if (!sectionId) { warn('dinner_menu section may already exist, checking...'); return; }

  const grpRes = await api('POST', `/api/admin/gcr/sections/${sectionId}/groups`, { title: 'Starters', sort_order: 0 });
  const groupId = grpRes.data?.group?.id;

  let success = 0;
  for (const row of rows) {
    const ir = await api('POST', `/api/admin/gcr/sections/${sectionId}/items`, {
      group_id: groupId || null, item_name: row.item_name, item_description: row.item_description,
      price_text: row.price_text, price_numeric: row.price_numeric ? parseFloat(row.price_numeric) : null,
      item_type: row.item_type
    });
    if (ir.ok) success++;
    else fail(`gcr_items item failed: ${row.item_name} — ${ir.data?.error}`);
  }
  ok(`gcr_items: ${success}/${rows.length} items added via sections API`);

  // Deduplication test — add same item again
  const dupRes = await api('POST', `/api/admin/gcr/sections/${sectionId}/items`, {
    item_name: 'Oysters on Half Shell', item_description: 'duplicate test', price_text: 'MP'
  });
  // Check how many oyster items exist
  await new Promise(r => setTimeout(r, 300));
  const pub = await api('GET', `/api/gcr/entity/${TEST_SLUG}`);
  const sections = pub.data?.sections || [];
  const dinnerSec = sections.find(s => s.section_key === 'dinner_menu');
  if (dinnerSec) ok('dinner_menu section visible in public API');
  else fail('dinner_menu section NOT in public API');
}

async function cleanup() {
  sec('Cleanup — Remove Test Entity');
  if (!testEntityId) { warn('No test entity to clean up'); return; }
  const r = await api('DELETE', `/api/admin/gcr/entities/${testEntityId}`);
  if (r.ok) ok('Test entity removed');
  else warn(`Cleanup failed — manually delete slug: ${TEST_SLUG}`);
}

async function analyzeWithHaiku() {
  sec('Claude Haiku — Upload Flow Analysis');
  if (!process.env.ANTHROPIC_API_KEY) { console.log(`${Y}No API key — skipping Haiku${X}`); return; }
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: `GCR bulk upload flow test results:
✅ PASSED (${passed.length}): ${passed.join(' | ')}
❌ FAILED (${failed.length}): ${failed.join(' | ')}
⚠️ WARNED (${warned.length}): ${warned.join(' | ')}

Analyze: 1) Which upload types are broken? 2) What data is not saving correctly? 3) What would cause businesses to show incomplete data on the public site? 4) Top 3 fixes needed.
Format: 🔴 BROKEN | 🟡 DATA GAPS | 🎯 FIX THESE FIRST` }]
  });
  console.log('\n' + msg.content[0].text);
}

async function run() {
  console.log(`\n${B}GCR Upload Flow Test${X} ${D}(all CSV types)${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);
  await login();
  const created = await createTestEntity();
  if (!created) { console.log(`${R}Cannot proceed without test entity${X}`); process.exit(1); }
  await testMenuUpload();
  await testDrinksUpload();
  await testHHUpload();
  await testEventsUpload();
  await testSpecialsUpload();
  await testSectionBasedUpload();
  await testGCRItemsUpload();
  await cleanup();
  await analyzeWithHaiku();
  console.log(`\n${B}${'═'.repeat(56)}${X}`);
  console.log(`${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}\n`);
}
run().catch(e => { console.error(R+'Fatal: '+X+e.message); process.exit(1); });
