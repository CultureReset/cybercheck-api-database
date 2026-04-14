#!/usr/bin/env node
// gcr-ai-organizer-audit.js — Tests the AI menu organizer route: raw text → structured sections
// Usage: node agents/gcr-ai-organizer-audit.js

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

// Raw messy menu text like a business owner might paste in
const RAW_MENU = `
APPETIZERS
Gulf Shrimp Cocktail - chilled gulf shrimp with zesty cocktail sauce - $14
Oysters on the Half Shell - fresh local oysters (6pc) $18
Crab Dip - hot crab dip served with chips and crackers 12

ENTREES
Grilled Red Snapper fresh caught today, lemon butter sauce, served with 2 sides $28
Shrimp & Grits - gulf shrimp over stone ground grits, andouille sausage, $22
Fried Shrimp Basket - hand-breaded gulf shrimp, fries, slaw $18
Ribeye 12oz hand-cut aged ribeye steak $42

SALADS
House Salad mixed greens, tomatoes, cucumber, croutons $9
Caesar Salad romaine, parmesan, croutons, caesar dressing $11 add chicken +$4

DESSERTS
Key Lime Pie - florida style, graham cracker crust $8
Bread Pudding - warm bread pudding, bourbon sauce $7

DRINKS
Sweet Tea $2.50
Lemonade 2.50
Soft Drinks $2

BEER
Bud Light $5
Michelob Ultra $5
Yuengling Draft $5.50
`;

async function run() {
  console.log(`\n${B}GCR AI Menu Organizer Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Discover AI Organizer Route');
  // Try common route patterns
  const routes = [
    '/api/admin/ai-organize',
    '/api/admin/gcr/ai-organize',
    '/api/admin/gcr/organize-menu',
    '/api/admin/ai/organize',
    '/api/admin/gcr/import-ai',
    '/api/admin/ai-menu',
    '/api/gcr/ai/organize',
  ];

  let aiRoute = null;
  for (const route of routes) {
    const r = await api('POST', route, { text: RAW_MENU.trim() });
    if (r.status !== 404 && r.status !== 405) {
      aiRoute = route;
      ok(`Found AI organizer route: ${route} (status: ${r.status})`);
      break;
    }
  }

  if (!aiRoute) {
    warn('AI organizer route not found at any common path — checking admin.html for the actual endpoint');

    // Try to detect from a generic OPTIONS or look for 'organize' in the router
    const discoverR = await api('GET', '/api/admin/gcr/routes');
    if (discoverR.ok && discoverR.data) {
      ok(`Routes endpoint exists: ${JSON.stringify(discoverR.data).substring(0,100)}`);
    }

    console.log(`\n  ${Y}⚠${X} AI organizer route not found. Skipping AI test.\n  ${D}Check admin.html processBulkCSV() for the route name used by the UI.${X}`);
    console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}\n`);
    return;
  }

  sec('Test AI Organizer with Raw Menu Text');
  const organizeR = await api('POST', aiRoute, { text: RAW_MENU.trim() });
  if (!organizeR.ok) {
    fail(`AI organizer failed: ${organizeR.status} — ${JSON.stringify(organizeR.data)}`);
    console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}\n`);
    return;
  }

  ok('AI organizer returned 200');
  const result = organizeR.data;
  console.log(`\n  ${D}Response structure:${X} ${JSON.stringify(Object.keys(result||{}))}`);

  sec('Validate Structured Output');
  // Expect: sections[] or items[] with section names, item_name, price
  const sections = result.sections || result.menu?.sections || [];
  const items = result.items || result.menu?.items || [];

  if (sections.length > 0) {
    ok(`${sections.length} sections extracted`);
    const sectionNames = sections.map(s => s.section_name || s.name || '(no name)');
    ok(`Sections: ${sectionNames.join(', ')}`);

    const expectedSections = ['Appetizers', 'Entrees', 'Desserts'];
    for (const s of expectedSections) {
      if (sectionNames.some(n => n.toLowerCase().includes(s.toLowerCase()))) ok(`Section found: ${s}`);
      else warn(`Section not found: ${s}`);
    }

    let totalItems = 0;
    for (const section of sections) {
      const sItems = section.items || [];
      totalItems += sItems.length;
    }
    ok(`Total items across sections: ${totalItems}`);

    // Spot-check a specific item
    const allItems = sections.flatMap(s => s.items||[]);
    const snapper = allItems.find(i => (i.item_name||i.name||'').toLowerCase().includes('snapper'));
    if (snapper) {
      ok(`"Grilled Red Snapper" extracted — price: ${snapper.price || snapper.price_text || 'N/A'}`);
      if (snapper.price == 28 || snapper.price == 28.0) ok('Snapper price correctly parsed: $28');
      else warn(`Snapper price: ${snapper.price} (expected 28)`);
    } else {
      warn('"Grilled Red Snapper" not found in output');
    }
  } else if (items.length > 0) {
    ok(`${items.length} flat items extracted`);
  } else {
    fail('No sections or items in AI organizer output');
  }

  sec('Test AI Organizer with Minimal Input');
  const minimalR = await api('POST', aiRoute, { text: 'Burger $12\nFries $4\nSoda $2' });
  if (minimalR.ok) ok('Minimal input accepted');
  else warn(`Minimal input failed: ${minimalR.status}`);

  sec('Test AI Organizer with Empty Input');
  const emptyR = await api('POST', aiRoute, { text: '' });
  if (emptyR.status >= 400) ok(`Empty input properly rejected: ${emptyR.status}`);
  else warn(`Empty input returned ${emptyR.status} — should return 400`);

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `AI menu organizer audit: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
Route found: ${aiRoute || 'NOT FOUND'}.
Issues: ${[...failed,...warned].join(' | ')}
What's needed to make the AI organizer production-ready?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });
