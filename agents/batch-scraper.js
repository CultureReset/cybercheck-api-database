#!/usr/bin/env node
/**
 * Batch Scraper - SCRAPING ONLY (no Claude extraction)
 * Scrapes all businesses from a JSON list, saves raw.json for each
 * Does NOT auto-extract
 *
 * Usage:
 *   node agents/batch-scraper.js scrape-list-food.json
 *   node agents/batch-scraper.js scrape-list-food.json --start 16
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');

let puppeteer, StealthPlugin;
try {
    puppeteer = require('puppeteer-extra');
    StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());
} catch (e) {
    console.error('❌ Missing packages. Run: npm install puppeteer-extra puppeteer-extra-plugin-stealth');
    process.exit(1);
}

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function extractDomain(url) {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function normalizeUrl(href, base) {
    try {
        const u = new URL(href, base);
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeSite(startUrl, businessName) {
    console.log(`  Launching Chrome...`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
    });

    const visited = new Set();
    const toVisit = [startUrl];
    const pages = [];
    const imageUrls = new Set();
    const MAX_PAGES = 40;

    while (toVisit.length > 0 && visited.size < MAX_PAGES) {
        const url = toVisit.shift();
        if (!url || visited.has(url)) continue;
        visited.add(url);

        if (/\.(jpg|jpeg|png|gif|svg|ico|css|woff|woff2|ttf|mp4|mp3|zip|pdf)(\?|$)/i.test(url)) continue;

        const page = await browser.newPage();
        try {
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 900 });

            // Block images/fonts
            await page.setRequestInterception(true);
            page.on('request', req => {
                if (/image|font|media/.test(req.resourceType())) req.abort();
                else req.continue();
            });

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await sleep(2000);

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

            // Collect images
            content.images.forEach(i => imageUrls.add(i));

            // Add links to queue
            for (const link of content.links) {
                if (!link) continue;
                const norm = normalizeUrl(link, startUrl);
                if (!norm || !isSameDomain(norm, startUrl)) continue;
                if (!visited.has(norm) && !toVisit.includes(norm)) {
                    toVisit.push(norm);
                }
            }

            pages.push({
                url,
                title: content.title,
                text: content.text.substring(0, 30000),
            });

            console.log(`    ✅ ${content.text.length.toLocaleString()} chars`);

        } catch (err) {
            console.log(`    ⚠️  ${err.message.substring(0, 50)}`);
        } finally {
            await page.close().catch(() => {});
        }

        await sleep(500);
    }

    await browser.close();

    // Save raw.json
    const slug = slugify(businessName);
    const outDir = path.join(__dirname, '../scraped-menus', slug);
    fs.mkdirSync(outDir, { recursive: true });

    const raw = {
        business_name: businessName,
        url: startUrl,
        scraped_at: new Date().toISOString(),
        pages,
        imageUrls: [...imageUrls].filter(u => /\.(jpg|jpeg|png|webp)/i.test(u)).slice(0, 50),
    };

    const rawFile = path.join(outDir, 'raw.json');
    fs.writeFileSync(rawFile, JSON.stringify(raw, null, 2));

    return { slug, pages: pages.length, chars: pages.reduce((s, p) => s + p.text.length, 0) };
}

async function main() {
    const args = process.argv.slice(2);
    const bulkFile = args[0];
    const startArg = args.includes('--start') ? parseInt(args[args.indexOf('--start') + 1]) : 1;

    if (!bulkFile || !fs.existsSync(bulkFile)) {
        console.error('Usage: node agents/batch-scraper.js <businesses.json> [--start N]');
        process.exit(1);
    }

    const list = JSON.parse(fs.readFileSync(bulkFile, 'utf8'));
    const results = [];
    const failures = [];

    console.log(`\n📊 Batch Scraper (scraping only, no extraction)`);
    console.log(`\n📋 File: ${bulkFile}`);
    console.log(`📍 Starting at: #${startArg}`);
    console.log(`📈 Total: ${list.length}\n`);

    for (let i = startArg - 1; i < list.length; i++) {
        const { name, url } = list[i];
        const startUrl = url.startsWith('http') ? url : `https://${url}`;

        // Check if already has good data
        const slug = slugify(name);
        const existingRaw = path.join(__dirname, '../scraped-menus', slug, 'raw.json');
        if (fs.existsSync(existingRaw)) {
            const existing = JSON.parse(fs.readFileSync(existingRaw, 'utf8'));
            const totalChars = (existing.pages || []).reduce((a, p) => a + (p.text || '').length, 0);
            if (totalChars > 3000) {
                console.log(`[${i+1}/${list.length}] ⏭️  SKIP (good data): ${name}`);
                continue;
            }
        }

        console.log(`\n[${i+1}/${list.length}] ${name}`);
        console.log('─'.repeat(55));

        try {
            const result = await scrapeSite(startUrl, name);
            console.log(`  📄 ${result.pages} pages, ${result.chars.toLocaleString()} chars`);
            console.log(`  💾 Saved: scraped-menus/${result.slug}/raw.json`);
            results.push({ name, slug: result.slug, pages: result.pages });
        } catch (err) {
            console.error(`  ❌ ERROR: ${err.message}`);
            failures.push({ name, error: err.message });
        }

        if (i < list.length - 1) { console.log('  ⏸️  Pausing 3s...'); await sleep(3000); }
    }

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  SCRAPE COMPLETE                                   ║');
    console.log('╚════════════════════════════════════════════════════╝');
    console.log(`\n✅ Scraped: ${results.length}`);
    console.log(`❌ Failed: ${failures.length}\n`);

    if (failures.length) {
        failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
    }
}

main().catch(e => {
    console.error('💥 Fatal error:', e.message);
    process.exit(1);
});
