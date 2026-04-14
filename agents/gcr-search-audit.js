#!/usr/bin/env node
// gcr-search-audit.js — Tests GCR search endpoint: returns results, filters correctly, handles edge cases
// Usage: node agents/gcr-search-audit.js

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

async function run() {
  console.log(`\n${B}GCR Search Audit${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  sec('Discover Search Endpoint');
  const searchRoutes = [
    '/api/gcr/search?q=seafood',
    '/api/gcr/entities?search=seafood',
    '/api/gcr/entities?q=seafood',
  ];

  let searchRoute = null;
  let searchParam = null;
  for (const route of searchRoutes) {
    const r = await fetch(BASE + route);
    if (r.ok) {
      const d = await r.json();
      const results = d?.entities || d?.businesses || d?.results || d || [];
      if (Array.isArray(results)) {
        searchRoute = route.split('?')[0];
        searchParam = route.includes('search=') ? 'search' : 'q';
        ok(`Search route found: ${route.split('?')[0]} (param: ${searchParam}) — ${results.length} results`);
        break;
      }
    } else if (r.status !== 404) {
      warn(`Route ${route}: ${r.status}`);
    }
  }

  if (!searchRoute) {
    fail('No search endpoint found — GCR search may not be implemented yet');
    console.log(`\n${D}The frontend gcr-api.js loads all entities and filters client-side. No server-side search may exist.${X}`);
    console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}\n`);
    return;
  }

  sec('Basic Search Tests');

  const searchTerms = [
    { term: 'seafood', expectResults: true, description: 'common category search' },
    { term: 'beach', expectResults: true, description: 'location keyword' },
    { term: 'happy hour', expectResults: true, description: 'feature search' },
    { term: 'xzqwy9999notreal', expectResults: false, description: 'no match search' },
    { term: '', expectResults: true, description: 'empty search (all results)' },
  ];

  for (const test of searchTerms) {
    const url = test.term
      ? `${BASE}${searchRoute}?${searchParam}=${encodeURIComponent(test.term)}`
      : `${BASE}${searchRoute}`;
    const r = await fetch(url);
    if (!r.ok) { warn(`Search "${test.term}": ${r.status}`); continue; }
    const d = await r.json();
    const results = d?.entities || d?.businesses || d?.results || d || [];
    const count = Array.isArray(results) ? results.length : 0;

    if (test.expectResults && count > 0) ok(`"${test.term||'(all)'}" → ${count} results (${test.description})`);
    else if (test.expectResults && count === 0) warn(`"${test.term}" → 0 results — may not be searchable field`);
    else if (!test.expectResults && count === 0) ok(`"${test.term}" → 0 results (correct, no match)`);
    else if (!test.expectResults && count > 0) warn(`"${test.term}" → ${count} results (expected 0 matches)`);
  }

  sec('Search Filter by Subtype/Category');
  const filterRoutes = [
    `${BASE}/api/gcr/entities?subtype=restaurant`,
    `${BASE}/api/gcr/entities?category=restaurants`,
    `${BASE}/api/gcr/entities?entity_subtype=restaurant`,
  ];

  for (const url of filterRoutes) {
    const r = await fetch(url);
    if (!r.ok) continue;
    const d = await r.json();
    const results = d?.entities || d?.businesses || [];
    if (results.length > 0) {
      const allRestaurants = results.every(e => {
        const sub = (e.entity_subtype||'').toLowerCase();
        return sub.includes('restaurant') || sub.includes('bar') || sub.includes('dining') || sub.includes('seafood');
      });
      ok(`Filter "${url.split('?')[1]}": ${results.length} results`);
      if (!allRestaurants) warn(`Some results don't match restaurant subtype filter`);
      break;
    }
  }

  sec('Search Response Shape');
  const shapeR = await fetch(`${BASE}${searchRoute}?${searchParam}=beach`);
  if (shapeR.ok) {
    const d = await shapeR.json();
    const results = d?.entities || d?.businesses || d?.results || d || [];
    if (Array.isArray(results) && results.length > 0) {
      const item = results[0];
      const fields = ['name','slug','entity_subtype','hero_image_url','address_line_1','city'];
      const present = fields.filter(f => f in item);
      const missing = fields.filter(f => !(f in item));
      ok(`Search result has fields: ${present.join(', ')}`);
      if (missing.length > 0) warn(`Search result missing fields: ${missing.join(', ')}`);
    }
  }

  sec('Search XSS Safety');
  const xssR = await fetch(`${BASE}${searchRoute}?${searchParam}=${encodeURIComponent('<script>alert(1)</script>')}`);
  if (!xssR.ok) {
    ok(`XSS search attempt rejected: ${xssR.status}`);
  } else {
    const d = await xssR.json();
    const text = JSON.stringify(d);
    if (text.includes('<script>')) fail('XSS payload echoed back in response — sanitize search input');
    else ok('XSS search: payload not echoed back in response');
  }

  sec('Client-Side Search (if server search not implemented)');
  // Check if the full entities list supports client-side search pattern
  const fullR = await fetch(`${BASE}/api/gcr/entities?limit=500`);
  if (fullR.ok) {
    const d = await fullR.json();
    const entities = d?.entities || d?.businesses || [];
    const searchFields = ['name','description','tags','entity_subtype','address_line_1','city'];
    const withSearchableData = entities.filter(e => searchFields.some(f => e[f]));
    ok(`${withSearchableData.length}/${entities.length} entities have searchable data fields`);
    const withTags = entities.filter(e => e.tags && e.tags.length > 0);
    ok(`${withTags.length}/${entities.length} entities have tags for tag-based filtering`);
  }

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR search audit: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
Search route: ${searchRoute || 'NOT FOUND — client-side only'}.
Issues: ${[...failed,...warned].join(' | ')}
For a local discovery platform, what's the minimum viable search needed at launch?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); process.exit(1); });
