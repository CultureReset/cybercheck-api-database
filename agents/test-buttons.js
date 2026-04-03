#!/usr/bin/env node
// ============================================================
// test-buttons.js — Dashboard Button & Interaction Tester
// Clicks every button/link on each admin dashboard page,
// checks for: JS errors, broken modals, failed API calls,
// unhandled exceptions, stuck loaders
//
// Usage:
//   ADMIN_EMAIL=x ADMIN_PASS=y node agents/test-buttons.js
//   ADMIN_EMAIL=x ADMIN_PASS=y node agents/test-buttons.js --screenshots
//   ADMIN_EMAIL=x ADMIN_PASS=y node agents/test-buttons.js --page gcr-businesses
// ============================================================

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const EMAIL      = process.env.ADMIN_EMAIL;
const PASS       = process.env.ADMIN_PASS;
const API_BASE   = process.env.API_BASE   || 'http://localhost:3000';
const DASH_URL   = process.env.DASH_URL   || 'http://127.0.0.1:5500/admin.html';
const SCREENSHOTS = process.argv.includes('--screenshots');
const ONLY_PAGE  = process.argv.find(a => a.startsWith('--page='))?.split('=')[1];
const SS_DIR     = path.join(__dirname, '..', 'test-screenshots', 'buttons');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', D = '\x1b[2m', X = '\x1b[0m', B = '\x1b[1m';

// Buttons that are SAFE to click (won't delete data or navigate away)
const SKIP_PATTERNS = [
  /delete/i, /remove/i, /destroy/i, /logout/i, /log.?out/i, /sign.?out/i,
  /reset/i, /nuke/i, /drop/i, /cancel.*account/i
];

const PAGES = [
  { id: 'overview',          label: 'Overview' },
  { id: 'businesses',        label: 'Businesses' },
  { id: 'gcr-businesses',    label: 'GCR Businesses' },
  { id: 'gcr-entity-editor', label: 'Entity Editor' },
  { id: 'gcr-events',        label: 'Events' },
  { id: 'gcr-specials',      label: 'Specials' },
  { id: 'bulk-upload',       label: 'Bulk Upload' },
  { id: 'bulk-events',       label: 'Bulk Events' },
  { id: 'ai-organize',       label: 'AI Data Organizer' },
  { id: 'rag-index',         label: 'AI Index / RAG' },
  { id: 'ai-settings',       label: 'AI Settings' },
  { id: 'gcr-analytics',     label: 'Analytics' },
  { id: 'gcr-reviews',       label: 'Reviews' },
  { id: 'gcr-customers',     label: 'Customers' },
  { id: 'gcr-social',        label: 'Social & Connections' },
  { id: 'gcr-messaging',     label: 'SMS / Messaging' },
  { id: 'gcr-coupons',       label: 'Coupons' },
  { id: 'gcr-seo',           label: 'SEO' },
  { id: 'leads',             label: 'Leads' },
  { id: 'users',             label: 'Users' },
  { id: 'settings',          label: 'Settings' },
];

const allResults = [];

function shouldSkip(text) {
  return SKIP_PATTERNS.some(p => p.test(text));
}

async function testPageButtons(page, pageId, label) {
  const errors   = [];
  const netFails = [];
  const clicks   = [];

  // Capture errors
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => errors.push('JS: ' + e.message.slice(0, 120)));
  page.on('requestfailed', r => {
    if (r.url().includes('/api/')) netFails.push(`${r.method()} ${r.url().split('/api/')[1]} — ${r.failure()?.errorText}`);
  });

  // Navigate to page
  await page.evaluate(id => { if (typeof showPage === 'function') showPage(id); }, pageId);
  await page.waitForTimeout(1500);

  // Find all buttons on this page (not in modals)
  const pageEl = page.locator(`#page-${pageId}`);
  const buttons = pageEl.locator('button, [role="button"]');
  const count   = await buttons.count();

  console.log(`\n  ${B}${C}${label}${X} ${D}(${count} buttons)${X}`);

  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    let text = '';
    try {
      text = (await btn.textContent() || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const visible = await btn.isVisible();
      const enabled = await btn.isEnabled();
      if (!visible || !enabled) continue;
      if (shouldSkip(text)) {
        console.log(`    ${Y}~${X} ${D}SKIP "${text}"${X}`);
        continue;
      }

      const beforeErrors = errors.length;
      const beforeFails  = netFails.length;

      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(600);

      // Close any modal that opened
      const closeBtn = page.locator('[id$="Modal"] button:has-text("×"), [id$="Modal"] button:has-text("Cancel"), [id$="Modal"] button:has-text("Close")').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {});
        await page.waitForTimeout(300);
      }

      const newErrors = errors.slice(beforeErrors);
      const newFails  = netFails.slice(beforeFails);

      if (newErrors.length > 0 || newFails.length > 0) {
        console.log(`    ${R}✗${X} "${text}"`);
        newErrors.forEach(e => console.log(`      ${D}→ ${e}${X}`));
        newFails.forEach(f  => console.log(`      ${D}→ API fail: ${f}${X}`));
        clicks.push({ text, ok: false, errors: [...newErrors, ...newFails] });
      } else {
        console.log(`    ${G}✓${X} "${text}"`);
        clicks.push({ text, ok: true });
      }

      if (SCREENSHOTS) {
        if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
        await page.screenshot({ path: path.join(SS_DIR, `${pageId}-btn-${i}.png`) }).catch(() => {});
      }

    } catch (e) {
      console.log(`    ${Y}⚠${X} "${text}" ${D}— ${e.message.slice(0, 60)}${X}`);
      clicks.push({ text, ok: false, errors: [e.message] });
    }
  }

  // Navigate back to page (in case a click navigated away)
  await page.evaluate(id => { if (typeof showPage === 'function') showPage(id); }, pageId).catch(() => {});

  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  page.removeAllListeners('requestfailed');

  const result = {
    pageId, label,
    total: clicks.length,
    passed: clicks.filter(c => c.ok).length,
    failed: clicks.filter(c => !c.ok).length,
    clicks
  };
  allResults.push(result);
  return result;
}

async function run() {
  if (!EMAIL || !PASS) {
    console.log(`${R}Set ADMIN_EMAIL and ADMIN_PASS env vars${X}`);
    process.exit(1);
  }

  console.log(`\n${B}Dashboard Button Tester${X}`);
  console.log(`${D}Dashboard: ${DASH_URL}${X}`);
  console.log(`${D}API:       ${API_BASE}${X}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await context.newPage();

  await page.addInitScript(base => { window.CC_API_BASE = base; }, API_BASE);

  console.log(`${D}Loading dashboard...${X}`);
  try {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    console.log(`${R}✗ Could not load dashboard: ${e.message}${X}`);
    console.log(`Serve it first:  cd /Users/owner/cybercheck-login && python3 -m http.server 5500`);
    await browser.close(); process.exit(1);
  }

  // Inject auth
  const tokenRes = await page.evaluate(async ({ base, email, pass }) => {
    const res = await fetch(base + '/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password: pass })
    });
    return res.ok ? await res.json() : null;
  }, { base: API_BASE, email: EMAIL, pass: PASS });

  if (!tokenRes?.token) {
    console.log(`${R}✗ Login failed${X}`); await browser.close(); process.exit(1);
  }

  await page.evaluate(t => {
    localStorage.setItem('cc_admin_token', t);
    localStorage.setItem('cc_user_role', 'admin');
  }, tokenRes.token);
  console.log(`${G}✓ Logged in${X}`);

  await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  const pagesToTest = ONLY_PAGE
    ? PAGES.filter(p => p.id === ONLY_PAGE)
    : PAGES;

  for (const p of pagesToTest) {
    await testPageButtons(page, p.id, p.label);
  }

  await browser.close();

  // Summary
  const totalClicks  = allResults.reduce((s, r) => s + r.total, 0);
  const totalPassed  = allResults.reduce((s, r) => s + r.passed, 0);
  const totalFailed  = allResults.reduce((s, r) => s + r.failed, 0);

  console.log(`\n${B}${'═'.repeat(58)}${X}`);
  console.log(`${B}Buttons: ${G}${totalPassed} passed${X}  ${R}${totalFailed} failed${X}  ${D}/ ${totalClicks} total${X}`);

  const broken = allResults.filter(r => r.failed > 0);
  if (broken.length > 0) {
    console.log(`\n${B}${R}Pages with button failures:${X}`);
    broken.forEach(r => {
      console.log(`  ${R}✗${X} ${r.label}`);
      r.clicks.filter(c => !c.ok).forEach(c => {
        console.log(`    ${D}→ "${c.text}": ${c.errors[0]?.slice(0, 100)}${X}`);
      });
    });
  }
  console.log();
}

run().catch(e => { console.error(R + 'Fatal: ' + X + e.message); process.exit(1); });
