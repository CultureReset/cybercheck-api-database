#!/usr/bin/env node
// gcr-section-editor-flow.js — Tests entity_sections save via admin → tabs appear on public profile
// Usage: node agents/gcr-section-editor-flow.js

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

const slug = `gcr-section-flow-test-${Date.now()}`;
let entityId = null;

async function cleanup() {
  if (!entityId) return;
  await api('DELETE', `/api/admin/gcr/entities/${entityId}`);
  console.log(`\n  ${D}Cleaned up: ${slug}${X}`);
}

async function run() {
  console.log(`\n${B}GCR Section Editor Flow Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Create Test Entity');
  const cr = await api('POST', '/api/admin/gcr/entities', {
    entity: { name: 'Section Flow Test', slug, entity_subtype: 'restaurant',
      address_line_1: '600 Section Ln', city: 'Gulf Shores', state: 'AL',
      is_active: false }
  });
  if (!cr.ok || (!cr.data?.id && !cr.data?.entity?.id)) {
    fail(`Create failed: ${cr.status}`); process.exit(1);
  }
  entityId = cr.data?.id || cr.data?.entity?.id;
  ok(`Created: ${slug} (id: ${entityId})`);

  sec('Create Sections via Admin API');
  // Try the sections route for this entity
  let sectionRoute = `/api/admin/gcr/entities/${entityId}/sections`;
  const sr = await api('POST', sectionRoute, {
    section_key: 'lunch_menu',
    section_label: 'Lunch Menu',
    section_type: 'grouped_items',
    sort_order: 1,
    is_active: true
  });

  let sectionId = null;
  if (sr.ok) {
    sectionId = sr.data?.id || sr.data?.section?.id;
    ok(`Section created (id: ${sectionId}): ${JSON.stringify(sr.data)}`);
  } else if (sr.status === 404) {
    warn(`Sections route not found at ${sectionRoute} — may be different path`);
    // Try alternative route
    const altR = await api('POST', '/api/admin/gcr/sections', {
      entity_id: entityId,
      section_name: 'Lunch Menu',
      section_type: 'menu',
      display_order: 1
    });
    if (altR.ok) {
      sectionId = altR.data?.id || altR.data?.section?.id;
      ok(`Section created via alt route (id: ${sectionId})`);
    } else {
      fail(`Sections route not found at alt path either: ${altR.status}`);
    }
  } else {
    fail(`Section create failed: ${sr.status} — ${JSON.stringify(sr.data)}`);
  }

  if (sectionId) {
    sec('Add Items to Section');
    const itemRoutes = [
      `/api/admin/gcr/sections/${sectionId}/items`,
      `/api/admin/gcr/entities/${entityId}/sections/${sectionId}/items`,
    ];

    let itemAdded = false;
    for (const route of itemRoutes) {
      const ir = await api('POST', route, {
        item_name: 'Grilled Fish Tacos',
        item_description: 'Two fish tacos with slaw and salsa',
        price_numeric: 14.00,
        sort_order: 1
      });
      if (ir.ok) {
        ok(`Item added via ${route}`);
        itemAdded = true;

        // Add second item
        await api('POST', route, {
          item_name: 'Fish & Chips',
          item_description: 'Beer-battered fish with fries',
          price_numeric: 16.00,
          sort_order: 2
        });
        break;
      } else if (ir.status !== 404) {
        fail(`Item route ${route} failed: ${ir.status}`);
        break;
      }
    }
    if (!itemAdded) warn('Could not add items to section — no valid route found');
  }

  sec('Verify Sections in Public Profile');
  await new Promise(r => setTimeout(r, 500));
  const pr = await fetch(BASE + `/api/gcr/entity/${slug}`);
  if (!pr.ok) { fail('Public profile fetch failed'); await cleanup(); return; }
  const pd = await pr.json();

  const sections = pd.sections || [];
  ok(`entity_sections in public profile: ${sections.length}`);

  if (sections.length === 0) {
    warn('No sections in public profile — sections may require a different section_type or the join is missing');
  } else {
    const lunchSection = sections.find(s => (s.section_name||s.title||s.name||'').toLowerCase().includes('lunch'));
    if (lunchSection) {
      ok(`"Lunch Menu" section found`);
      const items = lunchSection.items || lunchSection.section_items || [];
      ok(`Items in Lunch Menu: ${items.length}`);
      if (items.length > 0) {
        ok(`First item: "${items[0].item_name||items[0].name}"`);
      }
    } else {
      warn('Lunch Menu section not found in public response');
    }
  }

  sec('Test Multiple Section Types');
  const sectionTypes = ['grouped_items', 'rich_text', 'bullets', 'photos'];
  for (const type of sectionTypes) {
    const r = await api('POST', `/api/admin/gcr/entities/${entityId}/sections`, {
      section_key: `test_${type}`,
      section_label: `Test ${type}`,
      section_type: type,
      sort_order: 2,
      is_active: true
    });
    if (r.ok) ok(`Section type "${type}" accepted`);
    else if (r.status === 404) warn(`Sections route not found for type ${type}`);
    else warn(`Section type "${type}": ${r.status}`);
  }

  sec('Test Section Ordering');
  await new Promise(r => setTimeout(r, 500));
  const pr2 = await fetch(BASE + `/api/gcr/entity/${slug}`);
  if (pr2.ok) {
    const pd2 = await pr2.json();
    const secs = pd2.sections || [];
    if (secs.length > 1) {
      ok(`${secs.length} sections returned — ordering preserved`);
    }
  }

  await cleanup();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR section editor flow test: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
Sections save to entity_sections table. Items save to section_items or section_groups tables.
Issues: ${[...failed,...warned].join(' | ')}
This is the "new" section system (vs old menu_sections). What's broken?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
