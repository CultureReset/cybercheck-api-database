#!/usr/bin/env node
// gcr-image-audit.js — Checks every hero_image_url returns 200 (not broken)
// Usage: node agents/gcr-image-audit.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';

async function checkUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    return { status: res.status, ok: res.status === 200 || res.status === 206 };
  } catch(e) { return { status: 0, ok: false, error: e.message }; }
}

async function run() {
  console.log(`\n${B}GCR Image URL Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  const r = await fetch(BASE + '/api/gcr/entities?limit=1000');
  const data = await r.json();
  const entities = data.entities || data.businesses || [];
  console.log(`  Checking ${entities.length} entities...\n`);

  const withImages = entities.filter(e => e.hero_image_url);
  const withoutImages = entities.filter(e => !e.hero_image_url);
  console.log(`  ${G}${withImages.length}${X} have hero images  ${Y}${withoutImages.length}${X} have no hero image\n`);

  console.log(`${B}${C}── Checking hero image URLs (sample of 50) ${'─'.repeat(13)}${X}`);

  const sample = withImages.slice(0, 50);
  let ok200 = 0, broken = [], slow = [];

  // Check in batches of 10
  for (let i = 0; i < sample.length; i += 10) {
    const batch = sample.slice(i, i+10);
    const results = await Promise.all(batch.map(async e => {
      const start = Date.now();
      const r = await checkUrl(e.hero_image_url);
      const ms = Date.now() - start;
      return { entity: e, ...r, ms };
    }));
    for (const res of results) {
      if (res.ok) {
        ok200++;
        if (res.ms > 3000) slow.push({ name: res.entity.name, url: res.entity.hero_image_url, ms: res.ms });
      } else {
        broken.push({ name: res.entity.name, slug: res.entity.slug, url: res.entity.hero_image_url, status: res.status });
        console.log(`  ${R}✗${X} ${res.entity.name}: ${res.status || 'timeout'} — ${res.entity.hero_image_url?.substring(0,60)}...`);
      }
    }
    process.stdout.write(`\r  Checked ${Math.min(i+10, sample.length)}/${sample.length}...`);
  }
  console.log(`\r  ${G}✓${X} Checked ${sample.length} images                    `);

  console.log(`\n  ${G}${ok200}${X} OK  ${R}${broken.length}${X} broken  ${Y}${slow.length}${X} slow (>3s)`);

  if (broken.length > 0) {
    console.log(`\n${B}${R}── Broken Images ${'─'.repeat(39)}${X}`);
    broken.forEach(b => {
      console.log(`  ${R}✗${X} ${b.name} (${b.slug})`);
      console.log(`      ${D}${b.url}${X}`);
    });
  }

  if (slow.length > 0) {
    console.log(`\n${B}${Y}── Slow Images (>3s load time) ${'─'.repeat(25)}${X}`);
    slow.forEach(s => console.log(`  ${Y}⚠${X} ${s.name}: ${s.ms}ms`));
  }

  // Domain breakdown
  const domains = {};
  withImages.forEach(e => {
    try {
      const domain = new URL(e.hero_image_url).hostname;
      domains[domain] = (domains[domain]||0)+1;
    } catch {}
  });
  console.log(`\n${B}${C}── Image Hosting Sources ${'─'.repeat(31)}${X}`);
  Object.entries(domains).sort((a,b)=>b[1]-a[1]).forEach(([domain, count]) => {
    console.log(`  ${count > 0 ? G+'✓' : Y+'⚠'}${X} ${domain.padEnd(40)} ${count} images`);
  });

  if (process.env.ANTHROPIC_API_KEY) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR image audit: ${entities.length} entities.
${withImages.length} have hero images, ${withoutImages.length} have none.
Checked ${sample.length} image URLs: ${ok200} OK, ${broken.length} broken, ${slow.length} slow.
Broken images: ${broken.slice(0,5).map(b=>b.name).join(', ')}
Hosting sources: ${Object.entries(domains).map(([d,c])=>`${d}(${c})`).join(', ')}
What's the impact on the site? Recommendations for image hosting?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });
