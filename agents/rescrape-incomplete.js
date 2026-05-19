#!/usr/bin/env node
/**
 * Re-scrape all local businesses with incomplete raw data
 * Targets: 0-page failures, single-page scrapes, and under-3k-char sites
 *
 * Usage:
 *   node agents/rescrape-incomplete.js           — run all 178
 *   node agents/rescrape-incomplete.js --dry-run — list without scraping
 *   node agents/rescrape-incomplete.js --start 50 — resume from index 50
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs   = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const MAX_PAGES = 60;
const BASE_DIR  = path.join(__dirname, '../scraped-menus');
const LOG_FILE  = path.join(__dirname, '../rescrape-results.json');

const FRANCHISES = [
  'planet-fitness','amc-classic','holiday-inn','springhill-suites',
  'hotel-indigo','best-western','hotworx','acme-oyster','chicken-salad-chick',
  'longhorn','rotolo','topsail-steamer','breakout-games','massage-envy',
  'anytime-fitness','prichard-boxing','premier-studios','evolve-fitness',
  'neighborhood-barre','moxie-lifestyle','pura-vida','glow-yoga'
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isFranchise(slug) {
  return FRANCHISES.some(f => slug.includes(f));
}

function normalizeUrl(href, base) {
  try {
    const u = new URL(href, base);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch { return null; }
}

function isSameDomain(url, base) {
  try {
    const a = new URL(url);
    const b = new URL(base);
    return a.hostname === b.hostname || a.hostname.endsWith('.' + b.hostname);
  } catch { return false; }
}

// ─── Build the rescrape list ─────────────────────────────────────────────────

function buildRescrapeList() {
  const dirs = fs.readdirSync(BASE_DIR)
    .filter(d => fs.statSync(path.join(BASE_DIR, d)).isDirectory());

  const list = [];

  dirs.forEach(slug => {
    if (isFranchise(slug)) return;

    const rawPath = path.join(BASE_DIR, slug, 'raw.json');
    if (!fs.existsSync(rawPath)) return;

    try {
      const raw = JSON.parse(fs.readFileSync(rawPath));
      const pageCount  = (raw.pages || []).length;
      const totalChars = (raw.pages || []).reduce((a, p) => a + (p.text || '').length, 0);

      if (pageCount <= 1 || totalChars < 3000) {
        let reason = '';
        if (pageCount === 0)      reason = '0 pages scraped';
        else if (pageCount === 1) reason = '1 page only';
        else                      reason = `${pageCount} pages but only ${totalChars.toLocaleString()} chars`;

        list.push({
          slug,
          name: raw.business_name || slug,
          url:  raw.url,
          pages: pageCount,
          chars: totalChars,
          reason,
        });
      }
    } catch (e) {}
  });

  return list;
}

// ─── Scraper ─────────────────────────────────────────────────────────────────

async function scrapeSite(startUrl) {
  console.log('  Launching Chrome...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox', '--disable-blink-features=AutomationControlled'],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  const visited   = new Set();
  const toVisit   = [startUrl.replace(/\/$/, '')];
  const pages     = [];
  const pdfUrls   = new Set();
  const imageUrls = new Set();
  let businessName = '';

  const priorityWords = /menu|food|drink|happy.hour|special|event|about|hours|contact|live.music|entertainment|package|price|rate|tour|trip|charter|activit|amenit|service|class|schedule/i;

  while (toVisit.length > 0 && visited.size < MAX_PAGES) {
    const url = toVisit.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    try {
      console.log(`  [${visited.size}/${MAX_PAGES}] ${url.substring(0, 80)}`);

      const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      if (!resp) continue;

      await sleep(3000);
      await dismissPopups(page);
      await expandSections(page);
      await sleep(1500);

      const content = await page.evaluate(() => {
        document.querySelectorAll('script,style,noscript,iframe,svg').forEach(el => el.remove());

        const title    = document.title || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
        const ogDesc   = document.querySelector('meta[property="og:description"]')?.content || '';
        const text     = document.body?.innerText || '';

        const structured = [];
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
          try { structured.push(JSON.parse(s.textContent)); } catch {}
        });

        const links  = [...document.querySelectorAll('a[href]')]
          .map(a => a.href)
          .filter(h => h && !h.startsWith('javascript') && !h.startsWith('mailto') && !h.startsWith('tel'));

        const images = [...document.querySelectorAll('img[src]')]
          .map(i => i.src)
          .filter(s => s && s.startsWith('http'));

        return { title, text, links, images, structured, metaDesc, ogDesc };
      });

      if (!businessName && content.title) {
        businessName = content.title.split('|')[0].split('-')[0].split('–')[0].trim();
      }

      content.images.forEach(i => imageUrls.add(i));

      for (const link of content.links) {
        if (link.endsWith('.pdf')) { pdfUrls.add(link); continue; }
        const norm = normalizeUrl(link, startUrl);
        if (!norm || !isSameDomain(norm, startUrl)) continue;
        if (!visited.has(norm) && !toVisit.includes(norm)) {
          priorityWords.test(norm) ? toVisit.unshift(norm) : toVisit.push(norm);
        }
      }

      pages.push({
        url,
        title: content.title,
        text:  content.text.substring(0, 30000),
        structuredData: content.structured,
        meta: { description: content.metaDesc || content.ogDesc },
      });

      console.log(`    ${content.text.length.toLocaleString()} chars, ${content.links.length} links found`);

    } catch (err) {
      console.log(`  ⚠️  ${url.substring(0, 60)} — ${err.message.substring(0, 60)}`);
    }

    if (visited.size < MAX_PAGES && toVisit.length > 0) await sleep(1000);
  }

  await browser.close();
  return { pages, pdfUrls: [...pdfUrls], imageUrls, businessName };
}

async function dismissPopups(page) {
  try {
    const selectors = [
      'button[id*="accept"]','button[id*="agree"]','button[id*="close"]',
      'button[class*="accept"]','button[class*="close"]','button[class*="dismiss"]',
      '[aria-label*="close"]','[aria-label*="dismiss"]',
      'button[id*="cookie"]','.cookie-accept','#age-gate button',
    ];
    for (const sel of selectors) {
      try {
        const btn = await page.$(sel);
        if (btn) { await btn.click(); await sleep(500); }
      } catch {}
    }
  } catch {}
}

async function expandSections(page) {
  try {
    const elements = await page.$$('a, button');
    for (const el of elements) {
      try {
        const text = await el.evaluate(e => e.innerText || e.textContent || '');
        if (/menu|lunch|dinner|drinks|bar|appetizer|entree|kids|specials|services|classes/i.test(text)) {
          const visible = await el.isIntersectingViewport().catch(() => false);
          if (visible) {
            await el.click();
            await sleep(1200);
          }
        }
      } catch {}
    }
  } catch {}
}

async function scrapeAndSave(business) {
  const { slug, name, url } = business;
  const startUrl = url.startsWith('http') ? url : `https://${url}`;

  const { pages, pdfUrls, imageUrls, businessName: detected } = await scrapeSite(startUrl);
  const finalName = name || detected || slug;

  const outDir  = path.join(BASE_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });

  // Back up old raw.json if it exists
  const rawFile = path.join(outDir, 'raw.json');
  if (fs.existsSync(rawFile)) {
    fs.copyFileSync(rawFile, path.join(outDir, 'raw.backup.json'));
  }

  const raw = {
    business_name: finalName,
    url:           startUrl,
    scraped_at:    new Date().toISOString(),
    scraper:       'rescrape-incomplete',
    pages,
    pdfUrls,
    imageUrls: [...imageUrls].filter(u => /\.(jpg|jpeg|png|webp)/i.test(u)).slice(0, 50),
  };

  fs.writeFileSync(rawFile, JSON.stringify(raw, null, 2));

  const totalChars = pages.reduce((a, p) => a + (p.text || '').length, 0);
  console.log(`  Pages: ${pages.length} | Chars: ${totalChars.toLocaleString()} | Saved → ${rawFile}`);

  return { slug, name: finalName, pages: pages.length, chars: totalChars };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2);
  const dryRun  = args.includes('--dry-run');
  const startAt = args.includes('--start') ? parseInt(args[args.indexOf('--start') + 1]) || 0 : 0;

  const list = buildRescrapeList();

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  RE-SCRAPE INCOMPLETE BUSINESSES                     ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Total needing re-scrape: ${list.length}`);
  console.log(`  Zero pages:  ${list.filter(x => x.pages === 0).length}`);
  console.log(`  One page:    ${list.filter(x => x.pages === 1).length}`);
  console.log(`  Thin data:   ${list.filter(x => x.pages > 1 && x.chars < 3000).length}`);

  if (dryRun) {
    console.log('\n── DRY RUN — businesses that will be re-scraped ──\n');
    list.forEach((b, i) => {
      console.log(`  ${String(i + 1).padStart(3)}. ${b.name}`);
      console.log(`       URL: ${b.url}`);
      console.log(`       Why: ${b.reason}\n`);
    });
    console.log(`Total: ${list.length} businesses`);
    return;
  }

  const toProcess = list.slice(startAt);
  console.log(`\nStarting at index ${startAt} — ${toProcess.length} remaining\n`);

  const results  = [];
  const failures = [];

  for (let i = 0; i < toProcess.length; i++) {
    const business = toProcess[i];
    const globalIdx = startAt + i + 1;

    console.log(`\n[${globalIdx}/${list.length}] ${business.name}`);
    console.log(`  URL:    ${business.url}`);
    console.log(`  Before: ${business.pages} pages, ${business.chars.toLocaleString()} chars`);
    console.log('─'.repeat(60));

    try {
      const result = await scrapeAndSave(business);
      results.push(result);

      const improved = result.pages > business.pages;
      console.log(`  ${improved ? '✅ IMPROVED' : '⚠️  SAME'}: ${result.pages} pages (was ${business.pages})`);
    } catch (err) {
      console.error(`  ❌ FAILED: ${err.message}`);
      failures.push({ ...business, error: err.message });
    }

    // Save progress after each business
    fs.writeFileSync(LOG_FILE, JSON.stringify({ results, failures, lastIndex: globalIdx }, null, 2));

    if (i < toProcess.length - 1) {
      console.log('  Pausing 4s...');
      await sleep(4000);
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  RE-SCRAPE COMPLETE                                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Scraped: ${results.length} | Failed: ${failures.length}`);
  console.log(`  Log saved → ${LOG_FILE}`);

  const improved = results.filter(r => r.pages > 1);
  console.log(`\n  Got better data: ${improved.length}/${results.length}`);
  if (failures.length) {
    console.log('\n  Failures (may need manual scrape or are blocking bots):');
    failures.forEach(f => console.log(`    ❌ ${f.name} — ${f.error?.substring(0, 60)}`));
  }
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
