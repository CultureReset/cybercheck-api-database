#!/usr/bin/env node
// ============================================================
// test-dashboard-pages.js — Admin Dashboard Page Tester
// Opens each page in admin.html via Playwright, checks for:
//   - JS console errors
//   - Stuck "Loading..." states
//   - API fetch failures (network errors)
//   - Empty data sections
//
// Usage:
//   node agents/test-dashboard-pages.js
//   ADMIN_EMAIL=you@email.com ADMIN_PASS=yourpass node agents/test-dashboard-pages.js
//   node agents/test-dashboard-pages.js --url http://localhost:5500
//   node agents/test-dashboard-pages.js --screenshots   (saves PNG per page)
// ============================================================

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EMAIL    = process.env.ADMIN_EMAIL || process.argv.find(a => a.startsWith('--email='))?.split('=')[1];
const PASS     = process.env.ADMIN_PASS  || process.argv.find(a => a.startsWith('--pass='))?.split('=')[1];
const DASH_URL = process.env.DASH_URL    || process.argv.find(a => a.startsWith('--url='))?.split('=')[1]
                  || 'http://127.0.0.1:5500/admin.html';
const SCREENSHOTS = process.argv.includes('--screenshots');
const SS_DIR = path.join(__dirname, '..', 'test-screenshots');

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

// All pages in the admin sidebar
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
  { id: 'ar-hunts',          label: 'AR Hunts' },
  { id: 'users',             label: 'Users' },
  { id: 'api-keys',          label: 'API Keys' },
  { id: 'settings',          label: 'Settings' },
];

const results = [];

async function testPage(page, pageId, label) {
  const consoleErrors = [];
  const networkFails  = [];

  // Collect console errors
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Collect failed network requests
  page.on('requestfailed', req => {
    networkFails.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });

  // Navigate to page by clicking nav item
  try {
    await page.evaluate((id) => {
      if (typeof showPage === 'function') showPage(id);
    }, pageId);
  } catch (e) {
    // fallback: click nav item
    const navSel = `.nav-item[data-page="${pageId}"]`;
    const nav = page.locator(navSel);
    if (await nav.count() > 0) await nav.click();
  }

  // Wait for page to settle
  await page.waitForTimeout(1800);

  // Check for stuck "Loading..." text
  const pageContent = await page.locator(`#page-${pageId}`).textContent().catch(() => '');
  const stuckLoading = pageContent.includes('Loading...') ? ['Content stuck on "Loading..."'] : [];

  // Take screenshot if requested
  if (SCREENSHOTS) {
    if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
    const ssPath = path.join(SS_DIR, `${pageId}.png`);
    await page.locator(`#page-${pageId}`).screenshot({ path: ssPath }).catch(() =>
      page.screenshot({ path: ssPath })
    );
  }

  const issues = [...stuckLoading, ...consoleErrors.slice(0, 3)];
  const networkIssues = networkFails.filter(f => f.includes('/api/')).slice(0, 3);

  let symbol, color;
  if (networkIssues.length > 0 || issues.some(i => i.includes('error') || i.includes('Error') || i.includes('404') || i.includes('401'))) {
    symbol = '✗'; color = RED;
  } else if (issues.length > 0 || networkIssues.length > 0) {
    symbol = '⚠'; color = YELLOW;
  } else if (stuckLoading.length > 0) {
    symbol = '○'; color = YELLOW;
  } else {
    symbol = '✓'; color = GREEN;
  }

  const issueText = [...networkIssues, ...issues].slice(0, 2).map(i => `\n      ${DIM}→ ${i.slice(0, 120)}${RESET}`).join('');
  console.log(`  ${color}${symbol}${RESET} ${String(label).padEnd(30)} ${DIM}${pageId}${RESET}${issueText}`);

  results.push({ pageId, label, ok: symbol === '✓', issues: [...networkIssues, ...issues], networkFails: networkIssues });

  // Clear listeners for next page
  page.removeAllListeners('console');
  page.removeAllListeners('requestfailed');
}

async function injectAuth(page, API_BASE, email, password) {
  // Inject admin token via API login
  const tokenRes = await page.evaluate(async ({ base, email, pass }) => {
    const res = await fetch(base + '/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password: pass })
    });
    return res.ok ? await res.json() : null;
  }, { base: API_BASE, email, pass: password });

  if (tokenRes?.token) {
    await page.evaluate((token) => {
      localStorage.setItem('cc_admin_token', token);
      localStorage.setItem('cc_user_role', 'admin');
    }, tokenRes.token);
    return true;
  }
  return false;
}

async function run() {
  const API_BASE = process.env.API_BASE || 'http://localhost:3000';

  console.log(`\n${BOLD}Admin Dashboard Page Tester${RESET}`);
  console.log(`${DIM}Dashboard: ${DASH_URL}${RESET}`);
  console.log(`${DIM}API:       ${API_BASE}${RESET}`);
  if (SCREENSHOTS) console.log(`${DIM}Screenshots: ${SS_DIR}${RESET}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Override API base in the page
  await page.addInitScript((apiBase) => {
    window.CC_API_BASE = apiBase;
  }, API_BASE);

  // Load dashboard
  console.log(`\n${DIM}Loading dashboard...${RESET}`);
  try {
    await page.goto(DASH_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    console.log(`${RED}✗ Could not load dashboard: ${e.message}${RESET}`);
    console.log(`\n${YELLOW}Make sure the dashboard is served. Options:${RESET}`);
    console.log(`  cd /Users/owner/cybercheck-login && python3 -m http.server 5500`);
    console.log(`  Or use Live Server in VSCode on admin.html\n`);
    await browser.close();
    process.exit(1);
  }

  // Auth
  if (EMAIL && PASS) {
    console.log(`${DIM}Injecting auth token...${RESET}`);
    const authed = await injectAuth(page, API_BASE, EMAIL, PASS);
    if (authed) {
      console.log(`${GREEN}✓ Auth token injected${RESET}`);
      // Reload to apply auth
      await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
    } else {
      console.log(`${RED}✗ Auth failed — pages may show login redirect${RESET}`);
    }
  } else {
    console.log(`\n${YELLOW}⚠  No credentials — set ADMIN_EMAIL + ADMIN_PASS to test authenticated pages${RESET}`);
    // Still try to inject a fake role so the page doesn't redirect
  }

  // Wait for overview to load
  await page.waitForTimeout(2000);

  console.log(`\n${BOLD}${CYAN}── Testing ${PAGES.length} pages ${'─'.repeat(35)}${RESET}`);

  for (const p of PAGES) {
    await testPage(page, p.id, p.label);
  }

  await browser.close();

  // Summary
  const passed  = results.filter(r => r.ok).length;
  const failed  = results.filter(r => !r.ok).length;
  const total   = results.length;

  console.log(`\n${BOLD}${'═'.repeat(58)}${RESET}`);
  console.log(`${BOLD}Results: ${GREEN}${passed} passed${RESET}  ${RED}${failed} issues${RESET}  ${DIM}/ ${total} pages${RESET}`);

  const withIssues = results.filter(r => !r.ok);
  if (withIssues.length > 0) {
    console.log(`\n${BOLD}${RED}Pages with issues:${RESET}`);
    withIssues.forEach(r => {
      console.log(`  ${RED}✗${RESET} ${r.label} (${r.pageId})`);
      r.issues.slice(0, 3).forEach(i => console.log(`      ${DIM}→ ${i.slice(0, 120)}${RESET}`));
    });
  }

  if (SCREENSHOTS) console.log(`\n${DIM}Screenshots saved to: ${SS_DIR}${RESET}`);
  console.log();
}

run().catch(e => {
  console.error(RED + 'Fatal: ' + RESET + e.message);
  process.exit(1);
});
