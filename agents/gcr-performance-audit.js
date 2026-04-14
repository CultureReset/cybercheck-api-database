#!/usr/bin/env node
// gcr-performance-audit.js — Tests all key API routes respond under 2s, checks for slow queries
// Usage: node agents/gcr-performance-audit.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';

function bar(ms) {
  const blocks = Math.min(Math.round(ms / 100), 25);
  const color = ms < 500 ? G : ms < 1500 ? Y : R;
  return `${color}${'█'.repeat(blocks)}${X} ${ms}ms`;
}

async function time(label, fn) {
  const start = Date.now();
  let status = 0, ok = false;
  try {
    const r = await fn();
    status = r.status;
    ok = r.status < 400;
  } catch(e) {
    status = 0;
  }
  const ms = Date.now() - start;
  return { label, ms, status, ok };
}

async function run() {
  console.log(`\n${B}GCR Performance Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);
  console.log(`${D}Target: <500ms fast, <1500ms ok, >1500ms slow, >3000ms critical${X}\n`);

  // Auth first
  let token = null;
  try {
    const lr = await fetch(BASE + '/api/admin/login', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({username: EMAIL, password: PASS})
    });
    const ld = await lr.json();
    token = ld.token;
  } catch{}

  const headers = (auth) => {
    const h = {'Content-Type':'application/json'};
    if (auth && token) h['Authorization'] = 'Bearer ' + token;
    return h;
  };

  const PUBLIC_ROUTES = [
    { label: '/api/gcr/entities (limit=50)', fn: () => fetch(BASE+'/api/gcr/entities?limit=50') },
    { label: '/api/gcr/entities (limit=500)', fn: () => fetch(BASE+'/api/gcr/entities?limit=500') },
    { label: '/api/gcr/events', fn: () => fetch(BASE+'/api/gcr/events') },
    { label: '/api/gcr/specials', fn: () => fetch(BASE+'/api/gcr/specials') },
    { label: '/api/gcr/happy-hours', fn: () => fetch(BASE+'/api/gcr/happy-hours') },
    { label: '/api/gcr/category-page-config/restaurants', fn: () => fetch(BASE+'/api/gcr/category-page-config/restaurants') },
  ];

  console.log(`${B}${C}── Public Routes ${'─'.repeat(40)}${X}`);
  const publicResults = await Promise.all(PUBLIC_ROUTES.map(r => time(r.label, r.fn)));
  for (const r of publicResults) {
    const symbol = r.ms < 500 ? `${G}✓` : r.ms < 1500 ? `${Y}⚠` : `${R}✗`;
    console.log(`  ${symbol}${X} ${r.label.padEnd(42)} ${bar(r.ms)} [${r.status}]`);
  }

  // Sample a few entity slugs
  const listR = await fetch(BASE + '/api/gcr/entities?limit=10');
  const listD = listR.ok ? await listR.json() : null;
  const sampleEntities = (listD?.entities || listD?.businesses || []).slice(0, 5);

  if (sampleEntities.length > 0) {
    console.log(`\n${B}${C}── Entity Profile Routes (${sampleEntities.length} samples) ${'─'.repeat(15)}${X}`);
    const profileResults = await Promise.all(
      sampleEntities.map(e => time(`/api/gcr/entity/${e.slug}`, () => fetch(BASE+`/api/gcr/entity/${e.slug}`)))
    );
    for (const r of profileResults) {
      const symbol = r.ms < 500 ? `${G}✓` : r.ms < 1500 ? `${Y}⚠` : `${R}✗`;
      console.log(`  ${symbol}${X} ${r.label.padEnd(42)} ${bar(r.ms)} [${r.status}]`);
    }

    // Profile avg
    const profileMs = profileResults.map(r => r.ms);
    const avgMs = Math.round(profileMs.reduce((a,b)=>a+b,0) / profileMs.length);
    const maxMs = Math.max(...profileMs);
    console.log(`\n  Profile avg: ${avgMs}ms  max: ${maxMs}ms`);
  }

  if (token) {
    const ADMIN_ROUTES = [
      { label: '/api/admin/gcr/entities (limit=100)', fn: () => fetch(BASE+'/api/admin/gcr/entities?limit=100', {headers:headers(true)}) },
      { label: '/api/admin/gcr/entities (limit=500)', fn: () => fetch(BASE+'/api/admin/gcr/entities?limit=500', {headers:headers(true)}) },
    ];

    console.log(`\n${B}${C}── Admin Routes ${'─'.repeat(41)}${X}`);
    const adminResults = await Promise.all(ADMIN_ROUTES.map(r => time(r.label, r.fn)));
    for (const r of adminResults) {
      const symbol = r.ms < 800 ? `${G}✓` : r.ms < 2000 ? `${Y}⚠` : `${R}✗`;
      console.log(`  ${symbol}${X} ${r.label.padEnd(42)} ${bar(r.ms)} [${r.status}]`);
    }
  }

  console.log(`\n${B}${C}── Concurrent Load Test (10 parallel entity fetches) ${'─'.repeat(3)}${X}`);
  if (sampleEntities.length > 0) {
    const concurrentSlug = sampleEntities[0].slug;
    const start = Date.now();
    await Promise.all(Array(10).fill(null).map(() => fetch(BASE+`/api/gcr/entity/${concurrentSlug}`)));
    const total = Date.now() - start;
    const symbol = total < 3000 ? `${G}✓` : total < 6000 ? `${Y}⚠` : `${R}✗`;
    console.log(`  ${symbol}${X} 10 concurrent entity fetches: ${total}ms total (${Math.round(total/10)}ms avg)`);
  }

  // Summary stats
  const allResults = publicResults;
  const slow = allResults.filter(r => r.ms > 1500);
  const critical = allResults.filter(r => r.ms > 3000);
  const fast = allResults.filter(r => r.ms < 500);

  console.log(`\n${B}Performance Summary${X}`);
  console.log(`  ${G}Fast (<500ms):${X} ${fast.length}/${allResults.length}`);
  console.log(`  ${Y}Slow (>1500ms):${X} ${slow.length}/${allResults.length}`);
  console.log(`  ${R}Critical (>3s):${X} ${critical.length}/${allResults.length}`);

  if (slow.length > 0) {
    console.log(`\n${Y}Slow routes:${X}`);
    slow.forEach(r => console.log(`  ${Y}⚠${X} ${r.label}: ${r.ms}ms`));
  }

  if (process.env.ANTHROPIC_API_KEY && (slow.length > 0 || critical.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR performance audit: ${fast.length}/${allResults.length} fast (<500ms), ${slow.length} slow (>1500ms), ${critical.length} critical (>3s).
Slow routes: ${slow.map(r=>`${r.label}(${r.ms}ms)`).join(', ')}
This is Supabase + Vercel. What's the most likely cause of slow routes and top 3 fixes?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });
