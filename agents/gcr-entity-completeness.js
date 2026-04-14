#!/usr/bin/env node
// gcr-entity-completeness.js — Grades every active entity A-F on data completeness
// Usage: node agents/gcr-entity-completeness.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL;
const PASS  = process.env.ADMIN_PASS;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
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

function scoreEntity(e) {
  let score = 0; const missing = [];
  if (e.hero_image_url) score += 20; else missing.push('hero_image');
  if (e.address_line_1) score += 15; else missing.push('address');
  if (e.phone) score += 10; else missing.push('phone');
  if (e.entity_subtype) score += 20; else missing.push('entity_subtype');
  if (e.description || e.subtitle) score += 10; else missing.push('description');
  if (e.website_url) score += 5; else missing.push('website');
  if (e.directions_url) score += 5; else missing.push('directions_url');
  if (e.city) score += 5; else missing.push('city');
  if (e.hh_days) score += 5; else missing.push('hh_days');
  if (e.social_instagram || e.social_facebook) score += 5; else missing.push('social');
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'F';
  return { score, grade, missing };
}

async function run() {
  console.log(`\n${B}GCR Entity Completeness Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  // Login
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  console.log(`  ${G}✓${X} Authenticated\n`);

  // Fetch all active entities
  const r = await api('GET', '/api/gcr/entities?limit=1000');
  if (!r.ok) { console.log(`${R}Failed to fetch entities${X}`); process.exit(1); }
  const entities = r.data?.entities || r.data?.businesses || [];
  console.log(`${B}${C}── Scoring ${entities.length} active entities ${'─'.repeat(20)}${X}\n`);

  const grades = { A: [], B: [], C: [], D: [], F: [] };
  const allResults = [];

  for (const e of entities) {
    const { score, grade, missing } = scoreEntity(e);
    grades[grade].push(e.name);
    allResults.push({ name: e.name, slug: e.slug, score, grade, missing, subtype: e.entity_subtype });
  }

  // Print grade summary
  for (const [grade, color] of [['A', G], ['B', G], ['C', Y], ['D', Y], ['F', R]]) {
    const list = grades[grade];
    if (list.length) {
      console.log(`${B}${color}Grade ${grade}${X} (${list.length} businesses):`);
      list.slice(0, 10).forEach(n => console.log(`    ${n}`));
      if (list.length > 10) console.log(`    ${D}...and ${list.length - 10} more${X}`);
    }
  }

  // Most common missing fields
  const missingCount = {};
  allResults.forEach(r => r.missing.forEach(m => { missingCount[m] = (missingCount[m]||0)+1; }));
  const topMissing = Object.entries(missingCount).sort((a,b)=>b[1]-a[1]);

  console.log(`\n${B}${C}── Most Common Missing Fields ${'─'.repeat(26)}${X}`);
  topMissing.forEach(([field, count]) => {
    const pct = Math.round(count/entities.length*100);
    const bar = '█'.repeat(Math.round(pct/5));
    const color = pct > 50 ? R : pct > 25 ? Y : G;
    console.log(`  ${color}${field.padEnd(20)}${X} ${String(count).padStart(3)} businesses (${pct}%) ${color}${bar}${X}`);
  });

  // No subtype = won't show on any category page
  const noSubtype = allResults.filter(e => !e.subtype);
  if (noSubtype.length) {
    console.log(`\n${B}${R}── ${noSubtype.length} Entities with NO entity_subtype (invisible on all category pages) ${'─'.repeat(5)}${X}`);
    noSubtype.slice(0, 20).forEach(e => console.log(`  ${R}✗${X} ${e.name} (${e.slug})`));
    if (noSubtype.length > 20) console.log(`  ${D}...and ${noSubtype.length - 20} more${X}`);
  }

  const avgScore = Math.round(allResults.reduce((s,e)=>s+e.score,0)/allResults.length);
  console.log(`\n${B}Average completeness score: ${avgScore}/100${X}`);
  console.log(`${G}A: ${grades.A.length}${X}  ${G}B: ${grades.B.length}${X}  ${Y}C: ${grades.C.length}${X}  ${Y}D: ${grades.D.length}${X}  ${R}F: ${grades.F.length}${X}`);

  // Haiku analysis
  if (process.env.ANTHROPIC_API_KEY) {
    console.log(`\n${D}Analyzing with Claude Haiku...${X}`);
    const worst = allResults.filter(e => e.grade === 'F').slice(0, 10).map(e => `${e.name}: missing ${e.missing.join(', ')}`);
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: `GCR entity completeness audit for Gulf Coast Radar local discovery site.
${entities.length} active businesses. Average score: ${avgScore}/100.
Grade distribution: A=${grades.A.length} B=${grades.B.length} C=${grades.C.length} D=${grades.D.length} F=${grades.F.length}
Most missing fields: ${topMissing.slice(0,5).map(([f,c])=>`${f}(${c})`).join(', ')}
No entity_subtype: ${noSubtype.length} businesses (won't show on any category page)
Worst 10: ${worst.join(' | ')}

Give: 1) What does this mean for site launch readiness? 2) Which missing fields hurt most? 3) Quick bulk fix recommendations. Be direct and specific.` }]
    });
    console.log('\n' + msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error(R+'Fatal: '+X+e.message); process.exit(1); });
