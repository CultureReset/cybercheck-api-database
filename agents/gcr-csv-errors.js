#!/usr/bin/env node
// gcr-csv-errors.js — Tests that bad CSV input returns clean errors, not 500s or silent failures
// Usage: node agents/gcr-csv-errors.js

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

// Check that import routes return ≥400 (not 200) for bad data
// And return ≤400 (not 500) so errors are client-friendly
function checkErrorResponse(label, r) {
  if (r.status === 0) {
    fail(`${label}: connection error`);
  } else if (r.status >= 500) {
    fail(`${label}: 500 server error — bad CSV causes crash (status: ${r.status})`);
  } else if (r.status >= 400) {
    ok(`${label}: properly rejected with ${r.status} — "${r.data?.error || r.data?.message || 'no message'}"`);
  } else {
    warn(`${label}: returned ${r.status} (OK) for bad data — no validation?`);
  }
}

async function run() {
  console.log(`\n${B}GCR CSV Error Handling Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);
  console.log(`${D}Checking all import routes reject bad input cleanly${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Empty CSV Body');
  checkErrorResponse('import-menu empty body', await api('POST', '/api/admin/gcr/import-menu', {}));
  checkErrorResponse('import-drinks empty body', await api('POST', '/api/admin/gcr/import-drinks', {}));
  checkErrorResponse('import-events empty body', await api('POST', '/api/admin/gcr/import-events', {}));
  checkErrorResponse('import-specials empty body', await api('POST', '/api/admin/gcr/import-specials', {}));
  checkErrorResponse('import-happyhour empty body', await api('POST', '/api/admin/gcr/import-happyhour', {}));

  sec('Empty CSV String');
  checkErrorResponse('import-menu empty csv', await api('POST', '/api/admin/gcr/import-menu', { csv: '' }));
  checkErrorResponse('import-events empty csv', await api('POST', '/api/admin/gcr/import-events', { csv: '' }));

  sec('CSV With No Header Row');
  const noHeader = `gcr-fake-slug,Burger,Juicy beef burger,9.99`;
  checkErrorResponse('import-menu no header', await api('POST', '/api/admin/gcr/import-menu', { csv: noHeader }));

  sec('CSV With Wrong Columns');
  const wrongCols = `name,location,rating\nTest Place,Orange Beach,5`;
  checkErrorResponse('import-menu wrong columns', await api('POST', '/api/admin/gcr/import-menu', { csv: wrongCols }));
  checkErrorResponse('import-events wrong columns', await api('POST', '/api/admin/gcr/import-events', { csv: wrongCols }));

  sec('CSV Referencing Non-Existent Slug');
  const fakeSlug = `totally-fake-slug-does-not-exist-${Date.now()}`;
  const menuCsv = `slug,section,item_name,description,price\n${fakeSlug},Lunch,Test Burger,A test burger,10.00`;
  const r = await api('POST', '/api/admin/gcr/import-menu', { csv: menuCsv });
  if (r.status >= 500) {
    fail(`import-menu with fake slug: 500 crash (status: ${r.status})`);
  } else if (r.status >= 400) {
    ok(`import-menu with fake slug: properly rejected with ${r.status}`);
  } else {
    // Some systems accept silently and do nothing — check if items were actually created
    warn(`import-menu with fake slug: returned ${r.status} — may silently accept (check DB for orphan items)`);
  }

  sec('CSV With Malformed Prices');
  const badPrices = [
    'slug,section,item_name,description,price',
    `gcr-test-entity,Lunch,Item1,Desc,not-a-price`,
    `gcr-test-entity,Lunch,Item2,Desc,$$$10.00`,
    `gcr-test-entity,Lunch,Item3,Desc,`,
  ].join('\n');
  const pr = await api('POST', '/api/admin/gcr/import-menu', { csv: badPrices });
  if (pr.status >= 500) fail(`import-menu malformed prices: 500 crash`);
  else if (pr.status >= 400) ok(`import-menu malformed prices: rejected with ${pr.status}`);
  else warn(`import-menu malformed prices: returned ${pr.status} — check if NULL prices stored`);

  sec('CSV With SQL Injection Attempt');
  const sqlInject = [
    'slug,section,item_name,description,price',
    `gcr-test-entity,Lunch,'; DROP TABLE entity; --,Desc,10.00`,
    `gcr-test-entity,Lunch,<script>alert(1)</script>,XSS attempt,5.00`,
  ].join('\n');
  const sr = await api('POST', '/api/admin/gcr/import-menu', { csv: sqlInject });
  if (sr.status >= 500) fail(`SQL injection attempt caused 500 — possible vulnerability`);
  else if (sr.status < 400) warn(`SQL injection attempt returned ${sr.status} — verify parameterized queries are used`);
  else ok(`SQL injection CSV rejected: ${sr.status}`);

  sec('Unauthenticated Import Attempt');
  const savedToken = token;
  token = null;
  const authR = await api('POST', '/api/admin/gcr/import-menu', { csv: 'slug,section,item_name,description,price\ntest,Lunch,Item,Desc,10.00' });
  token = savedToken;
  if (authR.status === 401 || authR.status === 403) ok(`Unauthenticated import rejected: ${authR.status}`);
  else if (authR.status === 200) fail('Unauthenticated import ACCEPTED — import routes not protected!');
  else warn(`Unauthenticated import: ${authR.status}`);

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 350,
      messages: [{ role: 'user', content: `CSV error handling audit for GCR import routes: ${passed.length} passed, ${failed.length} failed.
Failed: ${failed.join(' | ')}
Warnings: ${warned.join(' | ')}
The most critical issues: any 500 crashes or missing auth checks. What should be fixed first?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });
