#!/usr/bin/env node
// diagnose-timeouts.js — Quick check of what's causing the 3 timeouts
// Usage: node agents/diagnose-timeouts.js

require('dotenv').config();

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const GROK_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASS = process.env.ADMIN_PASS;

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
function ok(m){console.log(`  ${G}✓${X} ${m}`);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);}
function sec(t){console.log(`\n${B}${C}━━ ${t} ${'━'.repeat(Math.max(0,52-t.length))}${X}`);}
function log(m){console.log(`  ${D}${m}${X}`);}

async function run() {
  console.log(`\n${B}Timeout Diagnosis${X}\n`);

  // ── CHECK 1: GROK API KEY ─────────────────────────────────────────────
  sec('1. Grok AI Configuration');

  if (!GROK_KEY) {
    fail('GROK_API_KEY / XAI_API_KEY not set in .env');
    log('Menu upload will timeout calling Grok API');
  } else {
    ok(`Grok API key present (${GROK_KEY.slice(0, 10)}...)`);

    // Quick test of Grok API
    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROK_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-3-mini',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      });

      if (res.ok) {
        ok('Grok API is reachable and responding');
      } else if (res.status === 401) {
        fail(`Grok API key is INVALID (401 Unauthorized)`);
        log('→ Menu upload will timeout because normalizeRowsWithAI will fail');
      } else {
        warn(`Grok API returned ${res.status} (might be rate limited or down)`);
      }
    } catch (e) {
      fail(`Grok API unreachable: ${e.message}`);
      log('→ Menu upload will timeout');
    }
  }

  // ── CHECK 2: ADMIN AUTHENTICATION ─────────────────────────────────────
  sec('2. Admin Dashboard Access');

  if (!ADMIN_EMAIL || !ADMIN_PASS) {
    fail('ADMIN_EMAIL / ADMIN_PASS not set in .env');
    log('Dashboard tester cannot login → pages stay in "Loading..." state');
  } else {
    const loginRes = await fetch(BASE + '/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ADMIN_EMAIL, password: ADMIN_PASS })
    });

    if (loginRes.ok) {
      const data = await loginRes.json();
      if (data.token) {
        ok('Admin login works');

        // Check if admin.html exists
        const htmlRes = await fetch('https://cybercheck-login.vercel.app/admin.html', { method: 'HEAD' });
        if (htmlRes.ok) {
          ok('admin.html is accessible');
        } else {
          fail(`admin.html returned ${htmlRes.status}`);
        }
      } else {
        fail('Login successful but no token returned');
      }
    } else {
      fail(`Admin login failed (${loginRes.status})`);
      log('→ Dashboard pages will not load');
    }
  }

  // ── CHECK 3: AI ORGANIZER ENDPOINT ────────────────────────────────────
  sec('3. AI Menu Organizer Endpoint');

  const endpoints = [
    '/api/admin/ai-organize',
    '/api/admin/gcr/ai-organize',
    '/api/admin/gcr/organize-menu',
    '/api/admin/ai/organize',
    '/api/gcr/ai/organize',
  ];

  let found = false;
  for (const endpoint of endpoints) {
    const res = await fetch(BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: 'test' })
    });

    if (res.status !== 404 && res.status !== 405) {
      ok(`Found endpoint: ${endpoint} (${res.status})`);
      found = true;
      break;
    }
  }

  if (!found) {
    fail('AI organizer endpoint not found at any standard path');
    log('→ Agent will timeout trying all possible routes');
  }

  // ── CHECK 4: MENU IMPORT ROUTE ────────────────────────────────────────
  sec('4. Menu Import Route');

  const importRes = await fetch(BASE + '/api/admin/gcr/import-menu', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'test', menu_item_name: 'Test Item' })
  });

  if (importRes.ok || importRes.status === 400) {
    ok(`Menu import route exists (${importRes.status})`);
    log('Issue is likely the Grok AI call within the route');
  } else if (importRes.status === 404) {
    fail('Menu import route not found');
  } else {
    warn(`Menu import returned ${importRes.status}`);
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────
  sec('Summary');
  console.log(`\n${B}To fix the timeouts:${X}\n`);
  console.log(`  1. ${Y}Menu Upload timeout${X}`);
  console.log(`     → Set GROK_API_KEY in .env (or use skip_ai=true query param)`);
  console.log(`     → Or: node agents/gcr-upload-flow.js?skip_ai=true\n`);
  console.log(`  2. ${Y}Dashboard timeout${X}`);
  console.log(`     → Set ADMIN_EMAIL / ADMIN_PASS in .env`);
  console.log(`     → Check if admin.html has JS errors (open in browser)\n`);
  console.log(`  3. ${Y}AI Organizer timeout${X}`);
  console.log(`     → Endpoint doesn't exist or route needs implementation`);
  console.log(`     → Check if /api/admin/ai-organize is defined in routes\n`);
}

run().catch(e => { console.error(e); process.exit(1); });
