#!/usr/bin/env node
// gcr-ai-menu-scan.js — Tests AI menu scan feature (photo → Grok parsing → QR menu)
// Tests: /setup/parse-image endpoint with test image, /setup/create for menu creation
// Usage: node agents/gcr-ai-menu-scan.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const BASE = process.env.API_BASE || 'https://cybercheck-api-database.vercel.app';
const ADMIN_KEY = process.env.ADMIN_KEY || 'test-key-123';

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}━━ ${t} ${'━'.repeat(Math.max(0,52-t.length))}${X}`);}
function log(m){console.log(`  ${D}${m}${X}`);}

async function api(method, path, body, token, headers = {}) {
  const h = { ...headers };
  if (token) h['Authorization'] = 'Bearer ' + token;
  try {
    const opts = { method, headers: h };
    if (body instanceof FormData) {
      delete h['Content-Type'];
      opts.body = body;
    } else if (body) {
      h['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    opts.headers = h;

    const res = await fetch(BASE + path, opts);
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data, ok: res.status < 400 };
  } catch(e) {
    return { status: 0, data: null, ok: false, error: e.message };
  }
}

async function run() {
  console.log(`\n${B}GCR AI Menu Scan Test${X}`);
  console.log(`${D}Target: ${BASE}${X}`);
  console.log(`${D}Time:   ${new Date().toLocaleString()}${X}\n`);

  // ── PARSE IMAGE WITH GROK ────────────────────────────────────────────────
  sec('Parse Menu Image with AI');

  // Test with a data URL (minimal 1x1 transparent PNG for testing)
  const testImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  const parseRes = await api('POST', '/api/setup/parse-image', {
    image_data_url: testImageDataUrl,
    entity_id: 'test-entity-scan-001'
  }, ADMIN_KEY);

  if (!parseRes.ok) {
    fail(`Parse image failed: ${parseRes.status}`);
    if (parseRes.data?.error) log(`Error: ${parseRes.data.error}`);
  } else {
    const result = parseRes.data;
    ok('Image parsing initiated');

    if (result.sections) {
      ok(`Parsed ${result.sections.length} sections`);
      result.sections.slice(0, 2).forEach((sec, i) => {
        log(`  [${i+1}] ${sec.section_name}: ${sec.items?.length || 0} items`);
      });
    } else if (result.error) {
      warn(`Parse returned error: ${result.error}`);
    } else {
      warn('No sections in parse result (might be processing)');
    }

    // ── CREATE QR MENU ────────────────────────────────────────────────────
    if (result.sections && result.sections.length > 0) {
      sec('Create QR Menu from Parsed Data');

      const createRes = await api('POST', '/api/setup/create', {
        entity_id: 'test-entity-scan-001',
        entity_name: 'Test Scan Restaurant',
        sections: result.sections,
        slug: `test-scan-${Date.now()}`
      }, ADMIN_KEY);

      if (!createRes.ok) {
        fail(`Create menu failed: ${createRes.status}`);
        if (createRes.data?.error) log(`Error: ${createRes.data.error}`);
      } else {
        ok('QR menu created');
        if (createRes.data.qr_url) ok(`QR URL: ${createRes.data.qr_url.slice(0, 60)}...`);
        if (createRes.data.slug) ok(`Menu accessible at: ${createRes.data.slug}`);
      }
    }
  }

  // ── TEST ENDPOINT HEALTH ──────────────────────────────────────────────────
  sec('Endpoint Health');

  const healthRes = await api('GET', '/api/setup/parse-image', null, ADMIN_KEY);
  if (healthRes.status === 405 || healthRes.status === 400) {
    ok('Parse endpoint exists (GET not supported, expected)');
  } else if (healthRes.ok) {
    warn('Parse endpoint responded to GET (should be POST only)');
  } else {
    fail(`Parse endpoint health check failed: ${healthRes.status}`);
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  sec('Summary');
  console.log(`  ${G}Passed${X}: ${passed.length}`);
  console.log(`  ${R}Failed${X}: ${failed.length}`);
  console.log(`  ${Y}Warned${X}: ${warned.length}\n`);

  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
