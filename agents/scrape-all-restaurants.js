#!/usr/bin/env node
/**
 * Scrape ALL Orange Beach & Gulf Shores restaurants
 * Uses the same fresh-tab-per-URL approach as the original batch-scraper that got 743k chars
 *
 * Captures: JS-rendered text, tree-walker (web components), iframes, PDFs, structured data
 * Skips: WP junk, other-city location pages, blogs, author pages, franchise chain URLs
 *
 * Usage:
 *   node agents/scrape-all-restaurants.js --dry-run
 *   node agents/scrape-all-restaurants.js              — all missing
 *   node agents/scrape-all-restaurants.js --force      — re-scrape all 129
 *   node agents/scrape-all-restaurants.js --start 10
 *   node agents/scrape-all-restaurants.js --count 3    — only N restaurants
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const puppeteer     = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const pdfParse      = require('pdf-parse');
const fs            = require('fs');
const path          = require('path');
const https         = require('https');
const http          = require('http');

puppeteer.use(StealthPlugin());

const MAX_PAGES  = 25;
const BASE_DIR   = path.join(__dirname, '../scraped-menus');
const LOG_FILE   = path.join(__dirname, '../scrape-all-restaurants-results.json');
const SOURCE_FILE = path.join(__dirname, '../category-food-and-dining-ob-gs.json');

const NATIONAL_CHAINS = [
  'subway','mcdonalds','mcdonald-s','burger-king','wendys','wendy-s',
  'chick-fil-a','chickfila','taco-bell','dominos','pizza-hut','popeyes','kfc',
  'starbucks','dunkin','five-guys','cracker-barrel','ihop','denny-s','dennys',
  'outback','cheesecake-factory','panera','chipotle','firehouse-subs',
  'jersey-mikes','jimmy-johns','jason-deli','ruby-tuesday','applebees',
  'olive-garden','red-lobster','waffle-house','hooters','sonic-drive-in',
  'hardees','arbys','bojangles','cookout','zaxbys','krispy-kreme',
  'dairy-queen','honey-baked-ham','papa-john',
];

const SKIP_DOMAINS = [
  'marriott.com','hilton.com','facebook.com','bit.ly',
  'yelp.com','tripadvisor.com','grubhub.com','doordash.com',
  'ubereats.com','opentable.com','google.com','instagram.com',
  'cefcostores.com','fourteenfoods.com',
];

const MENU_IFRAME_PROVIDERS = [
  'toasttab.com','squareup.com','bentobox.com','popmenu.com',
  'menupages.com','allmenus.com','menudrive.com','ordermark.com',
  'olo.com','chownow.com','restolabs.com','bopple.com',
  'flipdish.com','singleplatform.com','upserve.com',
];

// URL patterns never useful for a local restaurant scrape
const SKIP_URL = /\/(author|tag|category|blog|news|press|careers|jobs|franchise|investor|corporate|privacy|terms|cookie|sitemap|wp-json|wp-admin|wp-login|wp-content\/uploads|feed|rss|cdn-cgi|locations\/(?!gulf|orange|alabama|foley|fairhope|perdido|mobile|pensacola)[a-z])|\?p=|\?page_id=/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isNationalChain(name) {
  const slug = slugify(name);
  return NATIONAL_CHAINS.some(f => slug.includes(f));
}

function isSkippedDomain(url) {
  return SKIP_DOMAINS.some(d => (url || '').includes(d));
}

function isMenuIframeProvider(url) {
  return MENU_IFRAME_PROVIDERS.some(p => (url || '').includes(p));
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

function hasGoodScrape(slug) {
  const rawPath = path.join(BASE_DIR, slug, 'raw.json');
  if (!fs.existsSync(rawPath)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(rawPath));
    const pages = (raw.pages || []).length;
    const chars = (raw.pages || []).reduce((a, p) => a + (p.text || '').length, 0);
    return pages > 1 && chars >= 3000;
  } catch { return false; }
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 20000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function extractPdfText(url) {
  try {
    const buf = await downloadBuffer(url);
    const result = await pdfParse(buf);
    return result.text || '';
  } catch { return ''; }
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

async function dismissPopups(page) {
  try {
    const sels = [
      'button[id*="accept"]','button[id*="agree"]','button[id*="close"]',
      'button[class*="accept"]','button[class*="close"]','button[class*="dismiss"]',
      '[aria-label*="close" i]','[aria-label*="dismiss" i]',
      'button[id*="cookie"]','.cookie-accept','#age-gate button',
    ];
    for (const sel of sels) {
      try {
        const btn = await page.$(sel);
        if (btn) { await btn.click(); await sleep(300); }
      } catch {}
    }
  } catch {}
}

async function expandMenuSections(page) {
  try {
    const els = await page.$$('a,button,[role="tab"],[class*="accordion"],[class*="tab"]');
    for (const el of els) {
      try {
        const text = await el.evaluate(e => (e.innerText || e.textContent || e.getAttribute('aria-label') || '').trim());
        if (/menu|lunch|dinner|brunch|drinks|cocktail|wine|beer|bar|appetizer|entree|kids|specials|happy.hour|dessert|sides|starters|seafood|oyster/i.test(text)) {
          const visible = await el.isIntersectingViewport().catch(() => false);
          if (visible) { await el.click(); await sleep(600); }
        }
      } catch {}
    }
  } catch {}
}

async function scrollToBottom(page) {
  try {
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let total = 0;
        const dist = 500;
        const timer = setInterval(() => {
          window.scrollBy(0, dist);
          total += dist;
          if (total >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 120);
        setTimeout(() => { clearInterval(timer); resolve(); }, 12000);
      });
    });
    await sleep(800);
  } catch {}
}

async function readSameOriginIframes(page, baseUrl) {
  const texts = [];
  try {
    for (const frame of page.frames().filter(f => f !== page.mainFrame())) {
      try {
        const fUrl = frame.url();
        if (!fUrl || !isSameDomain(fUrl, baseUrl)) continue;
        const text = await frame.evaluate(() => document.body?.innerText || '').catch(() => '');
        if (text.length > 100) texts.push(text);
      } catch {}
    }
  } catch {}
  return texts;
}

// ─── Core scraper — fresh tab per URL (proven approach from original batch-scraper) ──

async function scrapeSite(startUrl) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-blink-features=AutomationControlled','--disable-dev-shm-usage'],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });

  const visited     = new Set();
  const toVisit     = [startUrl.replace(/\/$/, '')];
  const pages       = [];
  const pdfUrls     = new Set();
  const imageUrls   = new Set();
  const menuIframes = new Set();
  const seenChars   = new Map();
  let businessName  = '';

  const priorityWords = /menu|food|drink|happy.hour|special|event|about|hours|contact|entertainment|price|rate|seafood|cocktail|brunch|oyster/i;

  while (toVisit.length > 0 && visited.size < MAX_PAGES) {
    const url = toVisit.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    // ── PDF ───────────────────────────────────────────────────────────────────
    if (/\.pdf(\?|$)/i.test(url)) {
      const text = await extractPdfText(url);
      if (text.trim().length > 50) {
        pages.push({ url, title: 'PDF Menu', text: text.substring(0, 30000), structuredData: [], meta: {} });
        console.log(`  [PDF] ${text.length.toLocaleString()} chars — ${url.substring(0, 60)}`);
      }
      continue;
    }

    // ── Fresh tab per URL ─────────────────────────────────────────────────────
    const page = await browser.newPage();
    try {
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 900 });

      // Block images & fonts — faster load, text renders sooner
      await page.setRequestInterception(true);
      page.on('request', req => {
        if (/image|font|media/.test(req.resourceType())) req.abort();
        else req.continue();
      });

      console.log(`  [${visited.size}/${MAX_PAGES}] ${url.substring(0, 80)}`);
      const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      if (!resp) { await page.close(); continue; }

      await sleep(2000);
      await dismissPopups(page);
      await expandMenuSections(page);
      await scrollToBottom(page);
      await expandMenuSections(page);
      await sleep(800);

      // Grab iframe srcs for menu providers
      const iframeSrcs = await page.evaluate(() =>
        [...document.querySelectorAll('iframe[src]')].map(f => f.src).filter(s => s.startsWith('http'))
      ).catch(() => []);

      for (const src of iframeSrcs) {
        if (/\.pdf$/i.test(src)) { pdfUrls.add(src); continue; }
        if (isMenuIframeProvider(src) && !visited.has(src) && !toVisit.includes(src)) {
          menuIframes.add(src);
          toVisit.unshift(src);
          console.log(`    → menu iframe: ${src.substring(0, 70)}`);
        }
      }

      const iframeTexts = await readSameOriginIframes(page, startUrl);

      const content = await page.evaluate(() => {
        const title    = document.title || '';
        const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
        const ogDesc   = document.querySelector('meta[property="og:description"]')?.content || '';

        document.querySelectorAll('script,style,noscript,svg').forEach(el => el.remove());

        // Strategy 1: innerText
        const innerText = document.body?.innerText || '';

        // Strategy 2: tree walker — catches web components / custom elements
        function walkText(root) {
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              const tag = node.parentElement?.tagName?.toLowerCase() || '';
              if (['script','style','noscript','svg','path'].includes(tag)) return NodeFilter.FILTER_REJECT;
              return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
          });
          const out = [];
          let n;
          while ((n = walker.nextNode())) out.push(n.textContent.trim());
          return out.join('\n');
        }
        const walkerText = walkText(document.body);

        // Use whichever got more text
        const bestText = walkerText.length > innerText.length ? walkerText : innerText;

        const structured = [];
        document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
          try { structured.push(JSON.parse(s.textContent)); } catch {}
        });

        const links = [...document.querySelectorAll('a[href]')]
          .map(a => a.href)
          .filter(h => h && !h.startsWith('javascript') && !h.startsWith('mailto') && !h.startsWith('tel'));

        const images = [...document.querySelectorAll('img[src]')]
          .map(i => i.src).filter(s => s && s.startsWith('http'));

        return { title, bestText, structured, links, images, metaDesc, ogDesc };
      });

      if (!businessName && content.title) {
        businessName = content.title.split(/[|\-–]/)[0].trim();
      }

      content.images.forEach(i => imageUrls.add(i));

      const combinedText = [content.bestText, ...iframeTexts].join('\n\n').trim();

      // SPA loop detection
      const charKey = combinedText.length;
      seenChars.set(charKey, (seenChars.get(charKey) || 0) + 1);
      if (seenChars.get(charKey) >= 3) {
        console.log(`    ⚠️  Same content 3x (${charKey} chars) — SPA loop, stopping`);
        toVisit.length = 0;
      }

      for (const link of content.links) {
        if (/\.pdf(\?|$)/i.test(link)) { pdfUrls.add(link); continue; }
        const norm = normalizeUrl(link, startUrl);
        if (!norm) continue;
        if (isSameDomain(norm, startUrl)) {
          if (!visited.has(norm) && !toVisit.includes(norm) && !SKIP_URL.test(norm)) {
            priorityWords.test(norm) ? toVisit.unshift(norm) : toVisit.push(norm);
          }
        } else if (isMenuIframeProvider(norm) && !visited.has(norm) && !toVisit.includes(norm)) {
          toVisit.unshift(norm);
        }
      }

      pages.push({
        url,
        title: content.title,
        text:  combinedText.substring(0, 30000),
        structuredData: content.structured,
        meta: { description: content.metaDesc || content.ogDesc },
      });

      const extras = iframeTexts.length ? ` | ${iframeTexts.length} iframe(s)` : '';
      console.log(`    ${combinedText.length.toLocaleString()} chars, ${content.links.length} links${extras}`);

    } catch (err) {
      console.log(`  ⚠️  ${url.substring(0, 60)} — ${err.message.substring(0, 60)}`);
    } finally {
      await page.close().catch(() => {});
    }

    await sleep(400);
  }

  // Extract any PDFs found during crawl
  for (const pdfUrl of [...pdfUrls]) {
    if (visited.has(pdfUrl)) continue;
    const text = await extractPdfText(pdfUrl);
    if (text.trim().length > 50) {
      pages.push({ url: pdfUrl, title: 'PDF Menu', text: text.substring(0, 30000), structuredData: [], meta: {} });
      console.log(`  [PDF] ${text.length.toLocaleString()} chars — ${pdfUrl.substring(0, 60)}`);
    }
  }

  await browser.close();
  return { pages, pdfUrls: [...pdfUrls], imageUrls, menuIframes: [...menuIframes], businessName };
}

// ─── Build target list ────────────────────────────────────────────────────────

function buildTargetList(forceRescrape = false) {
  const all = JSON.parse(fs.readFileSync(SOURCE_FILE));
  console.log(`\n  Total in Google Places food/dining file: ${all.length}`);

  const list   = [];
  const noSite = [];
  const skipped = { chain: 0, domain: 0, noWebsite: 0, alreadyGood: 0 };

  for (const b of all) {
    const name = b.name || '';
    const url  = (b.website || '').trim();

    if (!url) { skipped.noWebsite++; noSite.push(name); continue; }
    if (isNationalChain(name))  { skipped.chain++;  continue; }
    if (isSkippedDomain(url))   { skipped.domain++; continue; }

    const slug = slugify(name);
    if (!forceRescrape && hasGoodScrape(slug)) { skipped.alreadyGood++; continue; }

    let currentPages = 0, currentChars = 0;
    const rawPath = path.join(BASE_DIR, slug, 'raw.json');
    if (fs.existsSync(rawPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(rawPath));
        currentPages = (raw.pages || []).length;
        currentChars = (raw.pages || []).reduce((a, p) => a + (p.text || '').length, 0);
      } catch {}
    }

    let status = 'NOT SCRAPED';
    if (currentPages === 0)      status = '0 pages';
    else if (currentPages === 1) status = '1 page only';
    else                         status = `${currentPages} pages, ${currentChars.toLocaleString()} chars`;

    list.push({
      slug, name,
      url: url.startsWith('http') ? url : `https://${url}`,
      city: b.city || '',
      rating: b.rating || 0,
      reviews: b.reviews_count || 0,
      currentPages, currentChars, status,
    });
  }

  list.sort((a, b) => (b.rating - a.rating) || (b.reviews - a.reviews));

  console.log(`  Skipped: ${skipped.chain} chains, ${skipped.domain} hotel/social URLs, ${skipped.noWebsite} no website, ${skipped.alreadyGood} already good`);
  if (noSite.length) console.log(`  No website: ${noSite.join(', ')}`);
  return list;
}

// ─── Save ─────────────────────────────────────────────────────────────────────

async function scrapeAndSave(business) {
  const { slug, name, url } = business;
  const { pages, pdfUrls, imageUrls, menuIframes, businessName: detected } = await scrapeSite(url);
  const finalName = name || detected || slug;

  const outDir = path.join(BASE_DIR, slug);
  fs.mkdirSync(outDir, { recursive: true });

  const rawFile = path.join(outDir, 'raw.json');
  if (fs.existsSync(rawFile)) fs.copyFileSync(rawFile, path.join(outDir, 'raw.backup.json'));

  fs.writeFileSync(rawFile, JSON.stringify({
    business_name: finalName,
    url,
    scraped_at:    new Date().toISOString(),
    scraper:       'scrape-all-restaurants-v3',
    pages,
    pdfUrls,
    menuIframeUrls: menuIframes,
    imageUrls: [...imageUrls].filter(u => /\.(jpg|jpeg|png|webp)/i.test(u)).slice(0, 50),
  }, null, 2));

  const totalChars = pages.reduce((a, p) => a + (p.text || '').length, 0);
  const pdfCount   = pages.filter(p => p.title === 'PDF Menu').length;
  console.log(`  ✓ ${pages.length} pages | ${totalChars.toLocaleString()} chars${pdfCount ? ' | '+pdfCount+' PDF(s)' : ''} | ${rawFile}`);

  return { slug, name: finalName, pages: pages.length, chars: totalChars, pdfs: pdfCount, iframes: menuIframes.length };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args          = process.argv.slice(2);
  const dryRun        = args.includes('--dry-run');
  const forceRescrape = args.includes('--force');
  const startAt       = args.includes('--start') ? parseInt(args[args.indexOf('--start') + 1]) || 0 : 0;
  const countLimit    = args.includes('--count') ? parseInt(args[args.indexOf('--count') + 1]) || 999 : 999;

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  SCRAPE ALL OB & GS RESTAURANTS                     ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const list = buildTargetList(forceRescrape);
  console.log(`\n  Restaurants to scrape: ${list.length}`);

  if (dryRun) {
    list.forEach((b, i) => {
      console.log(`  ${String(i+1).padStart(3)}. [${b.rating}★] ${b.name} (${b.city})`);
      console.log(`       ${b.url}`);
      console.log(`       ${b.status}\n`);
    });
    console.log(`Total: ${list.length}`);
    return;
  }

  const toProcess = list.slice(startAt, startAt + countLimit);
  console.log(`\nStarting at #${startAt + 1} — running ${toProcess.length}\n`);

  const results = [], failures = [];

  for (let i = 0; i < toProcess.length; i++) {
    const b = toProcess[i];
    const globalIdx = startAt + i + 1;

    console.log(`\n[${globalIdx}/${list.length}] ${b.name} (${b.city})`);
    console.log(`  ${b.rating}★ | ${b.url}`);
    console.log(`  Before: ${b.status}`);
    console.log('─'.repeat(60));

    try {
      const result = await scrapeAndSave(b);
      results.push(result);
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
      failures.push({ ...b, error: err.message });
    }

    fs.writeFileSync(LOG_FILE, JSON.stringify({ results, failures, lastIndex: globalIdx, total: list.length }, null, 2));

    if (i < toProcess.length - 1) await sleep(3000);
  }

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  DONE                                                ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`  Scraped: ${results.length} | Failed: ${failures.length}`);
  console.log(`  Good data (2p+, 3k+): ${results.filter(r => r.pages > 1 && r.chars >= 3000).length}/${results.length}`);
  if (failures.length) failures.forEach(f => console.log(`  ❌ ${f.name} — ${f.error?.substring(0,60)}`));
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
