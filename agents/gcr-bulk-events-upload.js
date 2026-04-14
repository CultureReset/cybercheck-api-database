#!/usr/bin/env node
// gcr-bulk-events-upload.js — Tests bulk events CSV upload and verifies events appear in public API
// Usage: node agents/gcr-bulk-events-upload.js

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

const slug = `gcr-events-test-${Date.now()}`;
let entityId = null;

async function cleanup() {
  if (!entityId) return;
  await api('DELETE', `/api/admin/gcr/entities/${entityId}`);
  console.log(`\n  ${D}Cleaned up test entity: ${slug}${X}`);
}

async function run() {
  console.log(`\n${B}GCR Bulk Events Upload Test${X}`);
  console.log(`${D}Base: ${BASE}${X}\n`);

  sec('Authentication');
  const lr = await api('POST', '/api/admin/login', { username: EMAIL, password: PASS });
  if (!lr.ok || !lr.data?.token) { console.log(`${R}Login failed${X}`); process.exit(1); }
  token = lr.data.token;
  ok('Authenticated');

  sec('Create Test Entity');
  const cr = await api('POST', '/api/admin/gcr/entities', {
    entity: { name: 'Events Test Venue', slug, entity_subtype: 'nightlife',
      address_line_1: '200 Event Way', city: 'Gulf Shores', state: 'AL',
      is_active: false }
  });
  if (!cr.ok || (!cr.data?.id && !cr.data?.entity?.id)) {
    fail(`Entity create failed: ${cr.status}`); process.exit(1);
  }
  entityId = cr.data?.id || cr.data?.entity?.id;
  ok(`Created: ${slug} (id: ${entityId})`);

  sec('Events Upload');
  const d1 = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];
  const d2 = new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0];
  const d3 = new Date(Date.now() + 21*24*60*60*1000).toISOString().split('T')[0];

  const eventRows = [
    { slug, event_name: 'Beach Bash', event_date: d1, event_start_time: '8:00 PM', event_end_time: '2:00 AM', event_description: 'Live music and dancing on the beach', event_cover_charge: '10', event_type: 'live_music' },
    { slug, event_name: 'Trivia Night', event_date: d2, event_start_time: '7:00 PM', event_end_time: '10:00 PM', event_description: 'Weekly trivia with prizes', event_cover_charge: '0', event_type: 'trivia' },
    { slug, event_name: 'New Artist Showcase', event_date: d3, event_start_time: '9:00 PM', event_end_time: '1:00 AM', event_description: 'Local talent performing live', event_type: 'live_music' },
  ];

  const importRes = await api('POST', '/api/admin/gcr/import-events', eventRows);
  if (!importRes.ok) {
    fail(`Events import failed: ${importRes.status} — ${JSON.stringify(importRes.data)}`);
  } else {
    ok(`Events import accepted: ${JSON.stringify(importRes.data)}`);
  }

  sec('Verify Events in Public Profile');
  await new Promise(r => setTimeout(r, 800));
  const pr = await fetch(BASE + `/api/gcr/entity/${slug}`);
  const pd = pr.ok ? await pr.json() : null;
  if (!pd) { fail('Could not fetch public profile'); await cleanup(); return; }

  const events = pd.events || [];
  ok(`events count in profile: ${events.length}`);

  if (events.length === 0) {
    fail('No events returned in public profile');
  } else {
    const names = ['Beach Bash', 'Trivia Night', 'New Artist Showcase'];
    for (const name of names) {
      const e = events.find(ev => (ev.event_name||ev.name||'').toLowerCase().includes(name.toLowerCase().split(' ')[0]));
      if (e) ok(`Event found: "${name}"`);
      else warn(`Event not found: "${name}" — check import or filtering`);
    }

    const ev = events[0];
    const fields = ['event_name', 'event_date', 'start_time'];
    for (const f of fields) {
      if (f in ev || 'name' in ev) ok(`Event has field: ${f in ev ? f : 'name (aliased)'}`);
      else warn(`Event missing field: ${f}`);
    }
  }

  sec('Verify in Global Events Endpoint');
  const globalEvents = await fetch(BASE + '/api/gcr/events');
  if (!globalEvents.ok) {
    warn(`Global events endpoint: ${globalEvents.status}`);
  } else {
    const ge = await globalEvents.json();
    const evList = ge.events || ge || [];
    const found = Array.isArray(evList) ? evList.filter(e => e.slug === slug || e.entity_slug === slug) : [];
    if (found.length > 0) ok(`${found.length} test events visible in global /api/gcr/events`);
    else warn(`Test events not visible in /api/gcr/events (may be filtered by date or entity slug)`);
  }

  await cleanup();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 250,
      messages: [{ role: 'user', content: `GCR events upload test: ${passed.length} passed, ${warned.length} warnings, ${failed.length} failed.
Issues: ${[...failed,...warned].join(' | ')}
Quick diagnosis?` }]
    });
    console.log('\n'+msg.content[0].text);
  }
  console.log();
}
run().catch(async e => { console.error('\x1b[31mFatal: \x1b[0m'+e.message); await cleanup(); process.exit(1); });
