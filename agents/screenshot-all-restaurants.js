#!/usr/bin/env node
/**
 * Screenshot All Restaurants
 * Visits each restaurant website, scrolls through every menu-related page,
 * and saves viewport screenshots to disk. No AI calls — just screenshots.
 *
 * Usage:
 *   node agents/screenshot-all-restaurants.js --dry-run
 *   node agents/screenshot-all-restaurants.js              — all restaurants
 *   node agents/screenshot-all-restaurants.js --start 10
 *   node agents/screenshot-all-restaurants.js --count 5
 *   node agents/screenshot-all-restaurants.js --force      — redo completed ones
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const puppeteer     = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs            = require('fs');
const path          = require('path');

puppeteer.use(StealthPlugin());

const SHOTS_DIR   = path.join(__dirname, '../screenshots');
const LOG_FILE    = path.join(__dirname, '../screenshot-results.json');
const SOURCE_FILE = path.join(__dirname, '../category-food-and-dining-ob-gs.json');

fs.mkdirSync(SHOTS_DIR, { recursive: true });

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
function isSkippedDomain(url)  { return SKIP_DOMAINS.some(d => (url||'').includes(d)); }

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
  const dir = path.join(SHOTS_DIR, slug);
  if (!fs.existsSync(dir)) return false;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));
  return files.length > 0;
}

// ─── Visit & screenshot ───────────────────────────────────────────────────────

async function visitAndScreenshot(slug, startUrl) {
  const outDir = path.join(SHOTS_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-blink-features=AutomationControlled','--disable-dev-shm-usage'],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });

  const visited  = new Set();
  const toVisit  = [startUrl.replace(/\/$/, '')];
  const MAX      = 15; // max pages per restaurant
  let   fileIdx  = 1;
  const index    = []; // { url, files[] }

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

      // Get page height and scroll, taking a screenshot at each viewport stop
      const pageHeight = await page.evaluate(() => document.body.scrollHeight);
      const viewH      = 900;
      const stops      = Math.min(8, Math.ceil(pageHeight / viewH));
      const pageFiles  = [];

      for (let s = 0; s < stops; s++) {
        const scrollY = Math.floor((s / Math.max(stops - 1, 1)) * Math.max(pageHeight - viewH, 0));
        await page.evaluate(y => window.scrollTo(0, y), scrollY);
        await sleep(250);

        const filename = `page-${String(fileIdx).padStart(3, '0')}.jpg`;
        const filepath = path.join(outDir, filename);
        await page.screenshot({ path: filepath, fullPage: false, type: 'jpeg', quality: 80 });
        pageFiles.push(filename);
        fileIdx++;
      }

      // Collect links for next pages
      const links = await page.evaluate(() =>
        [...document.querySelectorAll('a[href]')].map(a => a.href).filter(h => h && !h.startsWith('javascript') && !h.startsWith('mailto') && !h.startsWith('tel'))
      ).catch(() => []);

      for (const link of links) {
        const norm = normalizeUrl(link, startUrl);
        if (!norm || !isSameDomain(norm, startUrl)) continue;
        if (visited.has(norm) || toVisit.includes(norm)) continue;
        if (SKIP_URL.test(norm)) continue;
        MENU_URLS.test(norm) ? toVisit.unshift(norm) : toVisit.push(norm);
      }

      index.push({ url, files: pageFiles });
      console.log(`      ${pageH_or_stops(pageHeight, stops)} → ${pageFiles.length} screenshots`);

    } catch (err) {
      console.log(`      ⚠️  ${err.message.substring(0, 60)}`);
    } finally {
      await page.close().catch(() => {});
    }

    await sleep(400);
  }

  await browser.close();

  // Save index.json so the AI extraction script knows which files belong to which URL
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({
    slug,
    source_url: startUrl,
    scraped_at: new Date().toISOString(),
    pages: index,
    total_screenshots: fileIdx - 1,
  }, null, 2));

  return { pages: visited.size, screenshots: fileIdx - 1 };
}

function pageH_or_stops(h, stops) {
  return `${h.toLocaleString()}px page → ${stops} stops`;
}

// ─── Build list ───────────────────────────────────────────────────────────────

function buildList(forceRedo) {
  const all = JSON.parse(fs.readFileSync(SOURCE_FILE));
  const list = [];
  const skipped = { chain: 0, domain: 0, noSite: 0, done: 0 };

  for (const b of all) {
    const name = b.name || '';
    const url  = (b.website || '').trim();
    if (!url)                  { skipped.noSite++; continue; }
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
  console.log(`  Skipped: ${skipped.chain} chains, ${skipped.domain} bad URLs, ${skipped.noSite} no website, ${skipped.done} already done`);
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
  console.log('║  SCREENSHOT ALL RESTAURANTS                          ║');
  console.log('║  Saves viewport screenshots — no AI calls            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const list = buildList(force);
  console.log(`  Restaurants to screenshot: ${list.length}\n`);

  if (dryRun) {
    list.forEach((b, i) => console.log(`  ${String(i+1).padStart(3)}. [${b.rating}★] ${b.name} (${b.city}) — ${b.url}`));
    return;
  }

  const toProcess = list.slice(startAt, startAt + countLimit);
  console.log(`Starting at #${startAt+1} — running ${toProcess.length}\n`);

  const results = [], failures = [];

  for (let i = 0; i < toProcess.length; i++) {
    const b   = toProcess[i];
    const idx = startAt + i + 1;

    console.log(`\n[${idx}/${list.length}] ${b.name} (${b.city}) — ${b.rating}★`);
    console.log(`  URL: ${b.url}`);
    console.log('─'.repeat(60));

    try {
      const { pages, screenshots } = await visitAndScreenshot(b.slug, b.url);
      console.log(`  ✅ ${pages} pages → ${screenshots} screenshots saved → screenshots/${b.slug}/`);
      results.push({ slug: b.slug, name: b.name, pages, screenshots });
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
      failures.push({ ...b, error: err.message });
    }

    fs.writeFileSync(LOG_FILE, JSON.stringify({ results, failures, lastIndex: idx, total: list.length }, null, 2));

    if (i < toProcess.length - 1) await sleep(1500);
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  DONE                                                ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Processed: ${results.length} | Failed: ${failures.length}`);
  console.log(`  Total screenshots: ${results.reduce((a,r)=>a+r.screenshots,0)}`);
  console.log(`  Saved → ${SHOTS_DIR}`);
  if (failures.length) failures.forEach(f => console.log(`  ❌ ${f.name} — ${f.error?.substring(0,50)}`));
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
