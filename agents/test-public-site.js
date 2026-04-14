#!/usr/bin/env node
// ============================================================
// test-public-site.js — Public GCR Site Full Tester
// Tests all pages, buttons, filters, links, and data rendering
// on the live public GCR site
//
// Usage:
//   node agents/test-public-site.js
//   node agents/test-public-site.js --url https://launching-gcr.vercel.app
//   node agents/test-public-site.js --screenshots
// ============================================================

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const SITE_URL   = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] || process.env.SITE_URL || 'https://launching-gcr.vercel.app';
const SCREENSHOTS = process.argv.includes('--screenshots');
const SS_DIR     = path.join(__dirname, '..', 'test-screenshots', 'public');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', D = '\x1b[2m', X = '\x1b[0m', B = '\x1b[1m';

// All known public pages
const PAGES = [
  { url: '/',                    label: 'Home' },
  { url: '/index.html',          label: 'Home (index.html)' },
  { url: '/happy-hours.html',    label: 'Happy Hours' },
  { url: '/events.html',         label: 'Events' },
  { url: '/specials.html',       label: 'Specials' },
  { url: '/things-to-do.html',   label: 'Things To Do' },
  { url: '/restaurants.html',    label: 'Restaurants' },
  { url: '/nightlife.html',      label: 'Nightlife' },
  { url: '/shopping.html',       label: 'Shopping' },
  { url: '/hotels.html',         label: 'Hotels' },
  { url: '/activities.html',     label: 'Activities' },
  { url: '/beaches.html',        label: 'Beaches' },
  { url: '/condos.html',         label: 'Condos' },
  { url: '/map.html',            label: 'Map' },
  { url: '/search.html',         label: 'Search' },
];

const SKIP_TEXT = [/sign.?out/i, /log.?out/i, /delete/i, /remove/i];

const allResults  = [];
const allBroken   = [];

function shouldSkip(text) { return SKIP_TEXT.some(p => p.test(text)); }

async function testPage(browser, pageUrl, label) {
  const errors   = [];
  const netFails = [];
  const apiFails = [];
  const clicks   = [];

  const page = await browser.newPage();
  page.on('console',       m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  page.on('pageerror',     e => errors.push('JS: ' + e.message.slice(0, 120)));
  page.on('requestfailed', r => {
    const url = r.url();
    if (url.includes('/api/')) apiFails.push(`${r.method()} ${url} — ${r.failure()?.errorText}`);
    else netFails.push(url);
  });

  const fullUrl = SITE_URL + pageUrl;
  let loaded = false;

  try {
    const res = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (res.status() === 404) {
      console.log(`  ${D}~${X} ${label} ${D}(404 — page doesn't exist, skipping)${X}`);
      await page.close();
      return;
    }
    loaded = true;
  } catch (e) {
    console.log(`  ${R}✗${X} ${label} ${D}— ${e.message.slice(0, 60)}${X}`);
    allBroken.push({ label, pageUrl, issue: e.message });
    await page.close();
    return;
  }

  await page.waitForTimeout(2500);

  if (SCREENSHOTS) {
    if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
    const name = pageUrl.replace(/\//g, '_').replace(/\.html$/, '') || 'home';
    await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: true }).catch(() => {});
  }

  // ── Check data loaded (not stuck on Loading...) ──
  const bodyText = await page.textContent('body').catch(() => '');
  const stuckLoading = (bodyText.match(/Loading\.\.\./g) || []).length;
  if (stuckLoading > 2) {
    console.log(`  ${Y}⚠${X} ${label} — ${stuckLoading} "Loading..." elements still showing`);
    allBroken.push({ label, pageUrl, issue: `${stuckLoading} stuck Loading... elements` });
  }

  // ── Check for empty sections that should have data ──
  const emptyCards = await page.locator('.card-empty, .no-results, [data-empty]').count().catch(() => 0);

  // ── Check images load ──
  const brokenImages = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img'))
      .filter(img => !img.complete || img.naturalWidth === 0)
      .map(img => img.src)
      .filter(src => src && !src.startsWith('data:'))
      .slice(0, 5);
  });

  // ── Check API calls succeeded ──
  if (apiFails.length > 0) {
    console.log(`  ${R}✗${X} ${B}${label}${X} — API failures:`);
    apiFails.forEach(f => console.log(`    ${D}→ ${f}${X}`));
    allBroken.push({ label, pageUrl, issue: apiFails.join('; ') });
  } else if (stuckLoading <= 2) {
    console.log(`  ${G}✓${X} ${label} loaded`);
  }

  if (brokenImages.length > 0) {
    console.log(`    ${Y}⚠${X} ${brokenImages.length} broken image(s):`);
    brokenImages.forEach(src => console.log(`      ${D}→ ${src.slice(0, 80)}${X}`));
    allBroken.push({ label, pageUrl, issue: `${brokenImages.length} broken images` });
  }

  // ── Test all buttons on page ──
  const buttons = page.locator('button:visible, [role="button"]:visible, .btn:visible, .tab-btn:visible, .filter-btn:visible, .filter-chip:visible, .category-tab:visible, .nav-link:visible');
  const btnCount = await buttons.count().catch(() => 0);

  if (btnCount > 0) {
    console.log(`    ${D}Testing ${btnCount} buttons/filters...${X}`);
    for (let i = 0; i < Math.min(btnCount, 30); i++) {
      const btn = buttons.nth(i);
      let text = '';
      try {
        text = (await btn.textContent() || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        if (!text || shouldSkip(text)) continue;

        const beforeErrors = errors.length;
        const beforeFails  = apiFails.length;

        await btn.click({ timeout: 3000, force: false }).catch(() => {});
        await page.waitForTimeout(500);

        const newErrors = errors.slice(beforeErrors);
        const newFails  = apiFails.slice(beforeFails);

        if (newErrors.length > 0 || newFails.length > 0) {
          console.log(`    ${R}✗${X} btn: "${text}"`);
          newErrors.forEach(e => console.log(`      ${D}→ ${e.slice(0, 100)}${X}`));
          newFails.forEach(f  => console.log(`      ${D}→ ${f.slice(0, 100)}${X}`));
          clicks.push({ text, ok: false });
          allBroken.push({ label, pageUrl, issue: `Button "${text}" — ${[...newErrors, ...newFails][0]?.slice(0, 80)}` });
        } else {
          clicks.push({ text, ok: true });
        }
      } catch (e) { /* skip unclickable */ }
    }
    const passed = clicks.filter(c => c.ok).length;
    const failed = clicks.filter(c => !c.ok).length;
    if (failed > 0) console.log(`    ${G}${passed} ok${X}  ${R}${failed} failed${X}`);
    else if (passed > 0) console.log(`    ${G}✓ All ${passed} buttons/filters OK${X}`);
  }

  // ── Test search if present ──
  const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    try {
      await searchInput.fill('beach');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      const resultsAfter = await page.textContent('body').catch(() => '');
      if (resultsAfter.includes('Loading...')) {
        console.log(`    ${Y}⚠${X} Search stuck on Loading...`);
        allBroken.push({ label, pageUrl, issue: 'Search stuck on Loading...' });
      } else {
        console.log(`    ${G}✓${X} Search works`);
      }
    } catch (e) {}
  }

  if (errors.length > 0 && apiFails.length === 0) {
    console.log(`    ${Y}⚠${X} ${errors.length} console error(s)`);
    errors.slice(0, 2).forEach(e => console.log(`      ${D}→ ${e.slice(0, 100)}${X}`));
  }

  allResults.push({ label, pageUrl, loaded, clicks, errors, apiFails });
  await page.close();
}

async function run() {
  console.log(`\n${B}GCR Public Site Tester${X}`);
  console.log(`${D}Site: ${SITE_URL}${X}`);
  console.log(`${D}Time: ${new Date().toLocaleString()}${X}`);
  if (SCREENSHOTS) console.log(`${D}Screenshots: ${SS_DIR}${X}`);

  const browser = await chromium.launch({ headless: true });

  // First discover which pages actually exist
  section('Discovering pages');
  const existingPages = [];
  for (const p of PAGES) {
    try {
      const probe = await browser.newPage();
      const res   = await probe.goto(SITE_URL + p.url, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => null);
      await probe.close();
      if (res && res.status() !== 404) {
        existingPages.push(p);
        console.log(`  ${G}✓${X} ${p.label} ${D}(${p.url})${X}`);
      } else {
        console.log(`  ${D}~${X} ${p.label} ${D}(not found)${X}`);
      }
    } catch { console.log(`  ${D}~${X} ${p.label} ${D}(unreachable)${X}`); }
  }

  // Also try to find entity profile pages
  section('Finding entity profile pages');
  try {
    const r    = await fetch(`http://localhost:3000/api/gcr/entities`);
    const data = await r.json();
    const ents = data?.entities || [];
    if (ents.length > 0) {
      // Test first 3 entity pages
      const sample = ents.slice(0, 3);
      for (const e of sample) {
        const entityUrl = `/business/${e.slug}.html`;
        const probe = await browser.newPage();
        const res   = await probe.goto(SITE_URL + entityUrl, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => null);
        await probe.close();
        if (res && res.status() !== 404) {
          existingPages.push({ url: entityUrl, label: `Entity: ${e.name}` });
          console.log(`  ${G}✓${X} Entity page: ${e.name}`);
        } else {
          // Try alternative URL patterns
          for (const pattern of [`/${e.slug}`, `/${e.slug}.html`, `/place/${e.slug}`, `/listing/${e.slug}`]) {
            const p2   = await browser.newPage();
            const res2 = await p2.goto(SITE_URL + pattern, { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null);
            await p2.close();
            if (res2 && res2.status() !== 404) {
              existingPages.push({ url: pattern, label: `Entity: ${e.name}` });
              console.log(`  ${G}✓${X} Entity page: ${e.name} ${D}(${pattern})${X}`);
              break;
            }
          }
        }
      }
    }
  } catch (e) {
    console.log(`  ${D}Could not fetch entities from local API: ${e.message}${X}`);
  }

  // Test all found pages
  section(`Testing ${existingPages.length} pages`);
  for (const p of existingPages) {
    await testPage(browser, p.url, p.label);
  }

  await browser.close();

  // Summary
  const loaded  = allResults.filter(r => r.loaded).length;
  const broken  = allBroken.length;

  console.log(`\n${B}${'═'.repeat(58)}${X}`);
  console.log(`${B}Results: ${G}${loaded} pages loaded${X}  ${R}${broken} issues${X}  ${D}/ ${allResults.length} tested${X}`);

  if (allBroken.length > 0) {
    console.log(`\n${B}${R}Issues found:${X}`);
    allBroken.forEach(b => {
      console.log(`  ${R}✗${X} ${b.label} ${D}(${b.pageUrl})${X}`);
      console.log(`    ${D}→ ${b.issue}${X}`);
    });
  } else {
    console.log(`\n${G}${B}✓ All good${X}`);
  }

  if (SCREENSHOTS) console.log(`\n${D}Screenshots: ${SS_DIR}${X}`);
  console.log();
}

function section(t) { console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0, 50-t.length))}${X}`); }

run().catch(e => { console.error(R + 'Fatal: ' + X + e.message); process.exit(1); });
