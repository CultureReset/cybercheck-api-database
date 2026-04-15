#!/usr/bin/env node
// gcr-profile-content-audit.js — Deep field verification on business profile pages
// Loads real profile pages in Chrome, checks every content section renders correctly:
// name, address, phone, tabs, menu items with prices, events, specials, gallery
// Usage: node agents/gcr-profile-content-audit.js

require('dotenv').config();
const { chromium } = require('playwright');
const Anthropic = require('@anthropic-ai/sdk');

const API_BASE  = process.env.API_BASE  || 'https://cybercheck-api-database.vercel.app';
const SITE_URL  = process.env.SITE_URL  || 'https://launching-gcr.vercel.app';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m){console.log(`  ${G}✓${X} ${m}`);passed.push(m);}
function fail(m){console.log(`  ${R}✗${X} ${m}`);failed.push(m);}
function warn(m){console.log(`  ${Y}⚠${X} ${m}`);warned.push(m);}
function sec(t){console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`);}

async function getTestEntities() {
  // Pick one entity per subtype that has rich data (menu items or events)
  const subtypes = ['restaurant','bar','activity','nightlife','shopping','hotel'];
  const entities = [];
  for (const subtype of subtypes) {
    const r = await fetch(`${API_BASE}/api/gcr/entities?subtype=${subtype}&limit=5`);
    if (!r.ok) continue;
    const d = await r.json();
    const list = d.entities || d.businesses || [];
    // Prefer entities with menu/events data
    const pick = list.find(e => e.is_active) || list[0];
    if (pick) entities.push({ slug: pick.slug, name: pick.name, subtype, entity: pick });
  }
  return entities.slice(0, 4); // audit up to 4 profiles
}

async function auditProfile(page, entity) {
  const { slug, name, subtype } = entity;
  const profileUrl = `${SITE_URL}/profile.html?id=${slug}`;

  sec(`Profile: ${name} (${subtype})`);

  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 100)));

  try {
    const res = await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    if (!res || res.status() >= 400) { fail(`Page load failed: ${res?.status()}`); return; }
    ok(`Page loaded: ${res.status()}`);
  } catch (e) {
    fail(`Page load error: ${e.message.slice(0, 80)}`);
    return;
  }

  // Wait for JS to populate content
  await page.waitForTimeout(3000);

  // ── Entity name ──
  const nameEl = await page.locator('#js-name').first().textContent({ timeout: 5000 }).catch(() => null);
  if (nameEl && nameEl.trim().length > 0) ok(`Name renders: "${nameEl.trim().slice(0, 60)}"`);
  else fail(`#js-name is empty — entity name not rendering`);

  // ── Meta (address / phone) ──
  const metaText = await page.locator('#js-meta').first().textContent({ timeout: 3000 }).catch(() => '');
  if (metaText && metaText.includes('📍')) ok(`Address visible in meta`);
  else warn(`Address (📍) not found in #js-meta`);
  if (metaText && metaText.includes('📞')) ok(`Phone visible in meta`);
  else warn(`Phone (📞) not found in #js-meta — may not have phone data`);

  // ── Tabs ──
  const tabCount = await page.locator('#js-tabs .tab').count().catch(() => 0);
  if (tabCount > 0) ok(`${tabCount} section tabs rendered`);
  else warn(`No tabs in #js-tabs — entity may have no sections`);

  // ── Menu items ──
  const menuItemCount = await page.locator('.item .name').count().catch(() => 0);
  if (menuItemCount > 0) {
    ok(`${menuItemCount} menu items rendered`);
    // Check at least one has a price
    const priceCount = await page.locator('.item .price').count().catch(() => 0);
    if (priceCount > 0) ok(`${priceCount} menu item prices visible`);
    else warn(`Menu items present but no prices shown`);
    // Spot check first item name is non-empty
    const firstItem = await page.locator('.item .name').first().textContent({ timeout: 2000 }).catch(() => '');
    if (firstItem.trim()) ok(`First menu item: "${firstItem.trim().slice(0, 50)}"`);
  } else {
    warn(`No menu items (.item .name) — entity may have no menu data`);
  }

  // ── Specials ──
  const specialCount = await page.locator('.special-name').count().catch(() => 0);
  if (specialCount > 0) ok(`${specialCount} specials/events visible`);
  else warn(`No specials/events visible (.special-name)`);

  // ── Gallery ──
  const galleryImgCount = await page.locator('.gallery-img').count().catch(() => 0);
  if (galleryImgCount > 0) ok(`${galleryImgCount} gallery images`);
  else warn(`No gallery images — entity may have no photos`);

  // ── Cover image ──
  const coverSlide = await page.locator('#js-slides .cover-slide').count().catch(() => 0);
  if (coverSlide > 0) ok(`Cover slideshow rendered (${coverSlide} slides)`);
  else warn(`No cover slides in #js-slides`);

  // ── JS errors ──
  if (errors.length === 0) ok(`No JS errors`);
  else fail(`${errors.length} JS error(s): ${errors[0]}`);

  // ── Broken images ──
  const brokenImgs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter(i => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:'))
      .map(i => i.src.slice(-60))
  ).catch(() => []);
  if (brokenImgs.length === 0) ok(`No broken images`);
  else warn(`${brokenImgs.length} broken image(s): ${brokenImgs[0]}`);
}

async function run() {
  console.log(`\n${B}GCR Profile Content Audit${X}`);
  console.log(`${D}Site: ${SITE_URL}${X}\n`);

  sec('Fetching test entities from API');
  const entities = await getTestEntities();
  if (entities.length === 0) { fail('No active entities found in API'); process.exit(1); }
  ok(`Testing ${entities.length} profiles: ${entities.map(e => e.name).join(', ')}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  for (const entity of entities) {
    const page = await context.newPage();
    await auditProfile(page, entity);
    await page.close();
  }

  await browser.close();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR profile page content audit: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
Issues: ${[...failed,...warned].join(' | ')}
What's preventing profile page content from rendering?` }]
    });
    console.log('\n' + msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal:\x1b[0m', e.message); process.exit(1); });
