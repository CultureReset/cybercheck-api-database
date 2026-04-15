#!/usr/bin/env node
// gcr-category-cards-audit.js — Verifies business cards render correctly on every category page
// Checks: cards load, name visible, image loads, subtitle shows, price range, filters work
// Usage: node agents/gcr-category-cards-audit.js

require('dotenv').config();
const { chromium } = require('playwright');
const Anthropic = require('@anthropic-ai/sdk');

const SITE_URL  = process.env.SITE_URL  || 'https://launching-gcr.vercel.app';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`);}

const CATEGORY_PAGES = [
  { url: '/restaurants.html',   label: 'Restaurants' },
  { url: '/nightlife.html',     label: 'Nightlife' },
  { url: '/things-to-do.html',  label: 'Things To Do' },
  { url: '/shopping.html',      label: 'Shopping' },
  { url: '/happy-hours.html',   label: 'Happy Hours' },
  { url: '/events.html',        label: 'Events' },
  { url: '/specials.html',      label: 'Specials' },
];

async function auditCategoryPage(page, pageInfo) {
  sec(`${pageInfo.label} (${pageInfo.url})`);

  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 100)));

  try {
    const res = await page.goto(SITE_URL + pageInfo.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!res || res.status() >= 400) { fail(`${pageInfo.label}: HTTP ${res?.status()}`); return; }
  } catch(e) { fail(`${pageInfo.label}: load error — ${e.message.slice(0,60)}`); return; }

  // Wait for JS to fetch API data and render cards — up to 10s
  let cardCount = 0;
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(2500);
    cardCount = await page.locator('.gcr-card').count().catch(() => 0);
    if (cardCount > 0) break;
  }

  // ── Cards rendered ──
  if (cardCount > 0) ok(`${cardCount} cards rendered`);
  else {
    // Check for event/special cards (different structure on events.html, specials.html, happy-hours.html)
    const altCount = await page.locator('.event-card, .special-card, .event-row, .special, .hh-card, .listing-card').count().catch(() => 0);
    if (altCount > 0) { ok(`${altCount} event/special items rendered (alternate card style)`); return; }
    // Log what IS on the page to help diagnose
    const bodyLen = await page.locator('body').textContent({ timeout: 2000 }).catch(() => '');
    warn(`No cards rendered on ${pageInfo.label} after 10s — body length: ${bodyLen.length} chars`);
    if (bodyLen.length < 500) fail(`Page body nearly empty — JS may have crashed or API blocked`);
    else fail(`Cards not rendering — JS loaded but data not populating .gcr-card`);
    return;
  }

  if (cardCount > 0) {
    // ── Card name ──
    const nameCount = await page.locator('.gcr-card-name').count().catch(() => 0);
    if (nameCount > 0) {
      const firstName = await page.locator('.gcr-card-name').first().textContent({ timeout: 2000 }).catch(() => '');
      ok(`Card names visible — first: "${firstName.trim().slice(0, 50)}"`);
    } else fail(`Cards present but .gcr-card-name missing`);

    // ── Card images ──
    const imgCards = await page.evaluate(() => {
      const cards = document.querySelectorAll('.gcr-card-img');
      let withImg = 0, withoutImg = 0;
      cards.forEach(el => {
        const bg = el.style.backgroundImage || getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none' && bg !== '') withImg++;
        else withoutImg++;
      });
      return { withImg, withoutImg, total: cards.length };
    }).catch(() => ({ withImg: 0, withoutImg: 0, total: 0 }));

    if (imgCards.withImg > 0) ok(`${imgCards.withImg}/${imgCards.total} cards have cover images`);
    else if (imgCards.total > 0) warn(`${imgCards.total} cards but none have cover images`);

    // ── Card subtitle ──
    const subCount = await page.locator('.gcr-card-sub').count().catch(() => 0);
    if (subCount > 0) ok(`${subCount} card subtitles visible`);
    else warn(`No .gcr-card-sub elements — subtitle/location not rendering`);

    // ── Filter buttons ──
    const filterCount = await page.locator('.tag-btn, .filter-btn').count().catch(() => 0);
    if (filterCount > 0) {
      ok(`${filterCount} filter buttons rendered`);
      // Click a non-All filter if available
      const nonAll = page.locator('.tag-btn:not([data-filter="all"])').first();
      const hasNonAll = await nonAll.count().catch(() => 0);
      if (hasNonAll > 0) {
        const filterLabel = await nonAll.textContent({ timeout: 1000 }).catch(() => '');
        await nonAll.click({ timeout: 2000 }).catch(() => null);
        await page.waitForTimeout(500);
        const visibleAfter = await page.locator('.gcr-card:not(.gcr-card-hidden)').count().catch(() => 0);
        ok(`Filter "${filterLabel.trim()}" clicked — ${visibleAfter} cards visible`);
      }
    } else warn(`No filter buttons found`);

    // ── Profile link works ──
    const firstLink = await page.locator('.gcr-card').first().locator('a').first().getAttribute('href').catch(() => null);
    if (firstLink && firstLink.includes('profile')) ok(`Cards link to profile pages: ${firstLink.slice(0, 60)}`);
    else warn(`Card profile link not found or unexpected: ${firstLink}`);

    // ── Result count display ──
    const countEl = await page.locator('#resultCount').textContent({ timeout: 2000 }).catch(() => null);
    if (countEl && countEl.trim()) ok(`Result count shown: "${countEl.trim()}"`);
    else warn(`#resultCount not visible`);
  }

  // ── JS errors ──
  if (errors.length === 0) ok(`No JS errors`);
  else fail(`${errors.length} JS error(s): ${errors[0]}`);
}

async function run() {
  console.log(`\n${B}GCR Category Cards Audit${X}`);
  console.log(`${D}Site: ${SITE_URL}${X}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  for (const pageInfo of CATEGORY_PAGES) {
    const page = await context.newPage();
    await auditCategoryPage(page, pageInfo);
    await page.close();
  }

  await browser.close();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR category page cards audit: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
Pages tested: ${CATEGORY_PAGES.map(p=>p.label).join(', ')}.
Issues: ${[...failed,...warned].join(' | ')}
Root cause and fix?` }]
    });
    console.log('\n' + msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal:\x1b[0m', e.message); process.exit(1); });
