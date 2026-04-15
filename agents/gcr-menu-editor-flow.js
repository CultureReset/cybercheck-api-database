#!/usr/bin/env node
// gcr-menu-editor-flow.js — Tests menu editor with daily links integration
// Tests: load menu editor data, add/edit sections, save, verify QR menu appears
// Usage: node agents/gcr-menu-editor-flow.js

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
  console.log(`\n${B}GCR Menu Editor Flow Test${X}`);
  console.log(`${D}Target: ${BASE}${X}`);
  console.log(`${D}Time:   ${new Date().toLocaleString()}${X}\n`);

  // ── GENERATE DAILY LINK ───────────────────────────────────────────────────
  sec('Generate Daily Link for Menu Editing');

  const testEntityId = `test-menu-editor-${Date.now()}`;

  const genRes = await api('POST', '/api/update/generate', {
    entity_id: testEntityId,
    link_type: 'daily'
  }, ADMIN_KEY);

  if (!genRes.ok) {
    fail(`Generate daily link failed: ${genRes.status}`);
    process.exit(1);
  }

  const token = genRes.data?.token;
  const demoUrl = genRes.data?.url;

  if (!token) {
    fail('Generated link missing token');
    process.exit(1);
  }

  ok(`Daily link generated: ${token.slice(0, 15)}...`);
  log(`Demo URL: ${demoUrl?.slice(0, 70)}...`);

  // ── LOAD MENU DATA ────────────────────────────────────────────────────────
  sec('Load Menu Editor Data');

  const dataRes = await api('GET', `/api/update/${token}/data`, null, null);

  if (!dataRes.ok) {
    fail(`Load menu data failed: ${dataRes.status}`);
  } else {
    const data = dataRes.data;
    ok('Menu data loaded');

    if (data.entity) {
      ok(`Entity: ${data.entity.name}`);
      log(`  ID: ${data.entity.id}`);
      log(`  Slug: ${data.entity.slug}`);
    }

    if (data.sections) {
      ok(`${data.sections.length} existing sections`);
      data.sections.slice(0, 2).forEach((sec, i) => {
        log(`  [${i+1}] ${sec.section_name}: ${sec.items?.length || 0} items`);
      });
    } else {
      warn('No sections loaded');
    }

    if (data.menu_items) {
      ok(`${data.menu_items.length} menu items available`);
    }
  }

  // ── SAVE MENU UPDATE ──────────────────────────────────────────────────────
  sec('Save Menu Update');

  const updatePayload = {
    sections: [
      {
        section_name: 'Appetizers',
        items: [
          {
            item_name: 'Test Appetizer',
            description: 'A delicious test appetizer',
            price: '8.99',
            is_available: true
          }
        ]
      },
      {
        section_name: 'Main Courses',
        items: [
          {
            item_name: 'Test Entree',
            description: 'A great main course',
            price: '16.99',
            is_available: true
          }
        ]
      }
    ],
    updated_at: new Date().toISOString()
  };

  const saveRes = await api('PUT', `/api/update/${token}/menu`, updatePayload, null);

  if (!saveRes.ok) {
    fail(`Save menu update failed: ${saveRes.status}`);
    if (saveRes.data?.error) log(`  Error: ${saveRes.data.error}`);
  } else {
    ok('Menu update saved successfully');
    if (saveRes.data?.sections) {
      ok(`${saveRes.data.sections.length} sections saved`);
    }
  }

  // ── VERIFY QR MENU CREATED ────────────────────────────────────────────────
  sec('Verify QR Menu Created');

  // Wait a moment for the menu to be created
  await new Promise(r => setTimeout(r, 500));

  const menuCheckRes = await api('GET', `/api/gcr/entity/${testEntityId}`, null, null);

  if (menuCheckRes.ok) {
    const entity = menuCheckRes.data;
    ok('Entity accessible via public API');

    if (entity.sections) {
      ok(`${entity.sections.length} sections in public API`);
    } else {
      warn('No sections found in public entity data');
    }

    if (entity.has_menu) {
      ok('Entity marked as has_menu');
    } else {
      log('Entity has_menu flag not set');
    }
  } else {
    warn(`Could not verify entity via public API: ${menuCheckRes.status}`);
  }

  // ── TEST DASHBOARD TRACKING ───────────────────────────────────────────────
  sec('Verify Dashboard Tracking');

  const todayRes = await api('GET', '/api/update/today', null, ADMIN_KEY);

  if (!todayRes.ok) {
    warn(`Could not fetch today's links: ${todayRes.status}`);
  } else {
    const links = todayRes.data;
    const testLink = Array.isArray(links)
      ? links.find(l => l.token === token)
      : null;

    if (testLink) {
      ok(`Link found in dashboard`);
      log(`  Created: ${new Date(testLink.created_at).toLocaleTimeString()}`);
      if (testLink.opened_at) log(`  Opened: ${new Date(testLink.opened_at).toLocaleTimeString()}`);
      if (testLink.submitted_at) log(`  Submitted: ${new Date(testLink.submitted_at).toLocaleTimeString()}`);
    } else {
      warn('Link not found in today\'s links (might need to refresh)');
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
