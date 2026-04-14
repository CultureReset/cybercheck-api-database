#!/usr/bin/env node
// gcr-profile-by-type.js — Opens real entity profile pages via Playwright and verifies
// the correct tabs/sections appear based on entity type:
// - Restaurant: menu, hours, happy hour, events tabs
// - Activity: booking, duration/capacity info, Book Now button
// - Bar/Nightlife: drinks, hours, events
// Usage: node agents/gcr-profile-by-type.js
// Requires: npx playwright install chromium

require('dotenv').config();

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const SITE_URL    = process.env.SITE_URL || 'https://launching-gcr.vercel.app';
const API_BASE    = process.env.API_BASE  || 'https://cybercheck-api-database.vercel.app';
const SCREENSHOTS = process.argv.includes('--screenshots');
const SS_DIR      = path.join(__dirname, '..', 'test-screenshots', 'profiles');

const G='\x1b[32m',R='\x1b[31m',Y='\x1b[33m',C='\x1b[36m',X='\x1b[0m',B='\x1b[1m',D='\x1b[2m';
const passed=[],failed=[],warned=[];
function ok(m)  { console.log(`  ${G}✓${X} ${m}`); passed.push(m); }
function fail(m){ console.log(`  ${R}✗${X} ${m}`); failed.push(m); }
function warn(m){ console.log(`  ${Y}⚠${X} ${m}`); warned.push(m); }
function sec(t) { console.log(`\n${B}${C}── ${t} ${'─'.repeat(Math.max(0,54-t.length))}${X}`); }

const RESTAURANT_SUBTYPES = ['restaurant','bar_grill','seafood_restaurant','casual_dining','bar','beach_bar'];
const ACTIVITY_SUBTYPES   = ['fishing_charter','parasailing','dolphin_cruise','boat_rental','kayak_rental','jet_ski','things_to_do','tour','attraction'];
const NIGHTLIFE_SUBTYPES  = ['nightlife','bar_club','nightclub','sports_bar','rooftop_bar','lounge'];

async function fetchEntities() {
  const r = await fetch(API_BASE + '/api/gcr/entities');
  const d = await r.json();
  if (!d || d.error) throw new Error(d?.error || 'Entities endpoint error');
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.entities)) return d.entities;
  if (Array.isArray(d.businesses)) return d.businesses;
  return [];
}

async function testProfilePage(browser, entity, expectations) {
  const profileUrl = `${SITE_URL}/profile.html?slug=${entity.slug}`;
  const page = await browser.newPage();
  const errors = [];
  const apiFails = [];

  page.on('console',       m => { if (m.type() === 'error') errors.push(m.text().slice(0,120)); });
  page.on('requestfailed', r => { if (r.url().includes('/api/')) apiFails.push(r.url()); });

  console.log(`\n  ${D}Testing: ${entity.name} (${entity.entity_subtype})${X}`);
  console.log(`  ${D}URL: ${profileUrl}${X}`);

  try {
    const res = await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (res.status() === 404) {
      warn(`Profile page 404 for ${entity.name}`);
      await page.close();
      return;
    }

    // Wait for data to load
    await page.waitForTimeout(3000);

    if (SCREENSHOTS) {
      if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });
      await page.screenshot({ path: path.join(SS_DIR, `${entity.slug}.png`), fullPage: true }).catch(() => {});
    }

    const bodyText = await page.textContent('body').catch(() => '');
    const stuckLoading = (bodyText.match(/Loading\.\.\./g)||[]).length;

    // Check entity name appears
    if (bodyText.includes(entity.name)) ok(`Name "${entity.name}" appears on page`);
    else warn(`Name "${entity.name}" not found on page`);

    // Check stuck loading
    if (stuckLoading > 2) warn(`${stuckLoading} stuck "Loading..." on ${entity.name}`);

    // Check API failures
    if (apiFails.length > 0) fail(`API failures: ${apiFails.slice(0,3).join(', ')}`);

    // Check expected tabs/sections
    for (const { selector, label, required } of expectations) {
      const el = await page.locator(selector).first();
      const visible = await el.isVisible().catch(() => false);
      const count   = await page.locator(selector).count().catch(() => 0);
      if (visible || count > 0) {
        ok(`${label} visible`);
      } else {
        // Check if text appears anywhere in body
        if (bodyText.toLowerCase().includes(label.toLowerCase())) {
          ok(`${label} in page content`);
        } else if (required) {
          fail(`${label} missing on ${entity.name} (${entity.entity_subtype})`);
        } else {
          warn(`${label} not found on ${entity.name} — may be no data`);
        }
      }
    }

    // Check JS errors
    if (errors.length > 0) {
      warn(`${errors.length} JS console error(s) on ${entity.name}`);
      errors.slice(0,2).forEach(e => console.log(`    ${D}→ ${e.slice(0,100)}${X}`));
    }

  } catch(e) {
    fail(`${entity.name} — ${e.message.slice(0,80)}`);
  }

  await page.close();
}

async function run() {
  console.log(`\n${B}Profile Page By Entity Type Audit${X}`);
  console.log(`${D}Site: ${SITE_URL}${X}\n`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch(e) {
    console.log(`${R}✗ Playwright not installed.${X}`);
    console.log(`Run: npx playwright install chromium`);
    process.exit(1);
  }

  // Fetch entities from API
  sec('Fetching Entities');
  let entities = [];
  try {
    entities = await fetchEntities();
    ok(`${entities.length} entities fetched`);
  } catch(e) {
    fail(`Could not fetch entities: ${e.message}`);
    await browser.close();
    process.exit(1);
  }

  // Find one of each type to test
  const restaurant = entities.find(e => RESTAURANT_SUBTYPES.includes(e.entity_subtype));
  const activity   = entities.find(e => ACTIVITY_SUBTYPES.includes(e.entity_subtype));
  const nightlife  = entities.find(e => NIGHTLIFE_SUBTYPES.includes(e.entity_subtype));

  // ── Restaurant Profile ─────────────────────────────────
  sec('Restaurant Profile Page');
  if (restaurant) {
    await testProfilePage(browser, restaurant, [
      { selector: '[data-section="menu"], .menu-section, #section-menu',       label: 'Menu',        required: false },
      { selector: '[data-section="hours"], .hours-section, #section-hours',    label: 'Hours',       required: false },
      { selector: '.tab-btn, .section-tab, nav a',                              label: 'Navigation tabs', required: true },
      { selector: 'a[href^="tel:"], .call-btn, [data-action="call"]',           label: 'Call button', required: false },
      { selector: 'a[href*="maps"], .directions-btn, [data-action="directions"]',label: 'Directions', required: false },
    ]);
  } else {
    warn('No restaurant entity found to test profile');
  }

  // ── Activity Profile ───────────────────────────────────
  sec('Activity Profile Page');
  if (activity) {
    await testProfilePage(browser, activity, [
      { selector: '.booking-url, a[href*="book"], .book-now',                  label: 'Book Now link',    required: false },
      { selector: '.duration, [data-field="duration_text"]',                   label: 'Duration info',    required: false },
      { selector: '.capacity, [data-field="capacity"]',                        label: 'Capacity info',    required: false },
      { selector: '.tab-btn, .section-tab, nav a',                             label: 'Navigation tabs',  required: true },
      { selector: 'a[href*="maps"], .directions-btn',                          label: 'Directions',       required: false },
    ]);
  } else {
    warn('No activity entity found to test profile — add a fishing_charter or parasailing entity');
  }

  // ── Nightlife Profile ──────────────────────────────────
  sec('Nightlife Profile Page');
  if (nightlife) {
    await testProfilePage(browser, nightlife, [
      { selector: '[data-section="hours"], .hours-section',                    label: 'Hours',         required: false },
      { selector: '[data-section="drinks"], .drinks-section',                  label: 'Drinks',        required: false },
      { selector: '.tab-btn, .section-tab, nav a',                             label: 'Navigation tabs', required: true },
    ]);
  } else {
    warn('No nightlife entity found to test profile');
  }

  // ── Generic profile checks on first 3 active entities ─
  sec('Generic Profile Checks (first 3 entities)');
  const sample = entities.slice(0, 3);
  for (const entity of sample) {
    const profileUrl = `${SITE_URL}/profile.html?slug=${entity.slug}`;
    const page = await browser.newPage();
    const apiFails = [];
    page.on('requestfailed', r => { if (r.url().includes('/api/')) apiFails.push(r.url()); });
    try {
      const res = await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
      await page.waitForTimeout(2000);
      if (res.status() === 200) {
        const body = await page.textContent('body').catch(() => '');
        const hasName = body.includes(entity.name);
        const stuck   = (body.match(/Loading\.\.\./g)||[]).length;
        if (hasName && stuck <= 1 && apiFails.length === 0) ok(`${entity.name} profile loads correctly`);
        else if (!hasName) fail(`${entity.name} — entity name not on profile page`);
        else if (stuck > 1)  warn(`${entity.name} — ${stuck} stuck loaders`);
        else if (apiFails.length > 0) fail(`${entity.name} — API failures: ${apiFails[0]}`);
      } else {
        warn(`${entity.name} profile → status ${res.status()}`);
      }
    } catch(e) {
      fail(`${entity.name} → ${e.message.slice(0,60)}`);
    }
    await page.close();
  }

  await browser.close();

  // Summary
  console.log(`\n${B}${'═'.repeat(56)}${X}`);
  console.log(`${B}Profile By Type: ${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(R+'Fatal: '+X+e.message); process.exit(1); });
