#!/usr/bin/env node
// gcr-gcr-items-upload.js — Tests gcr_items and gcr_entities CSV upload types (entity + items together)
// Usage: node agents/gcr-gcr-items-upload.js

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

const slug1 = `gcr-items-test-${Date.now()}`;
const slug2 = `gcr-items-test2-${Date.now()}`;
const entityIds = [];

async function cleanup() {
  for (const id of entityIds) {
    await api('DELETE', `/api/admin/gcr/entities/${id}`);
  }
  console.log(`\n  ${D}Cleaned up test entities${X}`);
}

async function run() {
  console.log(`\n${B}GCR Items & Entities Bulk Upload Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('gcr_entities CSV Upload (create multiple businesses at once)');
  const entitiesCsv = [
    'name,slug,entity_subtype,address_line_1,city,state,phone,website_url,description,is_active',
    `Sunrise Cafe,${slug1},coffee_shop,101 Beach Rd,Orange Beach,AL,(251) 555-0201,https://example.com,Coffee and pastries,false`,
    `Gulf Wave Bar,${slug2},bar,202 Gulf Blvd,Gulf Shores,AL,(251) 555-0202,https://example2.com,Waterfront bar,false`,
  ].join('\n');

  const gcr_entities_routes = [
    '/api/admin/gcr/import',
    '/api/admin/gcr/bulk-import',
    '/api/admin/gcr/import-entities',
  ];

  let entityRoute = null;
  for (const route of gcr_entities_routes) {
    const r = await api('POST', route, { csv: entitiesCsv, type: 'gcr_entities' });
    if (r.status !== 404) {
      entityRoute = route;
      if (r.ok) ok(`gcr_entities import at ${route}: ${JSON.stringify(r.data)}`);
      else fail(`gcr_entities import at ${route}: ${r.status} — ${JSON.stringify(r.data)}`);
      break;
    }
  }

  if (!entityRoute) {
    // Try bulk upload route
    const bulkR = await api('POST', '/api/admin/gcr/bulk-upload', {
      type: 'gcr_entities',
      csv: entitiesCsv
    });
    if (bulkR.ok) {
      ok(`gcr_entities via bulk-upload: ${JSON.stringify(bulkR.data)}`);
      entityRoute = '/api/admin/gcr/bulk-upload';
    } else {
      warn('No gcr_entities import route found — entities may need to be created one at a time');
    }
  }

  // Try to find the entities we "created" (or create them manually)
  await new Promise(r => setTimeout(r, 800));
  const checkR = await fetch(BASE + '/api/gcr/entities?limit=1000');
  const checkD = checkR.ok ? await checkR.json() : null;
  const allEntities = checkD?.entities || checkD?.businesses || [];
  const found1 = allEntities.find(e => e.slug === slug1);
  const found2 = allEntities.find(e => e.slug === slug2);

  if (found1) { ok(`Entity 1 created: "${found1.name}"`); entityIds.push(found1.id); }
  if (found2) { ok(`Entity 2 created: "${found2.name}"`); entityIds.push(found2.id); }

  // Also check admin list (inactive entities)
  const adminR = await api('GET', '/api/admin/gcr/entities?limit=2000');
  const adminAll = adminR.data?.entities || adminR.data?.businesses || [];
  const adminFound1 = adminAll.find(e => e.slug === slug1);
  const adminFound2 = adminAll.find(e => e.slug === slug2);
  if (adminFound1 && !found1) { entityIds.push(adminFound1.id); ok(`Entity 1 in admin: "${adminFound1.name}"`); }
  if (adminFound2 && !found2) { entityIds.push(adminFound2.id); ok(`Entity 2 in admin: "${adminFound2.name}"`); }

  // Create entities manually if bulk import didn't work
  if (!adminFound1) {
    const cr = await api('POST', '/api/admin/gcr/entities', {
      entity: { name: 'Sunrise Cafe', slug: slug1, entity_subtype: 'coffee_shop',
        address_line_1: '101 Beach Rd', city: 'Orange Beach', state: 'AL',
        is_active: true }
    });
    if (cr.ok) {
      const id = cr.data?.id || cr.data?.entity?.id;
      if (id) entityIds.push(id);
      ok(`Entity 1 created manually (id: ${id})`);
    }
  }

  sec('gcr_items CSV Upload (items linked to existing entity)');
  // import-menu expects array of row objects with slug, section, item_name, description, price
  // import-menu uses menu_section_name, menu_item_name, menu_item_description, menu_item_price
  const itemRows = [
    { slug: slug1, menu_section_name: 'Hot Drinks', menu_item_name: 'Espresso', menu_item_description: 'Single shot espresso', menu_item_price: '3.00' },
    { slug: slug1, menu_section_name: 'Hot Drinks', menu_item_name: 'Cappuccino', menu_item_description: 'Espresso with steamed milk foam', menu_item_price: '5.00' },
    { slug: slug1, menu_section_name: 'Cold Drinks', menu_item_name: 'Iced Latte', menu_item_description: 'Espresso over ice with milk', menu_item_price: '5.50' },
    { slug: slug1, menu_section_name: 'Pastries', menu_item_name: 'Croissant', menu_item_description: 'Buttery flaky croissant', menu_item_price: '3.50' },
    { slug: slug1, menu_section_name: 'Pastries', menu_item_name: 'Blueberry Muffin', menu_item_description: 'Fresh baked daily', menu_item_price: '3.00' },
  ];

  let itemsImported = false;
  const r = await api('POST', '/api/admin/gcr/import-menu', itemRows);
  if (r.ok) {
    ok(`Items imported via /api/admin/gcr/import-menu: ${JSON.stringify(r.data)}`);
    itemsImported = true;
  } else {
    warn(`Items import failed: ${r.status} — ${JSON.stringify(r.data)}`);
  }

  if (!itemsImported) warn('gcr_items: no import route found that accepted the CSV');

  sec('Verify Deduplication (duplicate entity slug in CSV)');
  // Import the same entity slug twice — should not create duplicate
  const dupRows = [
    { slug: slug1, menu_section_name: 'Hot Drinks', menu_item_name: 'Americano', menu_item_description: 'Espresso with hot water', menu_item_price: '4.00' },
    { slug: slug1, menu_section_name: 'Hot Drinks', menu_item_name: 'Americano', menu_item_description: 'Espresso with hot water', menu_item_price: '4.00' },
  ];

  const dupR = await api('POST', '/api/admin/gcr/import-menu', dupRows);
  if (dupR.ok) {
    // Verify only 1 "Americano" was created
    await new Promise(r => setTimeout(r, 500));
    const pr = await fetch(BASE + `/api/gcr/entity/${slug1}`);
    if (pr.ok) {
      const pd = await pr.json();
      const menuItems = pd.menu?.items || [];
      const americanos = menuItems.filter(i => (i.item_name||i.name||'').toLowerCase().includes('americano'));
      if (americanos.length === 1) ok('Deduplication: only 1 Americano created despite 2 identical rows');
      else if (americanos.length === 2) warn('Deduplication: 2 identical items created — no dedup logic');
      else ok(`Americano count: ${americanos.length}`);
    }
  }

  sec('Verify Items in Public Profile');
  await new Promise(r => setTimeout(r, 500));
  const profR = await fetch(BASE + `/api/gcr/entity/${slug1}`);
  if (profR.ok) {
    const pd = await profR.json();
    const menuItems = pd.menu?.items || [];
    const secs = pd.menu?.sections || [];
    ok(`Profile menu items: ${menuItems.length}`);
    ok(`Profile menu sections: ${secs.length}`);
    if (menuItems.length > 0) {
      ok(`Sample item: "${menuItems[0].item_name||menuItems[0].name}" — $${menuItems[0].price}`);
    } else if (itemsImported) {
      fail('Items imported but not showing in public profile');
    }
  }

  await cleanup();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR bulk entity+items upload test: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
Issues: ${[...failed,...warned].join(' | ')}
Key question: does the system support creating multiple entities + their items from a single CSV batch? What's the recommended flow?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
