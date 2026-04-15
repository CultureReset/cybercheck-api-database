#!/usr/bin/env node
// gcr-homepage-content-audit.js — Verifies homepage renders all content sections correctly
// Checks: category tiles with counts, featured cards, happening now, calendar events, hero
// Usage: node agents/gcr-homepage-content-audit.js

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

// Try both index files
const HOME_PAGES = [
  { url: '/index3.html', label: 'Homepage (index3.html)' },
  { url: '/index.html',  label: 'Homepage (index.html)' },
];

async function run() {
  console.log(`\n${B}GCR Homepage Content Audit${X}`);
  console.log(`${D}Site: ${SITE_URL}${X}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 100)));

  // Find which index page exists
  let homeUrl = null;
  for (const hp of HOME_PAGES) {
    try {
      const res = await page.goto(SITE_URL + hp.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (res && res.status() < 400) { homeUrl = hp; ok(`${hp.label} loaded: ${res.status()}`); break; }
    } catch {}
  }
  if (!homeUrl) { fail('Homepage not found at index3.html or index.html'); await browser.close(); process.exit(1); }

  // Wait for JS to fully load API data
  await page.waitForTimeout(5000);

  // ── Category tiles ──
  sec('Category Tiles');
  const tileCount = await page.locator('.cat-tile').count().catch(() => 0);
  if (tileCount > 0) {
    ok(`${tileCount} category tiles rendered`);
    const tileNames = await page.locator('.cat-tile-name').allTextContents().catch(() => []);
    if (tileNames.length > 0) ok(`Tile labels: ${tileNames.slice(0,5).join(', ')}`);
    // Check counts are filled in
    const countsWithData = await page.evaluate(() => {
      const counts = document.querySelectorAll('[id^="count"]');
      return Array.from(counts).filter(el => el.textContent.trim() !== '' && el.textContent.trim() !== '0').length;
    }).catch(() => 0);
    if (countsWithData > 0) ok(`${countsWithData} category tiles show non-zero counts`);
    else warn(`Category tile counts are empty or zero — API data may not be loading`);
  } else warn(`No .cat-tile elements found — homepage structure may differ`);

  // ── Featured cards ──
  sec('Featured Cards');
  const featCount = await page.locator('.feat-card').count().catch(() => 0);
  if (featCount > 0) {
    ok(`${featCount} featured cards rendered`);
    const firstFeat = await page.locator('.feat-card-name').first().textContent({ timeout: 2000 }).catch(() => '');
    if (firstFeat.trim()) ok(`First featured: "${firstFeat.trim().slice(0,50)}"`);
    else warn(`Featured cards present but .feat-card-name is empty`);
  } else warn(`No featured cards (.feat-card) — check featured entities in Supabase`);

  // ── Happening Now / Events ──
  sec('Happening Now');
  const happeningGrid = await page.locator('#happeningGrid').count().catch(() => 0);
  if (happeningGrid > 0) {
    const happeningContent = await page.locator('#happeningGrid').textContent({ timeout: 2000 }).catch(() => '');
    if (happeningContent.trim().length > 20) ok(`Happening Now section has content`);
    else warn(`#happeningGrid exists but appears empty`);
  }
  // Check happy hour / music / specials sub-sections
  for (const id of ['hn-happyhour', 'hn-music', 'hn-specials', 'hn-activities']) {
    const el = await page.locator(`#${id}`).count().catch(() => 0);
    if (el > 0) {
      const txt = await page.locator(`#${id}`).textContent({ timeout: 1000 }).catch(() => '');
      if (txt.trim().length > 5) ok(`#${id} has content`);
      else warn(`#${id} exists but is empty`);
    }
  }

  // ── Calendar ──
  sec('Calendar');
  const calWidget = await page.locator('.cal-widget').count().catch(() => 0);
  if (calWidget > 0) {
    ok(`Calendar widget rendered`);
    const calMonth = await page.locator('#calMonthLbl').textContent({ timeout: 2000 }).catch(() => '');
    if (calMonth.trim()) ok(`Calendar month label: "${calMonth.trim()}"`);
    const hasDays = await page.locator('.cal-day').count().catch(() => 0);
    if (hasDays > 0) ok(`${hasDays} calendar day cells rendered`);
    const hasEvents = await page.locator('.cal-day.has-event').count().catch(() => 0);
    if (hasEvents > 0) ok(`${hasEvents} days have events marked`);
    else warn(`No days marked with events (.cal-day.has-event)`);
  } else warn(`Calendar widget not found — may not be on this homepage`);

  // ── District / neighborhood cards ──
  sec('Districts');
  const districtCount = await page.locator('.district-card').count().catch(() => 0);
  if (districtCount > 0) {
    ok(`${districtCount} district cards rendered`);
    const firstName = await page.locator('.district-name').first().textContent({ timeout: 1000 }).catch(() => '');
    if (firstName.trim()) ok(`First district: "${firstName.trim()}"`);
  } else warn(`No district cards — may not be on this page`);

  // ── Navigation links ──
  sec('Navigation');
  const navLinks = await page.locator('nav a, .nav-link, header a').count().catch(() => 0);
  if (navLinks > 0) ok(`${navLinks} nav links rendered`);
  else warn(`No navigation links found`);

  // ── JS errors ──
  sec('JS Health');
  if (errors.length === 0) ok(`No JS errors on homepage`);
  else fail(`${errors.length} JS error(s): ${errors.slice(0,3).join(' | ')}`);

  // ── Broken images ──
  const brokenImgs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter(i => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:'))
      .length
  ).catch(() => 0);
  if (brokenImgs === 0) ok(`No broken images`);
  else warn(`${brokenImgs} broken image(s) on homepage`);

  await browser.close();

  console.log(`\n${G}${passed.length} passed${X}  ${Y}${warned.length} warnings${X}  ${R}${failed.length} failed${X}`);

  if (process.env.ANTHROPIC_API_KEY && (failed.length > 0 || warned.length > 0)) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: `GCR homepage content audit: ${passed.length} passed, ${failed.length} failed, ${warned.length} warnings.
Issues: ${[...failed,...warned].join(' | ')}
What's preventing homepage sections from rendering?` }]
    });
    console.log('\n' + msg.content[0].text);
  }
  console.log();
}
run().catch(e => { console.error('\x1b[31mFatal:\x1b[0m', e.message); process.exit(1); });
