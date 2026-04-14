#!/usr/bin/env node
// gcr-deployment-check.js — Verifies the live Vercel deployment is up and all critical routes work
// Usage: node agents/gcr-deployment-check.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`);}

const CRITICAL_ROUTES = [
  // Public GCR routes
  { method: 'GET', path: '/api/gcr/entities?limit=10', label: 'Entities list', requiresAuth: false, expectData: true },
  { method: 'GET', path: '/api/gcr/events', label: 'Events list', requiresAuth: false, expectData: false },
  { method: 'GET', path: '/api/gcr/specials', label: 'Specials list', requiresAuth: false, expectData: false },
  { method: 'GET', path: '/api/gcr/happy-hours', label: 'Happy hours list', requiresAuth: false, expectData: false },
  { method: 'GET', path: '/api/gcr/category-page-config/restaurants', label: 'Category config', requiresAuth: false, expectData: false },
  // Admin routes (no auth check, just 401 is fine)
  { method: 'POST', path: '/api/admin/login', label: 'Admin login endpoint', requiresAuth: false, expectData: false },
  { method: 'GET', path: '/api/admin/gcr/entities?limit=5', label: 'Admin entities (auth required)', requiresAuth: true, expectData: true },
  // Menu
  { method: 'GET', path: '/api/gcr/entities?limit=5', label: 'Entities with limit=5', requiresAuth: false, expectData: true },
];

async function run() {
  console.log(`\n${B}GCR Deployment Check${X}`);
  console.log(`${D}Checking: ${BASE}${X}\n`);

  sec('Base URL Reachability');
  try {
    const r = await fetch(BASE, { signal: AbortSignal.timeout(10000) });
    ok(`Base URL reachable: ${r.status}`);
  } catch(e) {
    if (e.name === 'TimeoutError') fail(`Base URL timeout after 10s — deployment may be down`);
    else if (e.message.includes('ENOTFOUND')) fail(`DNS resolution failed: ${BASE}`);
    else warn(`Base URL error: ${e.message}`);
  }

  sec('Authentication');
  const EMAIL = process.env.ADMIN_EMAIL;
  const PASS = process.env.ADMIN_PASS;
  let token = null;

  const lr = await fetch(BASE + '/api/admin/login', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({username: EMAIL, password: PASS}),
    signal: AbortSignal.timeout(10000)
  }).catch(e => ({ ok: false, status: 0, _error: e.message }));

  if (lr.status === 0) {
    fail(`Admin login endpoint unreachable: ${lr._error}`);
  } else if (!lr.ok) {
    fail(`Admin login failed: ${lr.status}`);
  } else {
    const ld = await lr.json().catch(()=>({}));
    token = ld?.token;
    if (token) ok('Admin authentication successful');
    else fail('Admin login returned 200 but no token');
  }

  sec('Critical Route Checks');
  for (const route of CRITICAL_ROUTES) {
    const headers = {'Content-Type':'application/json'};
    if (route.requiresAuth && token) headers['Authorization'] = 'Bearer ' + token;

    try {
      const r = await fetch(BASE + route.path, {
        method: route.method,
        headers,
        signal: AbortSignal.timeout(8000)
      });

      let data = null;
      try { data = await r.json(); } catch {}

      if (route.requiresAuth && !token) {
        // Can't test auth routes without token
        warn(`${route.label}: skipped (no auth token)`);
        continue;
      }

      if (route.requiresAuth && r.status === 401) {
        fail(`${route.label}: 401 with valid token — auth may be broken`);
        continue;
      }

      if (r.status === 404) {
        fail(`${route.label}: 404 — route not deployed`);
        continue;
      }

      if (r.status >= 500) {
        fail(`${route.label}: ${r.status} server error`);
        continue;
      }

      if (r.status === 401 && !route.requiresAuth) {
        fail(`${route.label}: 401 — public route requires auth (broken)`);
        continue;
      }

      if (route.expectData && r.ok) {
        const entities = data?.entities || data?.businesses || data?.results || (Array.isArray(data) ? data : null);
        if (!entities || entities.length === 0) warn(`${route.label}: ${r.status} but no data returned`);
        else ok(`${route.label}: ${r.status} — ${entities.length} records`);
      } else {
        ok(`${route.label}: ${r.status}`);
      }
    } catch(e) {
      if (e.name === 'TimeoutError') fail(`${route.label}: timeout`);
      else fail(`${route.label}: ${e.message}`);
    }
  }

  sec('Entity Profile Route (sample)');
  const listR = await fetch(BASE + '/api/gcr/entities?limit=3').catch(()=>null);
  if (listR?.ok) {
    const d = await listR.json().catch(()=>({}));
    const entities = d?.entities || d?.businesses || [];
    for (const e of entities.slice(0, 3)) {
      try {
        const pr = await fetch(BASE + `/api/gcr/entity/${e.slug}`, { signal: AbortSignal.timeout(5000) });
        if (pr.ok) ok(`/api/gcr/entity/${e.slug}: ${pr.status}`);
        else fail(`/api/gcr/entity/${e.slug}: ${pr.status}`);
      } catch(err) {
        fail(`/api/gcr/entity/${e.slug}: ${err.message}`);
      }
    }
  }

  sec('CORS Headers Check');
  const corsR = await fetch(BASE + '/api/gcr/entities?limit=1').catch(()=>null);
  if (corsR) {
    const allowOrigin = corsR.headers.get('access-control-allow-origin');
    const allowMethods = corsR.headers.get('access-control-allow-methods');
    if (allowOrigin) ok(`CORS: Access-Control-Allow-Origin: ${allowOrigin}`);
    else warn('CORS: No Access-Control-Allow-Origin header — GCR frontend may be blocked');
    if (allowMethods) ok(`CORS methods: ${allowMethods}`);
  }

  sec('Deployment Info');
  const vercelR = await fetch(BASE + '/api/gcr/entities?limit=1').catch(()=>null);
  if (vercelR) {
    const server = vercelR.headers.get('server') || vercelR.headers.get('x-vercel-id') ? 'Vercel' : 'Unknown';
    const cacheStatus = vercelR.headers.get('x-vercel-cache') || vercelR.headers.get('cf-cache-status');
    ok(`Server: ${server}`);
    if (cacheStatus) ok(`Cache status: ${cacheStatus}`);
  }

  // Final summary
  const allGood = failed.length === 0;
  console.log(`\n${allGood ? G+'✓ DEPLOYMENT OK' : R+'✗ DEPLOYMENT HAS ISSUES'}${X}`);
  console.log(`${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (failed.length > 0) {
    console.log(`\n${R}Critical failures:${X}`);
    failed.forEach(f => console.log(`  ${R}✗${X} ${f}`));
  }

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR deployment check for ${BASE}: ${passed.length} passed, ${failed.length} failed.
Critical failures: ${failed.join(' | ')}
Warnings: ${warned.join(' | ')}
What's blocking the site from being production-ready?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });
