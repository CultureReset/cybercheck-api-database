#!/usr/bin/env node
// gcr-section-based-upload.js — Tests section_based CSV upload → entity_sections → public API tabs
// Usage: node agents/gcr-section-based-upload.js

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

const slug = `gcr-sections-test-${Date.now()}`;
let entityId = null;

async function cleanup() {
  if (!entityId) return;
  await api('DELETE', `/api/admin/gcr/entities/${entityId}`);
  console.log(`\n  ${D}Cleaned up test entity: ${slug}${X}`);
}

async function run() {
  console.log(`\n${B}GCR Section-Based Upload Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Create Test Entity');
  const cr = await api('POST', '/api/admin/gcr/entities', {
    entity: { name: 'Section Test Restaurant', slug, entity_subtype: 'restaurant',
      address_line_1: '300 Section Ave', city: 'Orange Beach', state: 'AL',
      is_active: false }
  });
  if (!cr.ok || (!cr.data?.id && !cr.data?.entity?.id)) {
    fail(`Entity create failed: ${cr.status}`); process.exit(1);
  }
  entityId = cr.data?.id || cr.data?.entity?.id;
  ok(`Created: ${slug} (id: ${entityId})`);

  sec('Section-Based Upload');
  // import-section-based: send entity_slug for exact lookup, plus restaurant_name as fallback label
  const entityName = 'Section Test Restaurant';
  const sectionRows = [
    { entity_slug: slug, restaurant_name: entityName, section_type: 'menu', section: 'Starters', item_name: 'Gulf Shrimp Cocktail', description: 'Chilled gulf shrimp with cocktail sauce', price: '14.00' },
    { entity_slug: slug, restaurant_name: entityName, section_type: 'menu', section: 'Starters', item_name: 'Oysters on the Half Shell', description: 'Fresh local oysters', price: '18.00' },
    { entity_slug: slug, restaurant_name: entityName, section_type: 'menu', section: 'Starters', item_name: 'Crab Dip', description: 'Hot crab dip with chips', price: '12.00' },
    { entity_slug: slug, restaurant_name: entityName, section_type: 'menu', section: 'Entrees', item_name: 'Grilled Red Snapper', description: 'Fresh caught with lemon butter', price: '28.00' },
    { entity_slug: slug, restaurant_name: entityName, section_type: 'menu', section: 'Entrees', item_name: 'Shrimp & Grits', description: 'Gulf shrimp over stone-ground grits', price: '22.00' },
    { entity_slug: slug, restaurant_name: entityName, section_type: 'menu', section: 'Desserts', item_name: 'Key Lime Pie', description: 'Florida-style key lime', price: '8.00' },
    { entity_slug: slug, restaurant_name: entityName, section_type: 'drinks', section: 'Signature Cocktails', item_name: 'The Gulf Wave', description: 'Vodka + blue curacao + pineapple', price: '12.00' },
    { entity_slug: slug, restaurant_name: entityName, section_type: 'drinks', section: 'Signature Cocktails', item_name: 'Sunset Sour', description: 'Whiskey sour with orange', price: '11.00' },
  ];

  const importRes = await api('POST', '/api/admin/gcr/import-section-based', sectionRows);
  if (!importRes.ok) {
    fail(`Section-based import failed: ${importRes.status} — ${JSON.stringify(importRes.data)}`);
  } else {
    ok(`Section-based import accepted: ${JSON.stringify(importRes.data)}`);
  }

  sec('Verify in Public Profile → sections');
  await new Promise(r => setTimeout(r, 800));
  const pr = await fetch(BASE + `/api/gcr/entity/${slug}?t=${Date.now()}`);
  if (!pr.ok) { fail('Public profile fetch failed'); await cleanup(); return; }
  const pd = await pr.json();

  const sections = pd.sections || [];
  ok(`entity_sections count: ${sections.length}`);

  if (sections.length === 0) {
    fail('No sections in public profile — section_based CSV may not have saved to entity_sections');
  } else {
    const sectionNames = sections.map(s => s.section_label || s.section_key || s.title || s.name || '(no name)');
    ok(`Section names: ${sectionNames.join(', ')}`);
    ['Starters','Entrees','Desserts'].forEach(name => {
      if (sectionNames.some(n => n.toLowerCase().includes(name.toLowerCase()))) ok(`Section found: ${name}`);
      else warn(`Section not found in entity_sections: ${name}`);
    });
  }

  sec('Verify Items Structure');
  // Check if items are nested within sections or in a flat items array
  let totalItems = 0;
  for (const section of sections) {
    const sLabel = section.section_label || section.section_key || section.title || '';
    // grouped_items returns groups with nested items; also check ungrouped_items
    const allItems = (section.groups || []).flatMap(g => g.items || []).concat(section.ungrouped_items || section.items || section.section_items || []);
    totalItems += allItems.length;
    if (allItems.length > 0) {
      const item = allItems[0];
      ok(`Section "${sLabel}" has ${allItems.length} items — first: "${item.item_name||item.name}"`);
      if (item.price_numeric !== undefined || item.price_text) ok(`Item has price: ${item.price_numeric || item.price_text}`);
      else warn(`Item "${item.item_name||item.name}" missing price`);
    }
  }

  if (totalItems > 0) ok(`Total items across sections: ${totalItems}`);
  else {
    // Maybe items are in a flat items array on the section object
    const flatItems = sections.flatMap(s => s.items||[]);
    if (flatItems.length > 0) ok(`Items in flat structure: ${flatItems.length}`);
    else fail('No items found in sections — check section_items join in gcr.js route');
  }

  sec('Verify Groups (Seafood / Land sub-groups)');
  const entreeSection = sections.find(s => (s.section_label||s.section_key||s.title||s.name||'').toLowerCase().includes('entree'));
  if (entreeSection) {
    const groups = entreeSection.groups || entreeSection.section_groups || [];
    if (groups.length > 0) ok(`Entrees has ${groups.length} groups`);
    else warn('Entrees section has no groups — group_name may not be saving to section_groups');
  }

  await cleanup();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR section-based CSV upload test. ${passed.length} passed, ${warned.length} warnings, ${failed.length} failed.
This type saves to entity_sections + section_items + section_groups tables (not menu_sections).
Issues: ${[...failed,...warned].join(' | ')}
Root cause and fix?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
