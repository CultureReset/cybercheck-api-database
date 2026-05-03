require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set in .env');
    process.exit(1);
}

function isTestSlug(slug) {
    const s = (slug || '').toLowerCase();
    return s.startsWith('gcr-upload-test-') || s.startsWith('gcr-sections-test-') ||
           s.startsWith('gcr-toggle-test-') || s.startsWith('gcr-section-flow-test-') ||
           s.startsWith('gcr-items-test-') || s.startsWith('gcr-events-test-') ||
           s.startsWith('gcr-tags-test-') || s.startsWith('gcr-verify-') ||
           (s.startsWith('gcr-') && s.includes('-test-'));
}

const COVERED = new Set([
    'cobalt-the-restaurant','zekes-restaurant','cosmos-restaurant-and-bar',
    'gts-on-the-bay','coastal-orange-beach','flora-bama-yacht-club',
    'voyagers','docs-seafood-shack','lunas-eat-and-drink',
    'tacky-jacks-seafood-restaurant-and-tavern'
]);

async function fetchHtml(url) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
            redirect: 'follow',
            signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) return null;
        const text = await res.text();
        return text.slice(0, 80000);
    } catch (e) {
        return null;
    }
}

async function askHaiku(prompt) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }]
        })
    });
    if (!res.ok) {
        console.log(`  Haiku API error: ${res.status}`);
        return null;
    }
    const data = await res.json();
    return data.content?.[0]?.text || null;
}

async function discoverUrls(restaurant) {
    const html = await fetchHtml(restaurant.website_url);
    if (!html) return { slug: restaurant.slug, name: restaurant.name, status: 'fetch-failed', website: restaurant.website_url };

    const prompt = `You are analyzing the homepage of a restaurant website to find menu-related URLs.

Restaurant: ${restaurant.name}
Website: ${restaurant.website_url}

From the HTML below, find URLs for:
1. Food menu page
2. Drink/bar/wine/cocktails menu page
3. Happy Hour page/specials
4. Daily specials / deals page
5. PDF menus (if any)

Output ONLY a JSON object like this (absolute URLs only; use null if not found):
{
  "menu_url": "https://...",
  "drinks_url": "https://...",
  "happy_hour_url": "https://...",
  "specials_url": "https://...",
  "pdf_urls": ["https://...", "https://..."]
}

If a URL is relative (like "/menu"), make it absolute using the base: ${restaurant.website_url}

HTML:
${html}`;

    const response = await askHaiku(prompt);
    if (!response) return { slug: restaurant.slug, name: restaurant.name, status: 'haiku-failed', website: restaurant.website_url };

    // Extract JSON from response
    const match = response.match(/\{[\s\S]*\}/);
    if (!match) return { slug: restaurant.slug, name: restaurant.name, status: 'no-json', raw: response.slice(0, 200) };

    try {
        const urls = JSON.parse(match[0]);
        return { slug: restaurant.slug, name: restaurant.name, website: restaurant.website_url, status: 'ok', ...urls };
    } catch (e) {
        return { slug: restaurant.slug, name: restaurant.name, status: 'parse-error', raw: match[0].slice(0, 200) };
    }
}

async function run() {
    console.log('Loading restaurants from DB...');
    const { data } = await supabase
        .from('entity')
        .select('name, slug, website_url')
        .eq('is_active', true)
        .eq('entity_subtype', 'restaurant')
        .order('name');

    const remaining = data.filter(e => !isTestSlug(e.slug) && !COVERED.has(e.slug) && e.website_url);
    console.log(`Found ${remaining.length} restaurants needing menu URL discovery\n`);

    const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
    const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : remaining.length;
    const toProcess = remaining.slice(0, LIMIT);
    console.log(`Processing ${toProcess.length}${LIMIT < remaining.length ? ' (limited)' : ''}\n`);

    const BATCH_SIZE = 8;
    const results = [];
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
        const batch = toProcess.slice(i, i + BATCH_SIZE);
        console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1} (items ${i+1}-${Math.min(i+BATCH_SIZE, toProcess.length)} of ${toProcess.length})`);
        const batchResults = await Promise.all(batch.map(r => discoverUrls(r)));
        batchResults.forEach(r => {
            const ok = r.status === 'ok';
            const found = ok ? [
                r.menu_url ? '🍽️' : '',
                r.drinks_url ? '🥃' : '',
                r.happy_hour_url ? '🍻' : '',
                r.specials_url ? '⭐' : '',
                (r.pdf_urls && r.pdf_urls.length) ? '📄' : ''
            ].filter(Boolean).join(' ') : '';
            const label = ok ? (found || '(nothing found)') : `❌ ${r.status}`;
            console.log(`  ${r.name.padEnd(45)} ${label}`);
            results.push(r);
        });
    }

    // Save results
    const outPath = '/Users/owner/cybercheck-api-database/discovered-menu-urls.json';
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Saved results to ${outPath}`);

    // Summary
    const ok = results.filter(r => r.status === 'ok');
    const withMenu = ok.filter(r => r.menu_url).length;
    const withDrinks = ok.filter(r => r.drinks_url).length;
    const withHH = ok.filter(r => r.happy_hour_url).length;
    const withSpecials = ok.filter(r => r.specials_url).length;
    const withPdfs = ok.filter(r => r.pdf_urls && r.pdf_urls.length).length;

    console.log('\n' + '═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    console.log(`  Processed: ${results.length}`);
    console.log(`  Successful: ${ok.length}`);
    console.log(`  🍽️ Menu URL found:        ${withMenu}`);
    console.log(`  🥃 Drinks URL found:      ${withDrinks}`);
    console.log(`  🍻 Happy Hour URL found:  ${withHH}`);
    console.log(`  ⭐ Specials URL found:    ${withSpecials}`);
    console.log(`  📄 PDF menu URLs found:   ${withPdfs}`);
}

run().catch(e => { console.error(e); process.exit(1); });
