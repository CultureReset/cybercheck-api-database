#!/usr/bin/env node
/**
 * Haiku Live Menu Scraper
 * Visits each restaurant website with real Chrome, takes screenshots of every page,
 * sends screenshots + text to Claude Haiku to extract full menu data.
 * Catches image-based menus, PDF menus, JS-rendered menus — anything visible on screen.
 *
 * Usage:
 *   node agents/haiku-live-menu-scraper.js --dry-run
 *   node agents/haiku-live-menu-scraper.js              — all restaurants
 *   node agents/haiku-live-menu-scraper.js --start 10
 *   node agents/haiku-live-menu-scraper.js --count 3    — test N first
 *   node agents/haiku-live-menu-scraper.js --force      — redo even completed ones
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Anthropic   = require('@anthropic-ai/sdk');
const puppeteer   = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs          = require('fs');
const path        = require('path');

puppeteer.use(StealthPlugin());

const client     = new Anthropic();
const BASE_DIR   = path.join(__dirname, '../scraped-menus');
const OUT_DIR    = path.join(__dirname, '../menu-extractions');
const LOG_FILE   = path.join(__dirname, '../haiku-menu-results.json');
const SOURCE_FILE = path.join(__dirname, '../category-food-and-dining-ob-gs.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

const NATIONAL_CHAINS = [
  'subway','mcdonalds','burger-king','wendys','chick-fil-a','taco-bell',
  'dominos','pizza-hut','popeyes','kfc','starbucks','dunkin','five-guys',
  'cracker-barrel','ihop','dennys','outback','cheesecake-factory','panera',
  'chipotle','waffle-house','hooters','krispy-kreme','dairy-queen',
  'honey-baked-ham','papa-john','longhorn','acme-oyster','topsail-steamer',
];
const SKIP_DOMAINS = [
  'marriott.com','hilton.com','facebook.com','bit.ly','yelp.com',
  'tripadvisor.com','grubhub.com','doordash.com','ubereats.com',
  'opentable.com','google.com','instagram.com',
];
const MENU_URLS = /menu|food|drink|eats|dine|cuisine|order|bar-menu|wine|cocktail|dinner|lunch|brunch|appetizer|entree|specials|happy.hour/i;
const SKIP_URL  = /\/(author|tag|category|blog|news|press|careers|jobs|franchise|privacy|terms|cookie|sitemap|wp-json|wp-admin|feed|rss|locations\/(?!gulf|orange|alabama|foley|perdido)[a-z])|\?p=|\?page_id=/i;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function slugify(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function isNationalChain(name) { return NATIONAL_CHAINS.some(f => slugify(name).includes(f)); }
function isSkippedDomain(url) { return SKIP_DOMAINS.some(d => (url||'').includes(d)); }

function normalizeUrl(href, base) {
  try {
    const u = new URL(href, base);
    if (!['http:','https:'].includes(u.protocol)) return null;
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch { return null; }
}
function isSameDomain(url, base) {
  try {
    const a = new URL(url), b = new URL(base);
    return a.hostname === b.hostname || a.hostname.endsWith('.'+b.hostname);
  } catch { return false; }
}
function isDone(slug) {
  return fs.existsSync(path.join(OUT_DIR, slug + '.json'));
}

// ─── Visit website, screenshot every menu-related page ───────────────────────

async function visitAndScreenshot(startUrl) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-blink-features=AutomationControlled','--disable-dev-shm-usage'],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });

  const visited  = new Set();
  const toVisit  = [startUrl.replace(/\/$/, '')];
  const captures = []; // { url, screenshot (base64), text }
  const MAX      = 15; // max pages per restaurant

  while (toVisit.length > 0 && visited.size < MAX) {
    const url = toVisit.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    const page = await browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 900 });

      console.log(`    [${visited.size}/${MAX}] ${url.substring(0, 75)}`);
      const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      if (!resp) { await page.close(); continue; }

      await sleep(2500);

      // Dismiss popups
      for (const sel of ['button[id*="accept"]','button[class*="accept"]','button[class*="close"]','[aria-label*="close" i]','button[id*="cookie"]','.cookie-accept']) {
        try { const btn = await page.$(sel); if (btn) { await btn.click(); await sleep(300); } } catch {}
      }

      // Scroll to trigger lazy load, capturing viewport screenshots along the way
      const viewportHeight = 900;
      const pageHeight = await page.evaluate(() => document.body.scrollHeight);
      const scrollStops = Math.min(6, Math.ceil(pageHeight / viewportHeight)); // max 6 scroll positions

      const scrollScreenshots = [];
      for (let s = 0; s < scrollStops; s++) {
        const scrollY = Math.floor((s / Math.max(scrollStops - 1, 1)) * Math.max(pageHeight - viewportHeight, 0));
        await page.evaluate(y => window.scrollTo(0, y), scrollY);
        await sleep(300);
        const shot = await page.screenshot({ fullPage: false, encoding: 'base64', type: 'jpeg', quality: 75 });
        scrollScreenshots.push(shot);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(500);

      // Use first screenshot as the primary capture reference
      const screenshot = scrollScreenshots[0];

      // Also grab visible text as backup
      const text = await page.evaluate(() => {
        document.querySelectorAll('script,style,noscript,svg').forEach(el => el.remove());
        return document.body?.innerText || '';
      }).catch(() => '');

      // Collect links — prioritize menu pages
      const links = await page.evaluate(() =>
        [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h && !h.startsWith('javascript') && !h.startsWith('mailto') && !h.startsWith('tel'))
      ).catch(() => []);

      for (const link of links) {
        const norm = normalizeUrl(link, startUrl);
        if (!norm || !isSameDomain(norm, startUrl)) continue;
        if (visited.has(norm) || toVisit.includes(norm)) continue;
        if (SKIP_URL.test(norm)) continue;
        // Menu pages go first, other pages go to end
        MENU_URLS.test(norm) ? toVisit.unshift(norm) : toVisit.push(norm);
      }

      captures.push({ url, screenshot, screenshots: scrollScreenshots, text: text.substring(0, 8000) });
      console.log(`      ${text.length.toLocaleString()} chars text | ${scrollScreenshots.length} screenshots`);

    } catch (err) {
      console.log(`      ⚠️  ${err.message.substring(0, 60)}`);
    } finally {
      await page.close().catch(() => {});
    }

    await sleep(400);
  }

  await browser.close();
  return captures;
}

// ─── Send to Haiku for extraction ────────────────────────────────────────────

const HAIKU_PROMPT = `You are a menu extraction expert. I'm showing you screenshots and text from a restaurant website.

Extract EVERY menu item you can find including:
- Item name
- Price (exact dollar amount if visible)
- Description
- Category/section (Appetizers, Entrees, Drinks, Desserts, etc.)
- Dietary flags (vegetarian, vegan, gluten-free, etc.)

Also extract:
- Restaurant hours
- Happy hour deals and times
- Specials / daily specials
- Contact info (phone, address)

Return ONLY valid JSON, no markdown, no explanation:
{
  "business_name": "string",
  "address": "string or null",
  "phone": "string or null",
  "hours": { "monday": "string or null", "tuesday": null, "wednesday": null, "thursday": null, "friday": null, "saturday": null, "sunday": null },
  "happy_hour": { "days": "string or null", "times": "string or null", "deals": ["array of deal strings"] },
  "specials": ["array of special strings"],
  "menu": [
    {
      "section": "string (e.g. Appetizers)",
      "items": [
        { "name": "string", "price": "string or null", "description": "string or null", "dietary": [] }
      ]
    }
  ],
  "notes": "string or null (anything else useful)"
}

If you cannot find menu items, still return the JSON with an empty menu array. Do not make up prices or items — only extract what is clearly visible.`;

async function extractWithHaiku(businessName, captures) {
  if (captures.length === 0) {
    return { business_name: businessName, menu: [], notes: 'No pages captured' };
  }

  // Build message content — screenshots first (Haiku can see images), then text
  const content = [];

  // Add screenshots from up to 5 pages, with up to 3 scroll shots per page (max ~15 images total)
  let imageCount = 0;
  const MAX_IMAGES = 15;
  for (const cap of captures.slice(0, 5)) {
    if (imageCount >= MAX_IMAGES) break;
    content.push({ type: 'text', text: `Page: ${cap.url}` });
    const shots = cap.screenshots || (cap.screenshot ? [cap.screenshot] : []);
    for (const shot of shots.slice(0, 3)) {
      if (imageCount >= MAX_IMAGES) break;
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: shot } });
      imageCount++;
    }
    if (cap.text.length > 100) {
      content.push({ type: 'text', text: `Page text:\n${cap.text.substring(0, 3000)}` });
    }
  }

  content.push({ type: 'text', text: HAIKU_PROMPT });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content }],
  });

  const raw = response.content[0]?.text || '{}';

  // Parse JSON — handle any wrapping markdown
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { business_name: businessName, menu: [], notes: 'Haiku returned no JSON' };

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { business_name: businessName, menu: [], notes: 'JSON parse failed', raw_response: raw.substring(0, 500) };
  }
}

// ─── Build target list ────────────────────────────────────────────────────────

function buildList(forceRedo) {
  const all = JSON.parse(fs.readFileSync(SOURCE_FILE));
  const list = [];
  const skipped = { chain: 0, domain: 0, noSite: 0, done: 0 };

  for (const b of all) {
    const name = b.name || '';
    const url  = (b.website || '').trim();
    if (!url)                { skipped.noSite++; continue; }
    if (isNationalChain(name)) { skipped.chain++;  continue; }
    if (isSkippedDomain(url))  { skipped.domain++; continue; }

    const slug = slugify(name);
    if (!forceRedo && isDone(slug)) { skipped.done++; continue; }

    list.push({
      slug, name,
      url: url.startsWith('http') ? url : `https://${url}`,
      city: b.city || '',
      rating: b.rating || 0,
    });
  }

  list.sort((a, b) => (b.rating - a.rating));
  console.log(`  Skipped: ${skipped.chain} chains, ${skipped.domain} bad URLs, ${skipped.noSite} no website, ${skipped.done} already extracted`);
  return list;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args       = process.argv.slice(2);
  const dryRun     = args.includes('--dry-run');
  const force      = args.includes('--force');
  const startAt    = args.includes('--start') ? parseInt(args[args.indexOf('--start')+1])||0 : 0;
  const countLimit = args.includes('--count') ? parseInt(args[args.indexOf('--count')+1])||999 : 999;

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  HAIKU LIVE MENU SCRAPER                             ║');
  console.log('║  Screenshots every page → Haiku extracts full menu  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const list = buildList(force);
  console.log(`  Restaurants to process: ${list.length}\n`);

  if (dryRun) {
    list.forEach((b, i) => console.log(`  ${String(i+1).padStart(3)}. [${b.rating}★] ${b.name} (${b.city}) — ${b.url}`));
    return;
  }

  const toProcess = list.slice(startAt, startAt + countLimit);
  console.log(`Starting at #${startAt+1} — running ${toProcess.length}\n`);

  const results = [], failures = [];

  for (let i = 0; i < toProcess.length; i++) {
    const b = toProcess[i];
    const idx = startAt + i + 1;

    console.log(`\n[${idx}/${list.length}] ${b.name} (${b.city}) — ${b.rating}★`);
    console.log(`  URL: ${b.url}`);
    console.log('─'.repeat(60));

    try {
      // Step 1: Visit site and screenshot pages
      console.log('  → Visiting website...');
      const captures = await visitAndScreenshot(b.url);
      console.log(`  → Got ${captures.length} pages`);

      if (captures.length === 0) {
        console.log('  ❌ No pages captured — site blocked or down');
        failures.push({ ...b, error: 'No pages captured' });
        fs.writeFileSync(LOG_FILE, JSON.stringify({ results, failures, lastIndex: idx }, null, 2));
        continue;
      }

      // Step 2: Send to Haiku
      console.log('  → Sending to Haiku...');
      const extracted = await extractWithHaiku(b.name, captures);

      // Count what we got
      const menuItems = (extracted.menu || []).reduce((a, s) => a + (s.items||[]).length, 0);
      const pricedItems = (extracted.menu || []).reduce((a, s) => a + (s.items||[]).filter(it => it.price).length, 0);
      const hasHours = Object.values(extracted.hours || {}).some(v => v);

      extracted._meta = {
        scraped_at: new Date().toISOString(),
        pages_visited: captures.length,
        menu_sections: (extracted.menu||[]).length,
        menu_items: menuItems,
        priced_items: pricedItems,
        has_hours: hasHours,
        source_url: b.url,
      };

      // Save
      fs.writeFileSync(path.join(OUT_DIR, b.slug + '.json'), JSON.stringify(extracted, null, 2));

      const status = menuItems > 0 ? `✅ ${menuItems} items (${pricedItems} priced)` : '⚠️  No menu items found';
      console.log(`  ${status}${hasHours ? ' | hours ✓' : ''}`);

      results.push({ slug: b.slug, name: b.name, menuItems, pricedItems, pages: captures.length });

    } catch (err) {
      console.error(`  ❌ ${err.message}`);
      failures.push({ ...b, error: err.message });
    }

    fs.writeFileSync(LOG_FILE, JSON.stringify({ results, failures, lastIndex: idx, total: list.length }, null, 2));

    if (i < toProcess.length - 1) await sleep(2000);
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  DONE                                                ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Processed: ${results.length} | Failed: ${failures.length}`);
  console.log(`  With menu items: ${results.filter(r=>r.menuItems>0).length}`);
  console.log(`  Total items extracted: ${results.reduce((a,r)=>a+r.menuItems,0)}`);
  console.log(`  Results → ${OUT_DIR}`);
  if (failures.length) failures.forEach(f => console.log(`  ❌ ${f.name} — ${f.error?.substring(0,50)}`));
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
