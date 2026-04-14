#!/usr/bin/env node
// gcr-drinks-upload-flow.js — Tests drinks CSV upload end-to-end (sections + items → public API)
// Usage: node agents/gcr-drinks-upload-flow.js

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

const slug = `gcr-drinks-test-${Date.now()}`;
let entityId = null;

async function cleanup() {
  if (!entityId) return;
  await api('DELETE', `/api/admin/gcr/entities/${entityId}`);
  console.log(`\n  ${D}Cleaned up test entity: ${slug}${X}`);
}

async function run() {
  console.log(`\n${B}GCR Drinks Upload Flow Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  // Auth
  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  // Create test entity
  sec('Create Test Entity');
  const cr = await api('POST', '/api/admin/gcr/entities', {
    entity: { name: 'Drinks Upload Test', slug, entity_subtype: 'bar',
      address_line_1: '100 Test Blvd', city: 'Orange Beach', state: 'AL',
      is_active: false }
  });
  if (!cr.ok || (!cr.data?.id && !cr.data?.entity?.id)) {
    fail(`Entity create failed: ${cr.status} — ${JSON.stringify(cr.data)}`);
    process.exit(1);
  }
  entityId = cr.data?.id || cr.data?.entity?.id;
  ok(`Created test entity: ${slug} (id: ${entityId})`);

  // Build drinks CSV
  sec('Drinks Upload');
  const drinkRows = [
    { slug, drink_section_name: 'Beer', drink_item_name: 'Bud Light', drink_item_description: 'Classic American lager', drink_item_price: '5.00' },
    { slug, drink_section_name: 'Beer', drink_item_name: 'Michelob Ultra', drink_item_description: 'Light lager', drink_item_price: '5.50' },
    { slug, drink_section_name: 'Beer', drink_item_name: 'Yuengling', drink_item_description: 'East coast lager', drink_item_price: '5.00' },
    { slug, drink_section_name: 'Cocktails', drink_item_name: 'Gulf Sunset', drink_item_description: 'Rum + OJ + grenadine', drink_item_price: '9.00' },
    { slug, drink_section_name: 'Cocktails', drink_item_name: 'Mango Margarita', drink_item_description: 'Tequila + mango + lime', drink_item_price: '10.00' },
    { slug, drink_section_name: 'Wine', drink_item_name: 'House Red', drink_item_description: 'Cabernet Sauvignon', drink_item_price: '8.00' },
    { slug, drink_section_name: 'Non-Alcoholic', drink_item_name: 'Sweet Tea', drink_item_price: '2.50' },
    { slug, drink_section_name: 'Non-Alcoholic', drink_item_name: 'Lemonade', drink_item_price: '2.50' },
  ];

  const importRes = await api('POST', '/api/admin/gcr/import-drinks', drinkRows);
  if (!importRes.ok) {
    fail(`Drinks import failed: ${importRes.status} — ${JSON.stringify(importRes.data)}`);
  } else {
    const summary = importRes.data;
    ok(`Drinks import accepted: ${JSON.stringify(summary)}`);
  }

  // Verify in public API
  sec('Verify in Public API');
  await new Promise(r => setTimeout(r, 800));
  const pr = await fetch(BASE + `/api/gcr/entity/${slug}`);
  if (!pr.ok) { fail(`Public profile fetch failed: ${pr.status}`); await cleanup(); return; }
  const pd = await pr.json();

  const drinks = pd.drinks;
  if (!drinks) {
    fail('No drinks object in public response');
  } else {
    const sections = drinks.sections || [];
    const items = drinks.items || [];
    ok(`drinks.sections count: ${sections.length}`);
    ok(`drinks.items count: ${items.length}`);

    const expectedSections = ['Beer', 'Cocktails', 'Wine', 'Non-Alcoholic'];
    for (const s of expectedSections) {
      if (sections.some(sec => sec.section_name === s || sec.name === s)) ok(`Section found: ${s}`);
      else warn(`Section not found: ${s} (check section_name field)`);
    }

    const expectedItems = ['Bud Light', 'Gulf Sunset', 'Mango Margarita', 'House Red', 'Yuengling'];
    for (const name of expectedItems) {
      const found = items.find(i => (i.item_name||i.name||'').toLowerCase() === name.toLowerCase());
      if (found) {
        ok(`Item: "${name}" found — price: ${found.price || found.price_text || 'N/A'}`);
      } else {
        fail(`Item "${name}" not found in drinks.items`);
      }
    }

    // Check prices
    const budlight = items.find(i => (i.item_name||i.name||'').toLowerCase() === 'bud light');
    if (budlight) {
      if (budlight.price == 5 || budlight.price == 5.0) ok(`Bud Light price correct: $5.00`);
      else warn(`Bud Light price unexpected: ${budlight.price}`);
    }

    // Check non-alcoholic (no price_text, has numeric price)
    const tea = items.find(i => (i.item_name||i.name||'').toLowerCase() === 'sweet tea');
    if (tea) {
      if (tea.price == 2.5 || tea.price == 2.50) ok(`Sweet Tea price correct: $2.50`);
      else warn(`Sweet Tea price: ${tea.price}`);
    }
  }

  // Section structure check
  sec('Section Structure Validation');
  if (drinks?.sections?.length > 0) {
    const s = drinks.sections[0];
    const keys = Object.keys(s);
    ok(`Section fields: ${keys.join(', ')}`);
    if ('section_name' in s || 'name' in s) ok('Section has name field');
    else fail('Section missing name field');
  }

  await cleanup();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR drinks upload flow test: ${passed.length} passed, ${warned.length} warnings, ${failed.length} failed.
Failed: ${failed.join(' | ')}
Warnings: ${warned.join(' | ')}
What's the most likely cause and quickest fix?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
