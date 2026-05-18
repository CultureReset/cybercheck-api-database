#!/usr/bin/env node
/**
 * Real Chrome Scraper — opens actual visible Chrome window on your Mac
 * Use this for sites that block the headless scraper.
 * No API calls — saves raw.json only.
 *
 * Usage:
 *   node agents/scraper-chrome.js --scrape businesses.json
 *   node agents/scraper-chrome.js --scrape retry.json --folder condos
 *   node agents/scraper-chrome.js https://example.com "Business Name"
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs   = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const MAX_PAGES = 100;
const BASE_DIR  = path.join(__dirname, '../scraped-menus');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function slugify(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function extractDomain(url) {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
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

async function scrapeSite(startUrl) {
    console.log('  Launching Chrome (visible)...');

    const browser = await puppeteer.launch({
        headless: false,           // ← REAL VISIBLE CHROME
        defaultViewport: null,     // full window size
        args: [
            '--start-maximized',
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
        ],
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // your Mac Chrome
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    const visited   = new Set();
    const toVisit   = [startUrl.replace(/\/$/, '')];
    const pages     = [];
    const pdfUrls   = new Set();
    const imageUrls = new Set();
    let businessName = '';

    // Priority keywords for page ordering
    const priorityWords = /menu|food|drink|happy.hour|special|event|about|hours|contact|live.music|entertainment|package|price|rate|tour|trip|charter|activit|amenit/i;

    while (toVisit.length > 0 && visited.size < MAX_PAGES) {
        const url = toVisit.shift();
        if (!url || visited.has(url)) continue;
        visited.add(url);

        try {
            console.log(`  [${visited.size}/${MAX_PAGES}] ${url.substring(0, 80)}`);

            const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            if (!resp) continue;

            // Wait for JS to render
            await sleep(3500);

            // Dismiss popups
            await dismissPopups(page);

            // Expand menus/tabs
            await expandSections(page);

            // Wait for expanded content to load
            await sleep(2000);

            // Get page content
            const content = await page.evaluate(() => {
                // Remove scripts, styles, nav clutter
                const remove = document.querySelectorAll('script,style,noscript,iframe,svg');
                remove.forEach(el => el.remove());

                const title = document.title || '';
                const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
                const ogDesc   = document.querySelector('meta[property="og:description"]')?.content || '';

                // Get all text
                const text = document.body?.innerText || '';

                // Get structured data
                const structured = [];
                document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
                    try { structured.push(JSON.parse(s.textContent)); } catch {}
                });

                // Get all links
                const links = [...document.querySelectorAll('a[href]')]
                    .map(a => a.href)
                    .filter(h => h && !h.startsWith('javascript') && !h.startsWith('mailto') && !h.startsWith('tel'));

                // Get images
                const images = [...document.querySelectorAll('img[src]')]
                    .map(i => i.src)
                    .filter(s => s && s.startsWith('http'));

                return { title, text, links, images, structured, metaDesc, ogDesc };
            });

            if (!businessName && content.title) {
                businessName = content.title.split('|')[0].split('-')[0].split('–')[0].trim();
            }

            // Collect images
            content.images.forEach(i => imageUrls.add(i));

            // Collect PDFs and links
            for (const link of content.links) {
                if (link.endsWith('.pdf')) { pdfUrls.add(link); continue; }
                const norm = normalizeUrl(link, startUrl);
                if (!norm || !isSameDomain(norm, startUrl)) continue;
                if (!visited.has(norm) && !toVisit.includes(norm)) {
                    if (priorityWords.test(norm)) {
                        toVisit.unshift(norm); // priority pages go first
                    } else {
                        toVisit.push(norm);
                    }
                }
            }

            pages.push({
                url,
                title: content.title,
                text: content.text.substring(0, 30000),
                structuredData: content.structured,
                meta: {
                    description: content.metaDesc || content.ogDesc,
                },
                links: content.links,
            });

            console.log(`    ${content.text.length.toLocaleString()} chars`);

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
            'button[id*="accept"]', 'button[id*="agree"]', 'button[id*="close"]',
            'button[class*="accept"]', 'button[class*="close"]', 'button[class*="dismiss"]',
            '[aria-label*="close"]', '[aria-label*="dismiss"]',
            'button[id*="cookie"]', '.cookie-accept', '#age-gate button',
            'button:has-text("Accept")', 'button:has-text("I Agree")',
            'button:has-text("Enter")', 'button:has-text("Yes")',
            'button:has-text("Close")', 'button:has-text("Got it")',
        ];
        for (const sel of selectors) {
            try {
                const btn = await page.$(sel);
                if (btn) { await btn.click(); await sleep(600); }
            } catch {}
        }
    } catch {}
}

async function expandSections(page) {
    try {
        // Find ALL buttons/links and click ones with menu text
        const elements = await page.$$('a, button');
        for (const el of elements) {
            try {
                const text = await el.evaluate(e => e.innerText || e.textContent || '');
                if (/menu|lunch|dinner|drinks|bar|appetizer|entree|kids|specials/i.test(text)) {
                    const visible = await el.isIntersectingViewport().catch(() => false);
                    if (visible) {
                        console.log(`    Clicking: ${text.trim().substring(0, 40)}`);
                        await el.click();
                        await sleep(1500);
                    }
                }
            } catch {}
        }
    } catch {}
}

async function parsePDFs(pdfUrls) {
    if (pdfUrls.length === 0) return [];
    let PDFParse;
    try {
        PDFParse = require('pdf-parse').PDFParse;
        if (!PDFParse) throw new Error('no PDFParse export');
    } catch {
        console.log('  ⚠️  pdf-parse not available, skipping PDFs');
        return [];
    }

    const texts = [];
    for (const url of pdfUrls) {
        try {
            console.log(`  📄 PDF: ${url.substring(0, 70)}`);
            const parser = new PDFParse({ url });
            const data   = await parser.getText();
            if (data.text?.trim()) {
                texts.push(`[PDF: ${url}]\n${data.text.trim()}`);
                console.log(`    ✅ ${data.text.length} chars`);
            }
        } catch (err) {
            console.log(`    ⚠️  PDF failed: ${err.message.substring(0, 60)}`);
        }
    }
    return texts;
}

async function scrapeToFile(startUrl, nameHint, folder) {
    const { pages, pdfUrls, imageUrls, businessName: detected } = await scrapeSite(startUrl);
    const businessName = nameHint || detected || extractDomain(startUrl);
    console.log(`\n  Business: ${businessName}`);

    const pdfTexts = await parsePDFs(pdfUrls);

    const slug   = slugify(businessName);
    const outDir = path.join(BASE_DIR, folder || '', slug);
    fs.mkdirSync(outDir, { recursive: true });

    const raw = {
        business_name: businessName,
        url:           startUrl,
        scraped_at:    new Date().toISOString(),
        scraper:       'chrome-visible',
        pages,
        pdfUrls,
        pdfTexts,
        imageUrls: [...imageUrls].filter(u => /\.(jpg|jpeg|png|webp)/i.test(u)).slice(0, 50),
    };

    const rawFile = path.join(outDir, 'raw.json');
    fs.writeFileSync(rawFile, JSON.stringify(raw, null, 2));
    console.log(`  Pages: ${pages.length} | PDFs: ${pdfUrls.length} | Saved → ${rawFile}`);
    return { slug, rawFile, business_name: businessName };
}

async function main() {
    const args = process.argv.slice(2);

    if (args[0] === '--scrape') {
        const bulkFile  = args[1];
        const folderArg = args.includes('--folder') ? args[args.indexOf('--folder') + 1] : null;

        if (!bulkFile || !fs.existsSync(bulkFile)) {
            console.error('Usage: node agents/scraper-chrome.js --scrape file.json [--folder name]');
            process.exit(1);
        }

        const list = JSON.parse(fs.readFileSync(bulkFile, 'utf8'));
        const results = [], failures = [];
        console.log(`\n🌐 Real Chrome Scraper — ${list.length} businesses\n`);

        for (let i = 0; i < list.length; i++) {
            const { name, url } = list[i];
            const startUrl = url.startsWith('http') ? url : `https://${url}`;

            // Skip if already has good data
            const slug = slugify(name || extractDomain(startUrl));
            const existingRaw = path.join(BASE_DIR, folderArg || '', slug, 'raw.json');
            if (fs.existsSync(existingRaw)) {
                const existing = JSON.parse(fs.readFileSync(existingRaw, 'utf8'));
                const totalChars = (existing.pages || []).reduce((a, p) => a + (p.text || '').length, 0);
                const hasPdfsMissed = (existing.pdfUrls || []).length > 0 && (existing.pdfTexts || []).length === 0;
                if (totalChars > 3000 && !hasPdfsMissed) {
                    console.log(`\n[${i+1}/${list.length}] ⏭️  SKIP (good data exists): ${name || url}`);
                    continue;
                }
            }

            console.log(`\n[${i+1}/${list.length}] ${name || url}`);
            console.log('─'.repeat(55));
            try {
                results.push(await scrapeToFile(startUrl, name, folderArg));
            } catch (err) {
                console.error(`  ERROR: ${err.message}`);
                failures.push({ name, url, error: err.message });
            }
            if (i < list.length - 1) { console.log('  Pausing 3s...'); await sleep(3000); }
        }

        console.log('\n╔══════════════════════════════════════════════════════╗');
        console.log('║  CHROME SCRAPE COMPLETE                              ║');
        console.log('╚══════════════════════════════════════════════════════╝');
        console.log(`  Scraped: ${results.length} | Failed: ${failures.length}`);
        results.forEach(r => console.log(`  ✅ ${r.business_name}`));
        if (failures.length) failures.forEach(f => console.log(`  ❌ ${f.name || f.url}: ${f.error}`));
        return;
    }

    // Single URL mode
    const url  = args[0];
    const name = args[1];
    if (!url) {
        console.error('Usage: node agents/scraper-chrome.js https://example.com "Business Name"');
        process.exit(1);
    }
    await scrapeToFile(url.startsWith('http') ? url : `https://${url}`, name, null);
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
