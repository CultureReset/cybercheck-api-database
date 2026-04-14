#!/usr/bin/env node
// gcr-bulk-specials-upload.js — Tests bulk specials CSV upload and verifies specials appear in API
// Usage: node agents/gcr-bulk-specials-upload.js

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

const slug = `gcr-specials-test-${Date.now()}`;
let entityId = null;

async function cleanup() {
  if (!entityId) return;
  await api('DELETE', `/api/admin/gcr/entities/${entityId}`);
  console.log(`\n  ${D}Cleaned up: ${slug}${X}`);
}

async function run() {
  console.log(`\n${B}GCR Bulk Specials Upload Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Create Test Entity');
  const cr = await api('POST', '/api/admin/gcr/entities', {
    entity: { name: 'Specials Test Bar', slug, entity_subtype: 'bar',
      address_line_1: '400 Special St', city: 'Gulf Shores', state: 'AL',
      is_active: false }
  });
  if (!cr.ok || (!cr.data?.id && !cr.data?.entity?.id)) {
    fail(`Entity create failed: ${cr.status}`); process.exit(1);
  }
  entityId = cr.data?.id || cr.data?.entity?.id;
  ok(`Created: ${slug} (id: ${entityId})`);

  sec('Specials Upload');
  const specialRows = [
    { slug, special_name: 'Taco Tuesday', special_description: 'Half-price tacos all day', special_days: 'Tuesday', special_start_time: '11:00 AM', special_end_time: '9:00 PM', special_discount_text: '50% off tacos' },
    { slug, special_name: 'Weekday Lunch Special', special_description: 'Burger + fries + drink combo', special_days: 'Monday,Tuesday,Wednesday,Thursday,Friday', special_start_time: '11:00 AM', special_end_time: '3:00 PM', special_discount_text: '$12.99 combo deal' },
    { slug, special_name: 'Sunday Brunch', special_description: 'Build your own bloody mary bar', special_days: 'Sunday', special_start_time: '10:00 AM', special_end_time: '2:00 PM', special_discount_text: 'Free bloody mary bar with entree' },
  ];

  const importRes = await api('POST', '/api/admin/gcr/import-specials', specialRows);
  if (!importRes.ok) {
    fail(`Specials import failed: ${importRes.status} — ${JSON.stringify(importRes.data)}`);
  } else {
    ok(`Specials import accepted: ${JSON.stringify(importRes.data)}`);
  }

  sec('Verify in Public Profile');
  await new Promise(r => setTimeout(r, 800));
  const pr = await fetch(BASE + `/api/gcr/entity/${slug}`);
  if (!pr.ok) { fail('Public profile fetch failed'); await cleanup(); return; }
  const pd = await pr.json();

  const specials = pd.specials || [];
  ok(`specials count: ${specials.length}`);

  if (specials.length === 0) {
    fail('No specials in public profile');
  } else {
    ['Taco Tuesday', 'Weekday Lunch Special', 'Sunday Brunch'].forEach(name => {
      const s = specials.find(sp => (sp.special_name||sp.name||'').toLowerCase().includes(name.split(' ')[0].toLowerCase()));
      if (s) ok(`Special found: "${name}"`);
      else warn(`Special not found: "${name}"`);
    });

    const taco = specials.find(s => (s.special_name||s.name||'').toLowerCase().includes('taco'));
    if (taco) {
      if (taco.days) ok(`days field present: "${taco.days}"`);
      else warn('Special missing days field');
      if (taco.start_time) ok(`start_time: "${taco.start_time}"`);
      else warn('Special missing start_time');
      if (taco.discount_text || taco.description) ok('Special has discount or description text');
    }
  }

  sec('Verify in Global Specials Endpoint');
  const globalR = await fetch(BASE + '/api/gcr/specials');
  if (!globalR.ok) {
    warn(`Global specials endpoint: ${globalR.status}`);
  } else {
    const gs = await globalR.json();
    const sList = gs.specials || gs || [];
    const found = Array.isArray(sList) ? sList.filter(s => s.slug === slug || s.entity_slug === slug) : [];
    if (found.length > 0) ok(`${found.length} test specials visible in global /api/gcr/specials`);
    else warn('Test specials not visible in global specials endpoint');
  }

  await cleanup();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 250,
      messages: [{ role: 'user', content: `Specials upload test: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
Issues: ${[...failed,...warned].join(' | ')}
Fix?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
