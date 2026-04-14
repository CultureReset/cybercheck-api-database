#!/usr/bin/env node
// gcr-duplicate-detect.js — Finds duplicate businesses by name, phone, slug patterns
// Usage: node agents/gcr-duplicate-detect.js

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';

async function run() {
  console.log(`\n${B}GCR Duplicate Detection${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  // Fetch ALL entities (active + inactive) via admin
  const EMAIL = process.env.ADMIN_EMAIL, PASS = process.env.ADMIN_PASS;
  const lr = await fetch(BASE + '/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:EMAIL,password:PASS}) });
  const lrData = await lr.json();
  const token = lrData.token;
  if (!token) { console.log(`${R}Login failed${X}`); process.exit(1); }

  const r = await fetch(BASE + '/api/admin/gcr/entities?limit=2000', { headers: { 'Authorization': 'Bearer '+token } });
  const data = await r.json();
  const entities = data.entities || data.businesses || (Array.isArray(data) ? data : []);
  console.log(`  Scanning ${entities.length} total entities (active + inactive)...\n`);

  // 1. Slug duplicates (-1 suffix)
  const slugSuffixDups = entities.filter(e => (e.slug||'').match(/-1$/));
  const slugSuffixRealDups = slugSuffixDups.filter(e => {
    const base = e.slug.replace(/-1$/,'');
    return entities.some(o => o.slug === base);
  });

  // 2. Name duplicates (exact)
  const nameMap = {};
  entities.forEach(e => {
    const key = (e.name||'').toLowerCase().trim();
    if (!nameMap[key]) nameMap[key] = [];
    nameMap[key].push(e);
  });
  const nameDups = Object.entries(nameMap).filter(([,v])=>v.length>1);

  // 3. Phone duplicates
  const phoneMap = {};
  entities.forEach(e => {
    if (!e.phone) return;
    const key = (e.phone||'').replace(/\D/g,'');
    if (key.length < 7) return;
    if (!phoneMap[key]) phoneMap[key] = [];
    phoneMap[key].push(e);
  });
  const phoneDups = Object.entries(phoneMap).filter(([,v])=>v.length>1);

  // 4. Similar names (levenshtein-style — check if names differ by only numbers/suffix)
  const cleanName = n => (n||'').toLowerCase().replace(/[^a-z]/g,'').trim();
  const cleanMap = {};
  entities.forEach(e => {
    const key = cleanName(e.name);
    if (!cleanMap[key]) cleanMap[key] = [];
    cleanMap[key].push(e);
  });
  const cleanDups = Object.entries(cleanMap).filter(([,v])=>v.length>1 && v.length < 10);

  // Print results
  console.log(`${B}${C}── Slug Suffix Duplicates (-1 pattern) ${'─'.repeat(17)}${X}`);
  if (slugSuffixRealDups.length === 0) console.log(`  ${G}✓${X} None found`);
  else slugSuffixRealDups.forEach(e => console.log(`  ${Y}⚠${X} "${e.name}" — slug "${e.slug}" duplicates "${e.slug.replace(/-1$/, '')}"`));

  console.log(`\n${B}${C}── Exact Name Duplicates ${'─'.repeat(32)}${X}`);
  if (nameDups.length === 0) console.log(`  ${G}✓${X} None found`);
  else nameDups.slice(0,15).forEach(([name, list]) => {
    console.log(`  ${R}✗${X} "${name}" appears ${list.length}x:`);
    list.forEach(e => console.log(`      slug: ${e.slug}  active: ${e.is_active}`));
  });

  console.log(`\n${B}${C}── Phone Number Duplicates ${'─'.repeat(30)}${X}`);
  if (phoneDups.length === 0) console.log(`  ${G}✓${X} None found`);
  else phoneDups.slice(0,10).forEach(([phone, list]) => {
    console.log(`  ${Y}⚠${X} Phone ${phone} shared by: ${list.map(e=>e.name).join(', ')}`);
  });

  console.log(`\n${B}${C}── Name Variations (same letters, different formatting) ${'─'.repeat(1)}${X}`);
  const varDups = cleanDups.filter(([k,v]) => v.length > 1 && !nameDups.some(([n])=>n===v[0].name.toLowerCase().trim()));
  if (varDups.length === 0) console.log(`  ${G}✓${X} None found`);
  else varDups.slice(0,10).forEach(([,list]) => {
    console.log(`  ${Y}⚠${X} Possible duplicate: ${list.map(e=>`"${e.name}"(${e.slug})`).join(' vs ')}`);
  });

  const totalIssues = slugSuffixRealDups.length + nameDups.length + phoneDups.length;
  console.log(`\n${B}Total duplicate issues: ${totalIssues}${X}`);
  console.log(`  ${Y}${slugSuffixRealDups.length}${X} slug suffix dups  ${R}${nameDups.length}${X} exact name dups  ${Y}${phoneDups.length}${X} phone dups`);

  if (process.env.ANTHROPIC_API_KEY && totalIssues > 0) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 350,
      messages: [{ role: 'user', content: `GCR duplicate business detection: ${entities.length} total entities.
${slugSuffixRealDups.length} slug suffix duplicates (slug-1 pattern where base slug exists).
${nameDups.length} exact name duplicates.
${phoneDups.length} phone number duplicates.
Name dups: ${nameDups.slice(0,5).map(([n,l])=>`"${n}"(${l.length}x active:${l.filter(e=>e.is_active).length})`).join(', ')}
What's the fastest way to clean this up? How should we handle active vs inactive duplicates?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });
