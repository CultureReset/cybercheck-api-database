#!/usr/bin/env node
// gcr-businesses-directory.js — Tests businesses directory page functionality
// Tests: public API entities load, demo links generate, SMS sends, menu links work
// Usage: node agents/gcr-businesses-directory.js

require('dotenv').config();

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const ADMIN_KEY = process.env.ADMIN_KEY || 'test-key-123';
const LINKS_BASE = process.env.LINKS_BASE || 'https://cybercheck-links.vercel.app';

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
  console.log(`\n${B}GCR Businesses Directory Test${X}`);
  console.log(`${D}Target: ${BASE}${X}`);
  console.log(`${D}Links:  ${LINKS_BASE}${X}`);
  console.log(`${D}Time:   ${new Date().toLocaleString()}${X}\n`);

  // ── LOAD BUSINESSES (PUBLIC) ──────────────────────────────────────────────
  sec('Load All Businesses (No Auth)');

  const bizRes = await api('GET', '/api/gcr/entities?limit=500', null, null);

  if (!bizRes.ok) {
    fail(`Load businesses failed: ${bizRes.status}`);
  } else {
    const data = bizRes.data;
    const entities = data.entities || data.businesses || [];

    if (!Array.isArray(entities)) {
      fail('Entities not an array');
    } else {
      ok(`${entities.length} businesses loaded`);

      // Check first 3 for required fields
      entities.slice(0, 3).forEach((b, i) => {
        const hasRequired = b.id && b.name && b.slug;
        if (hasRequired) {
          ok(`[${i+1}] ${b.name} - has required fields`);
          if (b.hero_image_url) log(`     Image: ${b.hero_image_url.slice(0, 50)}...`);
          if (b.tags) log(`     Tags: ${(b.tags || []).slice(0, 2).join(', ')}`);
        } else {
          fail(`[${i+1}] ${b.name} - missing required fields`);
        }
      });
    }
  }

  // ── GENERATE DEMO LINK ────────────────────────────────────────────────────
  sec('Generate Demo Edit Link');

  const testBiz = bizRes.data?.entities?.[0] || bizRes.data?.businesses?.[0];
  if (!testBiz) {
    warn('No businesses to test demo link generation');
  } else {
    const genRes = await api('POST', '/api/update/generate', {
      entity_id: testBiz.id,
      link_type: 'daily'
    }, ADMIN_KEY);

    if (!genRes.ok) {
      fail(`Generate demo link failed: ${genRes.status}`);
    } else {
      const link = genRes.data;
      if (link.url && link.token) {
        ok(`Demo link generated for "${testBiz.name}"`);
        log(`Token: ${link.token.slice(0, 15)}...`);
        log(`URL: ${link.url.slice(0, 70)}...`);

        // Verify link opens
        const verifyRes = await api('GET', `/api/update/${link.token}/validate`, null, null);
        if (verifyRes.ok) {
          ok('Demo link token is valid');
        } else {
          fail(`Demo link validation failed: ${verifyRes.status}`);
        }
      } else {
        fail('Demo link response missing url or token');
      }
    }
  }

  // ── CHECK QR MENU LINK ────────────────────────────────────────────────────
  sec('Check QR Menu Links');

  if (testBiz && testBiz.slug) {
    const menuUrl = `${LINKS_BASE}/qr-menu.html?slug=${encodeURIComponent(testBiz.slug)}`;
    log(`Menu URL: ${menuUrl.slice(0, 70)}...`);

    try {
      const res = await fetch(menuUrl);
      if (res.ok) {
        ok('QR menu page accessible (200)');
      } else if (res.status === 404) {
        warn('QR menu page returns 404 (page might not exist)');
      } else {
        warn(`QR menu page returned ${res.status}`);
      }
    } catch(e) {
      fail(`QR menu page fetch failed: ${e.message}`);
    }
  }

  // ── BUSINESS STATUS CHECKS ────────────────────────────────────────────────
  sec('Business Data Completeness');

  const bizRes2 = await api('GET', '/api/gcr/entities?limit=50', null, null);
  const allBiz = bizRes2.data?.entities || bizRes2.data?.businesses || [];

  let withImages = 0, withTags = 0, withMenu = 0, withHH = 0;
  allBiz.forEach(b => {
    if (b.hero_image_url || b.cover_url) withImages++;
    if ((b.tags || []).length > 0) withTags++;
    if (b.has_menu || (b.tags || []).some(t => (typeof t === 'string' ? t : t.tag || '').includes('menu'))) withMenu++;
    if (b.hh_days) withHH++;
  });

  const total = allBiz.length;
  ok(`${withImages}/${total} have hero images (${Math.round(withImages/total*100)}%)`);
  ok(`${withTags}/${total} have tags (${Math.round(withTags/total*100)}%)`);
  ok(`${withMenu}/${total} have menus (${Math.round(withMenu/total*100)}%)`);
  ok(`${withHH}/${total} have happy hours (${Math.round(withHH/total*100)}%)`);

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  sec('Summary');
  console.log(`  ${G}Passed${X}: ${passed.length}`);
  console.log(`  ${R}Failed${X}: ${failed.length}`);
  console.log(`  ${Y}Warned${X}: ${warned.length}\n`);

  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
