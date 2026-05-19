#!/usr/bin/env node
/**
 * De Soto's Seafood Kitchen - Full Scraper
 * Opens real Chrome, gets all pages, follows menu links
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeDeSotos() {
    console.log('\n🍽️  Scraping De Soto\'s Seafood Kitchen');
    console.log('═'.repeat(70));

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: [
            '--start-maximized',
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
        ],
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    const startUrl = 'https://www.desotosseafoodkitchen.com/';
    const visited = new Set();
    const toVisit = [startUrl];
    const pages = [];
    const imageUrls = new Set();

    while (toVisit.length > 0 && visited.size < 50) {
        const url = toVisit.shift();
        if (visited.has(url)) continue;
        visited.add(url);

        try {
            console.log(`\n[${visited.size}] ${url.substring(0, 80)}`);

            // Navigate to page
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await sleep(3000);

            // Get page content BEFORE clicking anything
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

            // Extract and add links for later
            for (const link of content.links) {
                if (!link.startsWith('http')) continue;
                const norm = new URL(link).toString().replace(/\/$/, '');
                if (norm.includes('desotosseafoodkitchen.com') && !visited.has(norm) && !toVisit.includes(norm)) {
                    toVisit.push(norm);
                }
            }

            // Collect images
            content.images.forEach(i => imageUrls.add(i));

            // Save page
            pages.push({
                url,
                title: content.title,
                text: content.text,
            });

            console.log(`  ✅ ${content.text.length.toLocaleString()} chars`);

        } catch (err) {
            console.log(`  ⚠️  ${err.message.substring(0, 60)}`);
        }

        await sleep(1500);
    }

    await browser.close();

    // Save raw.json
    const outDir = path.join(__dirname, '../scraped-menus/de-soto-s-seafood-kitchen');
    fs.mkdirSync(outDir, { recursive: true });

    const raw = {
        business_name: 'De Soto\'s Seafood Kitchen',
        url: startUrl,
        scraped_at: new Date().toISOString(),
        pages,
        imageUrls: [...imageUrls].filter(u => /\.(jpg|jpeg|png|webp)/i.test(u)).slice(0, 50),
    };

    const rawFile = path.join(outDir, 'raw.json');
    fs.writeFileSync(rawFile, JSON.stringify(raw, null, 2));

    console.log('\n✅ SCRAPE COMPLETE');
    console.log('═'.repeat(70));
    console.log(`Pages: ${pages.length}`);
    console.log(`Total chars: ${pages.reduce((s, p) => s + p.text.length, 0).toLocaleString()}`);
    console.log(`Images: ${imageUrls.size}`);
    console.log(`\n📄 Saved: ${rawFile}\n`);
}

scrapeDeSotos().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
