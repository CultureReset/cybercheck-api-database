#!/usr/bin/env node
// gcr-daily-links-flow.js — Tests daily update links end-to-end flow
// Tests: generate link, verify token, mark submitted/opened, fetch today's links
// Usage: node agents/gcr-daily-links-flow.js

require('dotenv').config();

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const ADMIN_KEY = process.env.ADMIN_KEY || 'test-key-123';

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}━━ ${t} ${'━'.repeat(Math.max(0,52-t.length))}${X}`);}
function log(m){console.log(`  ${D}${m}${X}`);}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data, ok: res.status < 400 };
  } catch(e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

async function run() {
  console.log(`\n${B}GCR Daily Links Flow Test${X}`);
  console.log(`${D}Target: ${BASE}${X}`);
  console.log(`${D}Time:   ${new Date().toLocaleString()}${X}\n`);

  // ── GENERATE LINK ─────────────────────────────────────────────────────────
  sec('Generate Daily Link');

  const genRes = await api('POST', '/api/update/generate', {
    entity_id: 'test-entity-001',
    link_type: 'daily'
  }, ADMIN_KEY);

  if (!genRes.ok) {
    fail(`Generate link failed: ${genRes.status}`);
  } else {
    const link = genRes.data;
    if (!link.url || !link.token) {
      fail('Generated link missing url or token');
    } else {
      ok(`Link generated: ${link.token.slice(0, 10)}...`);
      log(`URL: ${link.url.slice(0, 60)}...`);

      // ── VALIDATE TOKEN ────────────────────────────────────────────────────
      sec('Validate Token');

      const validateRes = await api('GET', `/api/update/${link.token}/validate`, null, null);

      if (!validateRes.ok) {
        fail(`Token validation failed: ${validateRes.status}`);
      } else {
        ok('Token is valid');
        if (validateRes.data.entity_id) ok(`Entity ID matched: ${validateRes.data.entity_id}`);
      }

      // ── LOAD LINK DATA ────────────────────────────────────────────────────
      sec('Load Link Data (marks opened_at)');

      const dataRes = await api('GET', `/api/update/${link.token}/data`, null, null);

      if (!dataRes.ok) {
        fail(`Load link data failed: ${dataRes.status}`);
      } else {
        const data = dataRes.data;
        ok('Link data loaded');
        if (data.entity) ok(`Entity loaded: ${data.entity.name}`);
        if (data.sections) ok(`Sections present: ${data.sections.length}`);
        if (data.menu_items) ok(`Menu items: ${data.menu_items.length}`);
      }

      // ── SUBMIT MENU UPDATE ────────────────────────────────────────────────
      sec('Submit Menu Update');

      const submitRes = await api('PUT', `/api/update/${link.token}/menu`, {
        sections: [{ section_name: 'Test Section', items: [] }],
        updated_at: new Date().toISOString()
      }, null);

      if (!submitRes.ok) {
        fail(`Submit menu failed: ${submitRes.status}`);
      } else {
        ok('Menu update submitted (marks submitted_at)');
      }
    }
  }

  // ── FETCH TODAY'S LINKS (ADMIN) ────────────────────────────────────────
  sec('Fetch Today\'s Links (Admin Dashboard)');

  const todayRes = await api('GET', '/api/update/today', null, ADMIN_KEY);

  if (!todayRes.ok) {
    fail(`Fetch today's links failed: ${todayRes.status}`);
  } else {
    const links = todayRes.data;
    if (!Array.isArray(links)) {
      fail('Today\'s links not an array');
    } else {
      ok(`${links.length} links today`);
      links.slice(0, 3).forEach((link, i) => {
        log(`[${i+1}] ${link.entity_name || 'Unknown'} - created ${new Date(link.created_at).toLocaleString()}`);
        if (link.submitted_at) log(`     ✓ Submitted ${new Date(link.submitted_at).toLocaleString()}`);
        if (link.opened_at) log(`     ✓ Opened ${new Date(link.opened_at).toLocaleString()}`);
      });
    }
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  sec('Summary');
  console.log(`  ${G}Passed${X}: ${passed.length}`);
  console.log(`  ${R}Failed${X}: ${failed.length}`);
  console.log(`  ${Y}Warned${X}: ${warned.length}\n`);

  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
