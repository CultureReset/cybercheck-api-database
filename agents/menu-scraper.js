#!/usr/bin/env node
/**
 * GCR Business + Menu Scraper
 * Uses Playwright + stealth to scrape ALL business data:
 * menus, hours, specials, happy hour, events, live music, contact, social, tags.
 *
 * Usage:
 *   Single (scrape + extract): node agents/menu-scraper.js https://site.com "Name"
 *
 *   Bulk SCRAPE only (no Claude):
 *     node agents/menu-scraper.js --scrape businesses.json
 *     → saves scraped-menus/<slug>/raw.json for each business
 *
 *   EXTRACT only (run Claude on all raw.json files):
 *     node agents/menu-scraper.js --extract
 *     → reads all raw.json files, writes data.json for each
 *
 *   Full pipeline (scrape then extract):
 *     node agents/menu-scraper.js --scrape businesses.json && node agents/menu-scraper.js --extract
 *
 * businesses.json format:
 *   [
 *     { "name": "Fish River Grill", "url": "https://fishrivergrillgs.com" },
 *     { "name": "Sea-N-Suds",       "url": "https://sea-n-suds.com" }
 *   ]
 *
 * First time setup:
 *   npm install puppeteer-extra puppeteer-extra-plugin-stealth pdf-parse
 *
 * Requires: ANTHROPIC_API_KEY in .env
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function extractDomain(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function isSameDomain(href, baseUrl) {
    try {
        return new URL(href, baseUrl).hostname === new URL(baseUrl).hostname;
    } catch { return false; }
}

function normalizeUrl(href, baseUrl) {
    try {
        const u = new URL(href, baseUrl);
        u.hash = ''; // strip fragment — #content, #menu etc are same page
        return u.toString().replace(/\/$/, ''); // strip trailing slash
    } catch { return href; }
}

function isMenuLike(url, text = '') {
    const s = (url + ' ' + text).toLowerCase();
    return /menu|food|drink|drinks|bar|cocktail|wine|beer|spirits|specials|happy.hour|brunch|lunch|dinner|breakfast|entree|appetizer|dessert|vegan|gluten|sushi|pizza|burger|sandwich|bbq|seafood|steak|pasta|taco|wings|events|live.music|entertainment|calendar|schedule/.test(s);
}

function isUsefulPage(url, text = '') {
    const s = (url + ' ' + text).toLowerCase();
    return /menu|food|drink|specials|happy|brunch|lunch|dinner|breakfast|events|music|entertainment|calendar|about|story|contact|hours|location|directions/.test(s);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────
// PLAYWRIGHT SCRAPER WITH STEALTH
// ─────────────────────────────────────────────

async function scrapesite(startUrl) {
    let puppeteer, StealthPlugin;
    try {
        puppeteer    = require('puppeteer-extra');
        StealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteer.use(StealthPlugin());
    } catch (e) {
        console.error('❌ Missing packages. Run:');
        console.error('   npm install puppeteer-extra puppeteer-extra-plugin-stealth pdf-parse');
        process.exit(1);
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
    });

    const visited      = new Set();
    const toVisit      = [startUrl];
    const pages        = [];
    const pdfUrls      = new Set();
    const imageUrls    = new Set();
    let   businessName = null;
    const MAX_PAGES    = 40;

    console.log(`\n  Scraping: ${startUrl}`);
    console.log('─'.repeat(55));

    while (toVisit.length > 0 && visited.size < MAX_PAGES) {
        const url = normalizeUrl(toVisit.shift(), startUrl);
        if (visited.has(url)) continue;
        visited.add(url);

        if (/\.(jpg|jpeg|png|gif|svg|ico|css|woff|woff2|ttf|mp4|mp3|zip)(\?|$)/i.test(url)) continue;
        if (/\.pdf(\?|$)/i.test(url)) { pdfUrls.add(url); continue; }

        const page = await browser.newPage();

        try {
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 900 });

            // Block images/fonts to speed things up
            await page.setRequestInterception(true);
            page.on('request', req => {
                if (/image|font|media/.test(req.resourceType())) req.abort();
                else req.continue();
            });

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await sleep(2000); // extra wait for JS-rendered menus

            // Dismiss popups
            await dismissPopups(page);

            // Click menu tabs / accordions
            await expandMenuSections(page);

            const extracted = await page.evaluate(() => {
                const jsonLd = [];
                document.querySelectorAll('script[type="application/ld+json"]').forEach(el => {
                    try { jsonLd.push(JSON.parse(el.textContent)); } catch {}
                });

                const meta = {};
                document.querySelectorAll('meta').forEach(el => {
                    const name    = el.getAttribute('name') || el.getAttribute('property') || '';
                    const content = el.getAttribute('content') || '';
                    if (name && content) meta[name] = content;
                });

                const title = document.title || '';

                const clone = document.body.cloneNode(true);
                clone.querySelectorAll('script,style,noscript,iframe').forEach(el => el.remove());
                const text = (clone.innerText || clone.textContent || '')
                    .replace(/[ \t]{2,}/g, ' ')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim()
                    .substring(0, 40000);

                const links = [];
                document.querySelectorAll('a[href]').forEach(el => {
                    const href = el.href;
                    const txt  = (el.innerText || '').trim().substring(0, 100);
                    if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                        links.push({ href, text: txt });
                    }
                });

                const images = [];
                document.querySelectorAll('img[src]').forEach(el => {
                    if (el.src && !el.src.startsWith('data:')) images.push(el.src);
                });

                return { title, text, meta, jsonLd, links, images };
            });

            if (!businessName && extracted.title) {
                businessName = extracted.title.split(/[|\-–—]/)[0].trim();
            }

            pages.push({ url, title: extracted.title, text: extracted.text, structuredData: extracted.jsonLd, meta: extracted.meta });
            extracted.images.forEach(src => imageUrls.add(src));

            console.log(`  ✅ ${url.substring(0, 65).padEnd(65)} ${extracted.text.length.toLocaleString()} chars`);

            for (const { href, text } of extracted.links) {
                if (!href) continue;
                const normalized = normalizeUrl(href, startUrl);
                if (visited.has(normalized) || toVisit.includes(normalized)) continue;
                if (!isSameDomain(normalized, startUrl)) continue;
                if (/\.pdf(\?|$)/i.test(normalized)) { pdfUrls.add(normalized); continue; }
                if (isMenuLike(normalized, text))        toVisit.unshift(normalized);
                else if (isUsefulPage(normalized, text)) toVisit.push(normalized);
            }

        } catch (err) {
            console.log(`  ⚠️  ${url.substring(0, 65)} — ${err.message.substring(0, 50)}`);
        } finally {
            await page.close().catch(() => {});
        }

        await sleep(500);
    }

    await browser.close();
    console.log(`\n  Pages: ${pages.length} | PDFs found: ${pdfUrls.size}`);
    return { pages, pdfUrls: [...pdfUrls], imageUrls: [...imageUrls], businessName };
}

// ─────────────────────────────────────────────
// DISMISS POPUPS / COOKIE BANNERS
// ─────────────────────────────────────────────

async function dismissPopups(page) {
    const dismissSelectors = [
        'button[id*="accept"]', 'button[class*="accept"]',
        'button[id*="cookie"]', 'button[class*="cookie"]',
        'button[aria-label*="Accept"]', 'button[aria-label*="Close"]',
        '[data-testid*="accept"]', '[data-testid*="cookie"]',
        'button.close', 'button[class*="close"]', 'button[class*="dismiss"]',
        '[class*="modal"] button', '[class*="popup"] button',
        'button[class*="age"]', 'a[href*="age-verified"]',
    ];

    for (const sel of dismissSelectors) {
        try {
            const btn = await page.$(sel);
            if (btn) {
                const visible = await btn.isIntersectingViewport().catch(() => false);
                if (visible) { await btn.click(); await sleep(300); }
            }
        } catch {}
    }
}

// ─────────────────────────────────────────────
// EXPAND MENU TABS / ACCORDIONS
// ─────────────────────────────────────────────

async function expandMenuSections(page) {
    const tabSelectors = [
        '[role="tab"]',
        '[class*="menu-tab"]', '[class*="nav-tab"]',
        '[class*="tab-link"]', '[class*="category-tab"]',
        '[data-tab]', '[data-menu]',
        'ul.tabs li', 'ul.menu-tabs li',
        '.accordion-header', '.accordion-button',
        '[class*="accordion"] button',
        '[class*="collapsible"]',
    ];

    for (const sel of tabSelectors) {
        try {
            const tabs = await page.$$(sel);
            for (const tab of tabs.slice(0, 20)) {
                try {
                    await tab.click();
                    await sleep(200);
                } catch {}
            }
        } catch {}
    }

    try {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(800);
        await page.evaluate(() => window.scrollTo(0, 0));
    } catch {}
}

// ─────────────────────────────────────────────
// PDF PARSER
// ─────────────────────────────────────────────

async function parsePDFs(pdfUrls) {
    if (pdfUrls.length === 0) return [];
    let PDFParse;
    try {
        PDFParse = require('pdf-parse').PDFParse;
        if (!PDFParse) throw new Error('no PDFParse export');
    } catch {
        console.log('  ⚠️  pdf-parse not installed, skipping PDFs. Run: npm install pdf-parse');
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
                console.log(`    ✅ ${data.text.length} chars extracted`);
            }
        } catch (err) {
            console.log(`    ⚠️  ${err.message.substring(0, 60)}`);
        }
    }
    return texts;
}

// ─────────────────────────────────────────────
// CLAUDE AI EXTRACTION
// ─────────────────────────────────────────────

async function claudeCall(apiKey, prompt, label) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 8096,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Claude API error ${res.status}: ${err.substring(0, 200)}`);
    }

    const data    = await res.json();
    const raw     = data.content?.[0]?.text || '';
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        const debugFile = path.join(__dirname, `../scraped-menus/_debug_${label}.txt`);
        fs.mkdirSync(path.dirname(debugFile), { recursive: true });
        fs.writeFileSync(debugFile, raw);
        throw new Error(`JSON parse failed for ${label}: ${e.message} (saved to ${debugFile})`);
    }
}

async function extractWithClaude(allText, businessUrl, knownName) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { console.error('❌ ANTHROPIC_API_KEY not set in .env'); process.exit(1); }

    // Truncate to 60k for each call — leaves room for the JSON response
    const truncated = allText.length > 60000 ? allText.substring(0, 60000) + '\n\n[TRUNCATED]' : allText;

    console.log(`\n  Claude call 1/2: business info... (${truncated.length.toLocaleString()} chars)`);

    // ── CALL 1: Business info (no menu items — keeps response small) ──
    const infoPrompt = `Extract business info from this scraped website text.
Business URL: ${businessUrl}${knownName ? `\nBusiness Name: ${knownName}` : ''}

Text:
---
${truncated}
---

Return ONLY raw JSON, no markdown or explanation:
{
  "business_name": "string",
  "tagline": "string or null",
  "type": "Restaurant | Bar | Cafe | Brewery | etc.",
  "contact": { "phone": "or null", "email": "or null", "address": "or null", "city": "or null", "state": "or null", "zip": "or null" },
  "hours": { "monday": "or null", "tuesday": "or null", "wednesday": "or null", "thursday": "or null", "friday": "or null", "saturday": "or null", "sunday": "or null", "notes": "or null" },
  "about": {
    "description": "string",
    "elevator_pitch": "1 compelling sentence you write about what makes this place special",
    "established": "or null", "owner": "or null", "chef": "or null",
    "vibe": "5-10 word atmosphere description",
    "best_for": ["families", "date night", "groups", "etc."],
    "age_restriction": "or null", "dress_code": "or null", "parking": "or null",
    "accessibility": "or null", "reservations": "or null", "insider_tip": "or null",
    "awards": [], "press": []
  },
  "tags": ["seafood", "casual", "happy hour", "live music", "outdoor seating", "etc."],
  "hashtags": ["#gulfshores", "#alabamaeats", "#etc."],
  "categories": ["Restaurant", "Bar", "etc."],
  "cuisine_types": ["American", "Seafood", "etc."],
  "atmosphere": ["Casual", "Family-Friendly", "etc."],
  "features": ["full bar", "outdoor seating", "live music", "takeout", "delivery", "etc."],
  "price_range": "$ or $$ or $$$ or $$$$",
  "neighborhood": "or null",
  "social_links": {
    "instagram": "full URL or null", "facebook": "full URL or null",
    "twitter": "full URL or null", "tiktok": "full URL or null",
    "youtube": "full URL or null", "yelp": "full URL or null",
    "tripadvisor": "full URL or null", "opentable": "full URL or null",
    "google_maps": "full URL or null", "website": "${businessUrl}"
  },
  "specials": [{ "name": "Happy Hour", "description": "string", "days": ["Monday"], "time": "4-7pm" }],
  "events": [{ "name": "Live Music", "description": "string", "recurring": true, "day": "Friday", "time": "8pm", "frequency": "Every Friday" }]
}`;

    const info = await claudeCall(apiKey, infoPrompt, 'info_' + slugify(knownName || businessUrl));
    await sleep(1000);

    console.log(`  Claude call 2/2: menu items...`);

    // ── CALL 2: Menu items only ──
    const menuPrompt = `Extract ALL menu items from this scraped restaurant website text.
Business: ${knownName || businessUrl}

Text:
---
${truncated}
---

Return ONLY raw JSON, no markdown or explanation:
{
  "categories": [
    {
      "name": "Lunch",
      "type": "breakfast | lunch | dinner | brunch | drinks | desserts | specials | dietary | kids | events",
      "description": "e.g. Served Mon-Fri 11am-3pm, or null",
      "subcategories": ["Sandwiches", "Salads"],
      "items": [
        {
          "name": "item name",
          "description": "or null",
          "price": 12.99,
          "subcategory": "or null",
          "tags": ["vegetarian", "spicy", "gluten-free", "popular"],
          "allergens": ["nuts", "dairy", "shellfish"]
        }
      ]
    }
  ]
}

Rules:
- Include ALL items found — do not skip any
- Separate by meal period (Breakfast, Lunch, Dinner, Brunch, Happy Hour, Drinks, Desserts, Kids, Late Night)
- Gluten-free / vegan sections = type "dietary" category
- Happy hour drinks/food = type "specials" category
- Live music / events = type "events" category, items are event names
- Price as number (12.99). If range use lower. If unavailable use null
- If no menu found at all, return { "categories": [] }`;

    const menuData = await claudeCall(apiKey, menuPrompt, 'menu_' + slugify(knownName || businessUrl));

    return { ...info, menu: menuData };
}

async function extractActivityWithClaude(allText, businessUrl, knownName) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { console.error('❌ ANTHROPIC_API_KEY not set in .env'); process.exit(1); }

    const truncated = allText.length > 60000 ? allText.substring(0, 60000) + '\n\n[TRUNCATED]' : allText;

    console.log(`  Claude call 1/2: business info... (${truncated.length.toLocaleString()} chars)`);

    const infoPrompt = `Extract business info from this scraped activity/experience/charter/attraction website.
Business URL: ${businessUrl}${knownName ? `\nBusiness Name: ${knownName}` : ''}

Text:
---
${truncated}
---

Return ONLY raw JSON, no markdown:
{
  "business_name": "string",
  "tagline": "or null",
  "type": "Fishing Charter | Dolphin Cruise | Boat Rental | Water Sports | Attraction | Golf | etc.",
  "contact": { "phone": "or null", "email": "or null", "address": "or null", "city": "or null", "state": "or null", "zip": "or null" },
  "hours": { "monday": "or null", "tuesday": "or null", "wednesday": "or null", "thursday": "or null", "friday": "or null", "saturday": "or null", "sunday": "or null", "notes": "or null" },
  "about": {
    "description": "full description",
    "elevator_pitch": "1 compelling sentence about what makes this special",
    "established": "or null",
    "owner": "or null",
    "vibe": "5-10 word description",
    "best_for": ["families", "groups", "couples", "etc."],
    "capacity": "max group size or null",
    "duration_options": ["2 hours", "half day", "full day", "overnight"],
    "departure_location": "marina/address or null",
    "what_provided": ["rods", "bait", "license", "life jackets", "snacks", "etc."],
    "what_to_bring": ["sunscreen", "cooler", "etc."],
    "age_restriction": "or null",
    "weight_restriction": "or null",
    "reservations": "booking info or null",
    "insider_tip": "or null",
    "cancellation_policy": "or null"
  },
  "tags": ["fishing", "family fun", "offshore", "etc."],
  "hashtags": ["#orangebeach", "#etc."],
  "categories": ["Fishing Charter", "Water Activity", "etc."],
  "features": ["private charter", "shared trips", "BYOB", "restroom on board", "etc."],
  "social_links": {
    "instagram": "or null", "facebook": "or null", "youtube": "or null",
    "tripadvisor": "or null", "website": "${businessUrl}"
  },
  "specials": [{ "name": "string", "description": "string", "days": [], "time": "or null" }],
  "events": [{ "name": "string", "description": "string", "recurring": true, "day": "or null", "time": "or null" }]
}`;

    const info = await claudeCall(apiKey, infoPrompt, 'info_' + slugify(knownName || businessUrl));
    await sleep(1000);

    console.log(`  Claude call 2/2: packages & pricing...`);

    const packagesPrompt = `Extract ALL packages, trips, tours, rentals, and pricing from this activity/experience business website.
Business: ${knownName || businessUrl}

Text:
---
${truncated}
---

Return ONLY raw JSON, no markdown:
{
  "packages": [
    {
      "name": "Half Day Fishing Trip",
      "type": "fishing | dolphin cruise | boat rental | parasail | jet ski | tour | attraction | golf | other",
      "description": "full description of what's included",
      "duration": "4 hours",
      "price": 85.00,
      "price_type": "per person | per boat | flat rate | per hour | per day",
      "price_note": "e.g. plus tax, plus fuel, etc. or null",
      "min_people": 1,
      "max_people": 6,
      "what_included": ["rods", "bait", "fishing license", "ice", "cooler"],
      "what_not_included": ["food", "alcohol"],
      "departure_times": ["6am", "1pm"],
      "days_available": ["Monday", "Tuesday"] or "Daily",
      "age_min": null,
      "weight_max": null,
      "booking_url": "or null",
      "notes": "or null"
    }
  ]
}

Rules:
- Extract EVERY package, trip type, tour, rental option with pricing
- If price range, use the lower price and note range in price_note
- If no price found, use null
- Include ALL options: shared trips, private charters, half day, full day, overnight, etc.
- If no packages found at all return { "packages": [] }`;

    const packagesData = await claudeCall(apiKey, packagesPrompt, 'packages_' + slugify(knownName || businessUrl));

    return { ...info, packages: packagesData.packages || [] };
}

// ─────────────────────────────────────────────
// BUILD COMBINED TEXT FROM RAW DATA
// ─────────────────────────────────────────────

function buildTextFromRaw(raw) {
    const parts = [];
    for (const p of raw.pages || []) {
        if (p.structuredData?.length)
            parts.push(`[STRUCTURED DATA: ${p.url}]\n${JSON.stringify(p.structuredData, null, 2)}`);
    }
    for (const p of raw.pages || []) {
        if (p.meta && Object.keys(p.meta).length) {
            const m = Object.entries(p.meta)
                .filter(([k]) => /description|keyword|og:|twitter:/i.test(k))
                .map(([k, v]) => `${k}: ${v}`).join('\n');
            if (m) parts.push(`[META: ${p.url}]\n${m}`);
        }
    }
    for (const p of raw.pages || []) {
        if (p.text) parts.push(`[PAGE: ${p.title || p.url}]\n${p.url}\n\n${p.text}`);
    }
    for (const t of raw.pdfTexts || []) parts.push(t);
    return parts.join('\n\n' + '─'.repeat(40) + '\n\n');
}

// ─────────────────────────────────────────────
// SCRAPE ONLY — save raw.json, no Claude
// ─────────────────────────────────────────────

async function scrapeToFile(startUrl, nameHint, scrapeFolder) {
    const { pages, pdfUrls, imageUrls, businessName: detected } = await scrapesite(startUrl);
    const businessName = nameHint || detected || extractDomain(startUrl);
    console.log(`\n  Business: ${businessName}`);

    console.log('  Processing PDFs...');
    const pdfTexts = await parsePDFs(pdfUrls);

    const slug   = slugify(businessName);
    const outDir = path.join(__dirname, '../scraped-menus', scrapeFolder || '', slug);
    fs.mkdirSync(outDir, { recursive: true });

    const raw = {
        business_name: businessName,
        url:           startUrl,
        scraped_at:    new Date().toISOString(),
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

// ─────────────────────────────────────────────
// EXTRACT ONLY — read all raw.json, run Claude
// ─────────────────────────────────────────────

async function extractAll() {
    const baseDir = path.join(__dirname, '../scraped-menus');
    if (!fs.existsSync(baseDir)) {
        console.error('No scraped-menus folder found. Run --scrape first.');
        process.exit(1);
    }

    const onlyArg = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
    const onlyList = onlyArg ? onlyArg.split(',').map(s => s.trim()) : null;

    const slugs = fs.readdirSync(baseDir).filter(d => {
        const rawFile = path.join(baseDir, d, 'raw.json');
        if (!fs.existsSync(rawFile)) return false;
        if (onlyList && !onlyList.includes(d)) return false;
        return true;
    });

    if (slugs.length === 0) {
        console.error('No raw.json files found. Run --scrape first.');
        process.exit(1);
    }

    console.log(`\n  Found ${slugs.length} businesses to extract\n`);
    const results  = [];
    const failures = [];

    for (let i = 0; i < slugs.length; i++) {
        const slug    = slugs[i];
        const rawFile = path.join(baseDir, slug, 'raw.json');
        const outFile = path.join(baseDir, slug, 'data.json');

        console.log(`\n[${i + 1}/${slugs.length}] ${slug}`);
        console.log('─'.repeat(55));

        try {
            const raw      = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
            const allText  = buildTextFromRaw(raw);

            // Auto-detect: activity/experience vs restaurant
            const activityKeywords = /charter|fishing|cruise|dolphin|parasail|jet ski|kayak|rental|boat|tour|attraction|golf|watersport|snorkel|diving|zipline|escape room|axe|mini golf|zoo|park|resort|condo|hotel|marina/i;
            const isActivity = activityKeywords.test(raw.url + ' ' + (raw.business_name || ''));
            console.log(`  Mode: ${isActivity ? '🎯 Activity/Experience' : '🍽️  Restaurant'}`);

            const extracted = isActivity
                ? await extractActivityWithClaude(allText, raw.url, raw.business_name)
                : await extractWithClaude(allText, raw.url, raw.business_name);

            const finalData = {
                ...extracted,
                business_name: extracted.business_name || raw.business_name,
                url:           raw.url,
                scraped_at:    raw.scraped_at,
                extracted_at:  new Date().toISOString(),
                sources:       [...(raw.pages || []).map(p => p.url), ...(raw.pdfUrls || [])],
                gallery:       raw.imageUrls || [],
            };

            fs.writeFileSync(outFile, JSON.stringify(finalData, null, 2));

            const cats  = finalData.menu?.categories?.length || 0;
            const items = finalData.menu?.categories?.reduce((n, c) => n + (c.items?.length || 0), 0) || 0;
            console.log(`  Sections: ${cats} | Items: ${items} | Specials: ${(finalData.specials||[]).length} | Events: ${(finalData.events||[]).length}`);
            console.log(`  Saved → ${outFile}`);
            results.push({ slug, business_name: finalData.business_name, cats, items });

        } catch (err) {
            console.error(`  ERROR: ${err.message}`);
            failures.push({ slug, error: err.message });
        }

        // Small delay between Claude calls to avoid rate limits
        if (i < slugs.length - 1) await sleep(1500);
    }

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║  EXTRACTION COMPLETE                                 ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`  Done: ${results.length} | Failed: ${failures.length}`);
    results.forEach(r => console.log(`  ✅ ${r.business_name} — ${r.cats} sections, ${r.items} items`));
    if (failures.length) failures.forEach(f => console.log(`  ❌ ${f.slug}: ${f.error}`));
    console.log('');
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║      GCR Business + Menu Scraper  (Playwright)      ║');
    console.log('╚══════════════════════════════════════════════════════╝');

    // ── SCRAPE ONLY ──
    if (args[0] === '--scrape') {
        const bulkFile = args[1];
        const folderArg = args.includes('--folder') ? args[args.indexOf('--folder') + 1] : null;
        if (!bulkFile || !fs.existsSync(bulkFile)) {
            console.error('Usage: node agents/menu-scraper.js --scrape businesses.json [--folder condos]');
            process.exit(1);
        }

        const list     = JSON.parse(fs.readFileSync(bulkFile, 'utf8'));
        const results  = [];
        const failures = [];
        console.log(`\n  Scraping ${list.length} businesses — NO Claude yet${folderArg ? ' → folder: ' + folderArg : ''}\n`);

        for (let i = 0; i < list.length; i++) {
            const { name, url } = list[i];
            const startUrl = url.startsWith('http') ? url : `https://${url}`;

            // Skip if already scraped AND pdfs were either none or already parsed
            const slug = slugify(name || extractDomain(startUrl));
            const existingRaw = path.join(__dirname, '../scraped-menus', folderArg || '', slug, 'raw.json');
            if (fs.existsSync(existingRaw)) {
                const existing = JSON.parse(fs.readFileSync(existingRaw, 'utf8'));
                const hasPdfsMissed = (existing.pdfUrls || []).length > 0 && (existing.pdfTexts || []).length === 0;
                if (!hasPdfsMissed) {
                    console.log(`\n[${i + 1}/${list.length}] ⏭️  SKIP (already scraped): ${name || url}`);
                    continue;
                }
                console.log(`\n[${i + 1}/${list.length}] 🔄 RE-SCRAPE (had PDFs but failed to parse): ${name || url}`);
            }

            console.log(`\n[${i + 1}/${list.length}] ${name || url}`);
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
        console.log('║  SCRAPE COMPLETE                                     ║');
        console.log('╚══════════════════════════════════════════════════════╝');
        console.log(`  Scraped: ${results.length} | Failed: ${failures.length}`);
        results.forEach(r => console.log(`  ✅ ${r.business_name} → scraped-menus/${r.slug}/raw.json`));
        if (failures.length) failures.forEach(f => console.log(`  ❌ ${f.name || f.url}: ${f.error}`));
        console.log('\n  Now run: node agents/menu-scraper.js --extract\n');
        return;
    }

    // ── EXTRACT ONLY ──
    if (args[0] === '--extract') {
        await extractAll();
        return;
    }

    // ── SINGLE (scrape + extract) ──
    const urlArg  = args[0];
    const nameArg = args[1];

    if (!urlArg) {
        console.error('\nUsage:');
        console.error('  Scrape all:   node agents/menu-scraper.js --scrape businesses.json');
        console.error('  Extract all:  node agents/menu-scraper.js --extract');
        console.error('  Single site:  node agents/menu-scraper.js <url> [name]');
        process.exit(1);
    }

    const startUrl = urlArg.startsWith('http') ? urlArg : `https://${urlArg}`;
    await scrapeToFile(startUrl, nameArg);
    console.log('\n  Scrape done. Now extracting with Claude...\n');
    await extractAll();
}

main().catch(err => {
    console.error('\n  Crashed:', err.message);
    console.error(err.stack);
    process.exit(1);
});
