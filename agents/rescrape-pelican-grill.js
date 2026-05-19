#!/usr/bin/env node
/**
 * Re-scrape Pelican Grill with full menu expansion
 * Uses Chrome scraper to get all dynamic content
 *
 * Run:
 *   node agents/rescrape-pelican-grill.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const PELICAN_URL = 'https://pelicangrillob.com/';
const PELICAN_NAME = 'Pelican Grill';
const OUT_DIR = path.join(__dirname, '../scraped-menus/pelican-grill');
const MAX_PAGES = 30;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

async function dismissPopups(page) {
  try {
    const selectors = [
      'button[id*="accept"]', 'button[id*="agree"]', 'button[id*="close"]',
      'button[class*="accept"]', 'button[class*="close"]', 'button[class*="dismiss"]',
      '[aria-label*="close"]', '[aria-label*="dismiss"]',
      'button[id*="cookie"]', '.cookie-accept', '#age-gate button'
    ];
    for (const sel of selectors) {
      try {
        const btn = await page.$(sel);
        if (btn) { await btn.click(); await sleep(300); }
      } catch {}
    }
  } catch {}
}

async function expandSections(page) {
  try {
    console.log('  🔓 Expanding menu sections...');
    const selectors = [
      '[class*="tab"]', '[role="tab"]', '[class*="accordion"]',
      '[class*="toggle"]', 'button[class*="menu"]',
      'button:has-text("Menu")', 'button:has-text("See More")',
      'button:has-text("Show More")', 'button:has-text("View Menu")',
      'button:has-text("More")', 'button:has-text("Click Here")',
      '[class*="expand"]', '[class*="more"]'
    ];

    for (const sel of selectors) {
      try {
        const btns = await page.$$(sel);
        for (const btn of btns.slice(0, 20)) {
          try {
            const visible = await btn.isIntersectingViewport().catch(() => false);
            if (visible) {
              await btn.click();
              await sleep(500);
            }
          } catch {}
        }
      } catch {}
    }
    console.log('  ✅ Menu sections expanded');
  } catch {}
}

async function scrapePelicanGrill() {
  console.log('\n🍽️  RE-SCRAPING: Pelican Grill');
  console.log('═'.repeat(70));
  console.log(`URL: ${PELICAN_URL}`);
  console.log(`Output: ${OUT_DIR}\n`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled'
      ],
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    const visited = new Set();
    const toVisit = [PELICAN_URL.replace(/\/$/, '')];
    const pages = [];
    const pdfUrls = new Set();
    const imageUrls = new Set();

    const priorityWords = /menu|food|drink|happy.hour|special|event|about|hours|contact|live.music|entertainment|catering|wine|beer|appetizer|entree/i;

    while (toVisit.length > 0 && visited.size < MAX_PAGES) {
      const url = toVisit.shift();
      if (!url || visited.has(url)) continue;
      visited.add(url);

      try {
        console.log(`[${visited.size}/${MAX_PAGES}] Fetching: ${url}`);

        const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        if (!resp) continue;

        await sleep(1500);
        await dismissPopups(page);
        await expandSections(page);

        // Scroll to load lazy content
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        await sleep(1000);

        const content = await page.evaluate(() => {
          const remove = document.querySelectorAll('script,style,noscript,iframe,svg');
          remove.forEach(el => el.remove());

          const title = document.title || '';
          const text = document.body?.innerText || '';

          const links = [...document.querySelectorAll('a[href]')]
            .map(a => a.href)
            .filter(h => h && !h.startsWith('javascript') && !h.startsWith('mailto') && !h.startsWith('tel'));

          const images = [...document.querySelectorAll('img[src]')]
            .map(i => i.src)
            .filter(s => s && s.startsWith('http'));

          return { title, text, links, images };
        });

        for (const link of content.links) {
          if (link.endsWith('.pdf')) {
            pdfUrls.add(link);
            continue;
          }
          const norm = normalizeUrl(link, PELICAN_URL);
          if (!norm || !isSameDomain(norm, PELICAN_URL)) continue;
          if (!visited.has(norm) && !toVisit.includes(norm)) {
            if (priorityWords.test(norm)) {
              toVisit.unshift(norm);
            } else {
              toVisit.push(norm);
            }
          }
        }

        content.images.forEach(i => imageUrls.add(i));

        pages.push({
          url,
          title: content.title,
          text: content.text,
          html: await page.content()
        });

        console.log(`  ✅ ${content.text.length.toLocaleString()} chars`);

      } catch (err) {
        console.log(`  ⚠️  Error: ${err.message.substring(0, 60)}`);
      }

      if (visited.size < MAX_PAGES && toVisit.length > 0) await sleep(1000);
    }

    await browser.close();

    // Save raw.json
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const rawData = {
      business_name: PELICAN_NAME,
      url: PELICAN_URL,
      scraped_at: new Date().toISOString(),
      total_pages: pages.length,
      pages: pages,
      pdfUrls: [...pdfUrls],
      imageUrls: [...imageUrls]
    };

    const rawFile = path.join(OUT_DIR, 'raw.json');
    fs.writeFileSync(rawFile, JSON.stringify(rawData, null, 2));

    console.log('\n✅ SCRAPE COMPLETE');
    console.log('═'.repeat(70));
    console.log(`Pages: ${pages.length}`);
    console.log(`Total chars: ${pages.reduce((s, p) => s + p.text.length, 0).toLocaleString()}`);
    console.log(`PDFs: ${pdfUrls.size}`);
    console.log(`Images: ${imageUrls.size}`);
    console.log(`\n📁 Saved: ${rawFile}`);
    console.log('\n⏭️  Next: Run extraction script\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

scrapePelicanGrill();
