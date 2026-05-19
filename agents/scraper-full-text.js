#!/usr/bin/env node
/**
 * FULL TEXT SCRAPER
 * Captures ALL pages, ALL text, complete HTML from every URL
 * Saves raw HTML + extracted text for Claude to process
 *
 * Usage:
 *   node agents/scraper-full-text.js https://example.com "Business Name"
 *   node agents/scraper-full-text.js --scrape businesses.json
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function extractDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
function normalizeUrl(href, baseUrl) {
    try {
        const u = new URL(href, baseUrl);
        u.hash = '';
        return u.toString().replace(/\/$/, '');
    } catch { return null; }
}
function isSameDomain(href, baseUrl) {
    try {
        return new URL(href, baseUrl).hostname === new URL(baseUrl).hostname;
    } catch { return false; }
}

async function scrapeFullText(startUrl, businessNameHint) {
    console.log(`\n🔍 Scraping: ${startUrl}`);
    console.log('─'.repeat(70));

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const visited = new Set();
        const toVisit = [startUrl];
        const pageData = [];
        let businessName = businessNameHint;

        while (toVisit.length > 0 && visited.size < 100) {
            const url = toVisit.shift();
            if (visited.has(url)) continue;
            visited.add(url);

            // Skip binary files
            if (/\.(jpg|jpeg|png|gif|svg|ico|css|woff|woff2|ttf|mp4|mp3|zip|pdf)(\?|$)/i.test(url)) {
                continue;
            }

            const page = await browser.newPage();
            try {
                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1280, height: 900 });

                // Block heavy resources
                await page.setRequestInterception(true);
                page.on('request', req => {
                    if (/image|font|media|stylesheet/.test(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                console.log(`  Fetching: ${url.substring(0, 70)}`);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });

                // Wait extra time for JS to render
                await sleep(4000);

                // AGGRESSIVE: Click ALL clickable elements to expand hidden content
                const expandSelectors = [
                    '[role="tab"]',
                    '[role="button"]',
                    '[class*="accordion"]',
                    '[class*="collapsible"]',
                    '[class*="expand"]',
                    '[class*="toggle"]',
                    '[class*="menu"]',
                    '[class*="dropdown"]',
                    '[class*="modal"]',
                    'button',
                    'a[href="#"]',
                    '.menu-toggle',
                    '.tab-button',
                    '[aria-expanded="false"]'
                ];

                // Click things multiple times to ensure all content expands
                for (let attempt = 0; attempt < 3; attempt++) {
                    for (const sel of expandSelectors) {
                        try {
                            const elements = await page.$$(sel);
                            for (const el of elements.slice(0, 100)) {
                                try {
                                    await el.click();
                                    await sleep(100);
                                } catch {}
                            }
                        } catch {}
                    }
                    await sleep(500);
                }

                // Scroll through entire page multiple times to trigger lazy loading
                await page.evaluate(() => {
                    let scrollPos = 0;
                    const step = window.innerHeight / 2;
                    while (scrollPos < document.body.scrollHeight * 3) {
                        window.scrollBy(0, step);
                        scrollPos += step;
                    }
                });
                await sleep(3000);

                // Get full HTML
                const fullHtml = await page.content();

                // Get page title
                const title = await page.title() || businessName || extractDomain(startUrl);
                if (!businessName) {
                    businessName = title.split(/[|\-–—]/)[0].trim();
                }

                // Get all text content
                const allText = await page.evaluate(() => {
                    const clone = document.body.cloneNode(true);
                    clone.querySelectorAll('script,style,noscript,iframe').forEach(el => el.remove());
                    return (clone.innerText || clone.textContent || '')
                        .replace(/[ \t]{2,}/g, ' ')
                        .replace(/\n{4,}/g, '\n\n\n')
                        .trim();
                });

                // Get all links for crawling
                const links = await page.$$eval('a[href]', elements =>
                    elements.map(el => ({
                        href: el.href,
                        text: (el.innerText || '').trim().substring(0, 100)
                    }))
                );

                pageData.push({
                    url,
                    title,
                    fullHtml,
                    allText,
                    textLength: allText.length
                });

                console.log(`    ✅ ${allText.length.toLocaleString()} chars captured`);

                // Find next pages to visit
                for (const { href } of links) {
                    if (!href) continue;
                    const normalized = normalizeUrl(href, startUrl);
                    if (!normalized) continue;
                    if (visited.has(normalized) || toVisit.includes(normalized)) continue;
                    if (!isSameDomain(normalized, startUrl)) continue;
                    toVisit.unshift(normalized);
                }

            } catch (err) {
                console.log(`    ⚠️  Error: ${err.message.substring(0, 50)}`);
            } finally {
                await page.close().catch(() => {});
            }

            await sleep(500);
        }

        await browser.close();

        // Save to file
        const slug = slugify(businessName || extractDomain(startUrl));
        const outDir = path.join(__dirname, '../scraped-menus', slug);
        fs.mkdirSync(outDir, { recursive: true });

        const outputData = {
            business_name: businessName,
            url: startUrl,
            scraped_at: new Date().toISOString(),
            total_pages: pageData.length,
            pages: pageData.map(p => ({
                url: p.url,
                title: p.title,
                text: p.allText,
                html: p.fullHtml,
                textLength: p.textLength
            }))
        };

        const outFile = path.join(outDir, 'full-text.json');
        fs.writeFileSync(outFile, JSON.stringify(outputData, null, 2));

        console.log(`\n  ✅ Saved: ${outFile}`);
        console.log(`  Pages: ${pageData.length} | Total chars: ${pageData.reduce((sum, p) => sum + p.textLength, 0).toLocaleString()}`);

        return { slug, outFile, business_name: businessName, pages: pageData.length };

    } catch (err) {
        console.error(`❌ Error: ${err.message}`);
        throw err;
    }
}

// MAIN
async function main() {
    const args = process.argv.slice(2);

    if (args[0] === '--scrape') {
        const file = args[1];
        if (!file || !fs.existsSync(file)) {
            console.error('Usage: node agents/scraper-full-text.js --scrape businesses.json');
            process.exit(1);
        }

        const list = JSON.parse(fs.readFileSync(file, 'utf8'));
        console.log(`\n📖 Scraping ${list.length} businesses (FULL TEXT MODE)\n`);

        for (let i = 0; i < list.length; i++) {
            const { name, url } = list[i];
            const startUrl = url.startsWith('http') ? url : `https://${url}`;

            console.log(`\n[${i + 1}/${list.length}] ${name || url}`);
            try {
                await scrapeFullText(startUrl, name);
            } catch (err) {
                console.error(`  ❌ FAILED: ${err.message}`);
            }
            if (i < list.length - 1) {
                console.log('  Pausing 5s...');
                await sleep(5000);
            }
        }
    } else {
        // Single URL
        const urlArg = args[0];
        const nameArg = args[1];
        if (!urlArg) {
            console.error('Usage: node agents/scraper-full-text.js <url> [name]');
            process.exit(1);
        }
        const startUrl = urlArg.startsWith('http') ? urlArg : `https://${urlArg}`;
        await scrapeFullText(startUrl, nameArg);
    }
}

main().catch(err => {
    console.error('\n❌ CRASHED:', err.message);
    console.error(err.stack);
    process.exit(1);
});
