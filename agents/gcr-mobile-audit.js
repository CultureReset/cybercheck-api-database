#!/usr/bin/env node
// gcr-mobile-audit.js — Tests all public GCR pages at mobile viewport (375x812 iPhone)
// Checks: layout doesn't break, cards render, filter chips visible and tappable,
// buttons large enough to tap, images load, no horizontal scroll.
// Usage: node agents/gcr-mobile-audit.js
// Usage: node agents/gcr-mobile-audit.js --screenshots
// Requires: npx playwright install chromium

require('dotenv').config();

const { chromium, devices } = require('playwright');
const path = require('path');
const fs   = require('fs');

const SITE_URL    = process.env.SITE_URL || 'https://launching-gcr.vercel.app';
const SCREENSHOTS = process.argv.includes('--screenshots');
const SS_DIR      = path.join(__dirname, '..', 'test-screenshots', 'mobile');

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m)  { console.log(`  ${G}✓${X} ${m}`); passed.push(m); }
function fail(m){ console.log(`  ${R}✗${X} ${m}`); failed.push(m); }
function warn(m){ console.log(`  ${Y}⚠${X} ${m}`); warned.push(m); }
function sec(t) { console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`); }

const PAGES = [
  { url: '/',                  label: 'Home' },
  { url: '/restaurants.html',  label: 'Restaurants' },
  { url: '/things-to-do.html', label: 'Things To Do' },
  { url: '/happy-hours.html',  label: 'Happy Hours' },
  { url: '/events.html',       label: 'Events' },
  { url: '/specials.html',     label: 'Specials' },
  { url: '/nightlife.html',    label: 'Nightlife' },
  { url: '/shopping.html',     label: 'Shopping' },
  { url: '/search.html',       label: 'Search' },
];

// Min tap target size (px) — Apple HIG recommends 44px
const MIN_TAP_SIZE = 36;

async function testMobilePage(browser, pageUrl, label) {
  const page = await browser.newPage();
  const errors = [];
  const apiFails = [];

  page.on('console',       m => { if (m.type() === 'error') errors.push(m.text().slice(0,120)); });
  page.on('requestfailed', r => { if (r.url().includes('/api/')) apiFails.push(`${r.method()} ${r.url()}`); });

  const fullUrl = SITE_URL + pageUrl;

  try {
    const res = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!res || res.status() === 404) {
      console.log(`  ${D}~ ${label} (404 — skipping)${X}`);
      await page.close();
      return;
    }

    await page.waitForTimeout(3000);

    if (SCREENSHOTS) {
      if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
      const name = pageUrl.replace(/\//g,'_').replace(/\.html$/,'') || 'home';
      await page.screenshot({ path: path.join(SS_DIR, `mobile-${name}.png`), fullPage: true }).catch(() => {});
    }

    const bodyText = await page.textContent('body').catch(() => '');

    // ── Horizontal scroll check ──────────────────────────
    const hasHScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    if (hasHScroll) warn(`${label} — horizontal scroll detected (layout overflow)`);
    else ok(`${label} — no horizontal scroll`);

    // ── Cards render ─────────────────────────────────────
    const cardCount = await page.locator('.entity-card, .card, .listing-card, .biz-card').count().catch(() => 0);
    if (cardCount > 0) ok(`${label} — ${cardCount} cards rendered`);
    else if (pageUrl !== '/search.html') warn(`${label} — no cards found`);

    // ── Stuck loading ────────────────────────────────────
    const stuckLoading = (bodyText.match(/Loading\.\.\./g)||[]).length;
    if (stuckLoading > 2) warn(`${label} — ${stuckLoading} stuck "Loading..." states`);

    // ── Tap target sizes ─────────────────────────────────
    const smallTargets = await page.evaluate((minSize) => {
      const clickables = document.querySelectorAll('button, a, [role="button"], .btn, .filter-chip, .tab-btn');
      const small = [];
      for (const el of clickables) {
        const rect = el.getBoundingClientRect();
        const text = (el.textContent || '').trim().slice(0, 30);
        if (rect.width > 0 && rect.height > 0 && (rect.width < minSize || rect.height < minSize)) {
          small.push({ text, w: Math.round(rect.width), h: Math.round(rect.height) });
        }
      }
      return small.slice(0, 5);
    }, MIN_TAP_SIZE);

    if (smallTargets.length > 0) {
      warn(`${label} — ${smallTargets.length} tap targets smaller than ${MIN_TAP_SIZE}px:`);
      smallTargets.forEach(t => console.log(`    ${D}→ "${t.text}" ${t.w}×${t.h}px${X}`));
    } else {
      ok(`${label} — all tap targets ${MIN_TAP_SIZE}px+`);
    }

    // ── Filter chips / nav visible ────────────────────────
    const filterCount = await page.locator('.filter-chip:visible, .filter-btn:visible, .category-tab:visible').count().catch(() => 0);
    if (filterCount > 0) ok(`${label} — ${filterCount} filter/nav elements visible`);

    // ── Images load ───────────────────────────────────────
    const brokenImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter(img => !img.complete || img.naturalWidth === 0)
        .map(img => img.src)
        .filter(src => src && !src.startsWith('data:'))
        .slice(0, 3);
    });
    if (brokenImages.length > 0) {
      warn(`${label} — ${brokenImages.length} broken image(s)`);
      brokenImages.forEach(src => console.log(`    ${D}→ ${src.slice(0,80)}${X}`));
    } else {
      ok(`${label} — all images loaded`);
    }

    // ── API failures ──────────────────────────────────────
    if (apiFails.length > 0) {
      fail(`${label} — API failures:`);
      apiFails.slice(0,3).forEach(f => console.log(`    ${D}→ ${f}${X}`));
    }

    // ── JS errors ─────────────────────────────────────────
    if (errors.length > 0) {
      warn(`${label} — ${errors.length} JS error(s)`);
      errors.slice(0,2).forEach(e => console.log(`    ${D}→ ${e.slice(0,100)}${X}`));
    }

  } catch(e) {
    fail(`${label} — ${e.message.slice(0,80)}`);
  }

  await page.close();
}

async function run() {
  console.log(`\n${B}GCR Mobile Audit (iPhone 375×812)${X}`);
  console.log(`${D}Site: ${SITE_URL}${X}`);
  if (SCREENSHOTS) console.log(`${D}Screenshots: ${SS_DIR}${X}`);
  console.log();

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch(e) {
    console.log(`${R}✗ Playwright not installed.${X} Run: npx playwright install chromium`);
    process.exit(1);
  }

  // Use iPhone viewport
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  });

  // Wrap each page in the context
  for (const { url, label } of PAGES) {
    sec(label);
    const page = await context.newPage();
    const errors = [];
    const apiFails = [];

    page.on('console',       m => { if (m.type() === 'error') errors.push(m.text().slice(0,120)); });
    page.on('requestfailed', r => { if (r.url().includes('/api/')) apiFails.push(r.url()); });

    const fullUrl = SITE_URL + url;

    try {
      const res = await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!res || res.status() === 404) {
        console.log(`  ${D}~ ${label} (404 — skipping)${X}`);
        await page.close();
        continue;
      }

      await page.waitForTimeout(3000);

      if (SCREENSHOTS) {
        if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
        const name = url.replace(/\//g,'_').replace(/\.html$/,'') || 'home';
        await page.screenshot({ path: path.join(SS_DIR, `${name}.png`), fullPage: true }).catch(() => {});
      }

      const bodyText = await page.textContent('body').catch(() => '');

      // Horizontal scroll
      const hasHScroll = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth + 10
      );
      if (hasHScroll) warn(`Horizontal scroll detected — content overflows mobile width`);
      else ok(`No horizontal scroll`);

      // Cards
      const cardCount = await page.locator('.entity-card, .card, .listing-card, .biz-card').count().catch(() => 0);
      if (cardCount > 0) ok(`${cardCount} cards rendered at 375px`);
      else if (url !== '/search.html') warn(`No cards rendered`);

      // Stuck loading
      const stuckLoading = (bodyText.match(/Loading\.\.\./g)||[]).length;
      if (stuckLoading > 2) warn(`${stuckLoading} stuck "Loading..." states`);

      // Small tap targets
      const smallTargets = await page.evaluate(min => {
        return Array.from(document.querySelectorAll('button:not([hidden]), a:not([hidden]), .btn, .filter-chip, .tab-btn'))
          .filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (r.width < min || r.height < min);
          })
          .map(el => ({ text: (el.textContent||'').trim().slice(0,25), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }))
          .slice(0, 4);
      }, MIN_TAP_SIZE);
      if (smallTargets.length > 0) {
        warn(`${smallTargets.length} small tap targets:`);
        smallTargets.forEach(t => console.log(`    ${D}→ "${t.text}" ${t.w}×${t.h}px${X}`));
      } else {
        ok(`All visible tap targets ${MIN_TAP_SIZE}px+`);
      }

      // Broken images
      const broken = await page.evaluate(() =>
        Array.from(document.querySelectorAll('img'))
          .filter(i => !i.complete || i.naturalWidth === 0)
          .map(i => i.src).filter(s => s && !s.startsWith('data:')).slice(0,3)
      );
      if (broken.length > 0) warn(`${broken.length} broken image(s)`);
      else ok(`All images loaded`);

      // API failures
      if (apiFails.length > 0) {
        fail(`API failures on ${label}:`);
        apiFails.slice(0,2).forEach(f => console.log(`    ${D}→ ${f.slice(0,80)}${X}`));
      }

      // JS errors
      if (errors.length > 0) warn(`${errors.length} JS console error(s)`);

    } catch(e) {
      fail(`${label} — ${e.message.slice(0,80)}`);
    }

    await page.close();
  }

  await browser.close();

  // Summary
  console.log(`\n${B}${'═'.repeat(56)}${X}`);
  console.log(`${B}Mobile Audit: ${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);
  if (SCREENSHOTS) console.log(`${D}Screenshots saved to: ${SS_DIR}${X}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(R+'Fatal: '+X+e.message); process.exit(1); });
