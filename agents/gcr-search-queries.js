#!/usr/bin/env node
// gcr-search-queries.js — Tests real search queries a tourist would type:
// local terms, category names, specific business types, activity searches,
// happy hour queries, fuzzy/misspelled terms. Verifies relevance of results.
// Usage: node agents/gcr-search-queries.js

require('dotenv').config();

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m)  { console.log(`  ${G}✓${X} ${m}`); passed.push(m); }
function fail(m){ console.log(`  ${R}✗${X} ${m}`); failed.push(m); }
function warn(m){ console.log(`  ${Y}⚠${X} ${m}`); warned.push(m); }
function sec(t) { console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`); }

async function search(query) {
  const r = await fetch(BASE + '/api/gcr/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  let data; try { data = await r.json(); } catch { data = null; }
  return { status: r.status, results: data?.results || [], total: data?.total || 0, data };
}

async function searchStructured(query) {
  const r = await fetch(BASE + '/api/gcr/search-structured', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  let data; try { data = await r.json(); } catch { data = null; }
  return { status: r.status, results: data?.results || [], data };
}

async function entities(params = '') {
  const r = await fetch(BASE + `/api/gcr/entities${params}`);
  let data; try { data = await r.json(); } catch { data = null; }
  return data?.entities || data || [];
}

function testSearch(label, res, opts = {}) {
  if (res.status !== 200) { fail(`"${label}" → status ${res.status}`); return; }
  if (res.results.length === 0) {
    if (opts.expectEmpty) ok(`"${label}" → 0 results (expected)`);
    else warn(`"${label}" → 0 results`);
    return;
  }
  const count = res.results.length;
  const preview = res.results.slice(0, 2).map(r => r.name || r.slug || '?').join(', ');
  ok(`"${label}" → ${count} result${count>1?'s':''}: ${preview}`);

  // Relevance check
  if (opts.expectSubtype) {
    const relevant = res.results.filter(r => r.entity_subtype === opts.expectSubtype || (r.name||'').toLowerCase().includes(opts.keyword||''));
    if (relevant.length === 0) warn(`"${label}" — no results match expected subtype "${opts.expectSubtype}"`);
  }
}

async function run() {
  console.log(`\n${B}GCR Search Queries Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  // ── Category searches ──────────────────────────────────
  sec('Category Searches');
  testSearch('restaurant',          await search('restaurant'));
  testSearch('seafood',             await search('seafood'));
  testSearch('bar',                 await search('bar'));
  testSearch('coffee',              await search('coffee'));
  testSearch('shopping',            await search('shopping'));
  testSearch('nightlife',           await search('nightlife'));

  // ── Activity searches ──────────────────────────────────
  sec('Activity / Things To Do Searches');
  testSearch('fishing charter',     await search('fishing charter'));
  testSearch('parasailing',         await search('parasailing'));
  testSearch('dolphin cruise',      await search('dolphin cruise'));
  testSearch('boat rental',         await search('boat rental'));
  testSearch('jet ski',             await search('jet ski'));
  testSearch('things to do',        await search('things to do'));

  // ── Location-aware searches ────────────────────────────
  sec('Location-Aware Searches');
  testSearch('Orange Beach restaurant',   await search('Orange Beach restaurant'));
  testSearch('Gulf Shores seafood',       await search('Gulf Shores seafood'));
  testSearch('Perdido Key bar',           await search('Perdido Key bar'));
  testSearch('beach food',                await search('beach food'));

  // ── Intent-based searches ──────────────────────────────
  sec('Intent / Tourist Queries');
  testSearch('happy hour tonight',        await search('happy hour tonight'));
  testSearch('best seafood on the water', await search('best seafood on the water'));
  testSearch('family friendly activities',await search('family friendly activities'));
  testSearch('date night dinner',         await search('date night dinner'));
  testSearch('live music bar',            await search('live music bar'));
  testSearch('outdoor dining',            await search('outdoor dining'));
  testSearch('book a fishing trip',       await search('book a fishing trip'));

  // ── Fuzzy / misspelled ────────────────────────────────
  sec('Fuzzy / Misspelled Queries');
  testSearch('resturant',           await search('resturant'));      // misspelled
  testSearch('seafod',              await search('seafood'));        // misspelled
  testSearch('parasaling',          await search('parasaling'));     // misspelled

  // ── Structured search ─────────────────────────────────
  sec('Structured Search');
  const s1 = await searchStructured('restaurants in Orange Beach');
  if (s1.status === 200) ok(`Structured search works → ${s1.results.length} results`);
  else fail(`Structured search failed: status ${s1.status}`);

  const s2 = await searchStructured('fishing charters with booking');
  if (s2.status === 200) ok(`Structured activity search → ${s2.results.length} results`);
  else fail(`Structured activity search failed: status ${s2.status}`);

  // ── Entity filter by subtype ───────────────────────────
  sec('Entity Subtype Filtering');
  const subtypeTests = [
    { subtype: 'restaurant', label: 'restaurants' },
    { subtype: 'fishing_charter', label: 'fishing charters' },
    { subtype: 'bar', label: 'bars' },
  ];
  for (const { subtype, label } of subtypeTests) {
    const ents = await entities(`?subtype=${subtype}`);
    if (ents.length > 0) ok(`?subtype=${subtype} → ${ents.length} ${label}`);
    else warn(`?subtype=${subtype} → 0 results (no ${label} in DB?)`);
  }

  // ── City filter ────────────────────────────────────────
  sec('City Filtering');
  const cityTests = ['Orange Beach', 'Gulf Shores', 'Perdido Key'];
  for (const city of cityTests) {
    const ents = await entities(`?city=${encodeURIComponent(city)}`);
    if (ents.length > 0) ok(`?city=${city} → ${ents.length} entities`);
    else warn(`?city=${city} → 0 results`);
  }

  // Summary
  const totalWarns  = warned.length;
  const totalFailed = failed.length;
  console.log(`\n${B}${'═'.repeat(56)}${X}`);
  console.log(`${B}Search: ${G}${passed.length} passed${X}  ${Y}${totalWarns} warnings${X}  ${R}${totalFailed} failed${X}`);

  if (warned.length > 0) {
    console.log(`\n${Y}Queries with no results:${X}`);
    warned.forEach(w => console.log(`  ${Y}⚠${X} ${w}`));
    console.log(`\n${D}Tip: Warnings mean queries return 0 results — may need more data in DB.${X}`);
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(R+'Fatal: '+X+e.message); process.exit(1); });
