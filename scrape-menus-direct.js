require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const DRY_RUN = process.argv.includes('--apply') ? false : true;

const CURATED = [
    { slug: 'cobalt-the-restaurant', type: 'menu', url: 'https://cobaltrestaurant.net/menu/' },
    { slug: 'zekes-restaurant', type: 'menu', url: 'https://www.zekeslanding.com/wp-content/uploads/sites/7671/2025/03/dinner.pdf', format: 'pdf', section: 'Dinner' },
    { slug: 'cosmos-restaurant-and-bar', type: 'menu', url: 'https://www.cosmosrestaurantandbar.com/menu' },
    { slug: 'gts-on-the-bay', type: 'menu', url: 'https://gtsonthebay.com/menu/' },
    { slug: 'gts-on-the-bay', type: 'happy_hour', url: 'https://gtsonthebay.com/happy-hour/' },
    { slug: 'coastal-orange-beach', type: 'menu', url: 'https://www.coastalorangebeach.com/coastal-restaurant-menu', section: 'Restaurant' },
    { slug: 'coastal-orange-beach', type: 'menu', url: 'https://www.coastalorangebeach.com/coastal-breakfast-menu', section: 'Breakfast' },
    { slug: 'coastal-orange-beach', type: 'menu', url: 'https://www.coastalorangebeach.com/beachside-bar-menu', section: 'Beach Bar' },
    { slug: 'flora-bama-yacht-club', type: 'menu', url: 'https://www.florabamayachtclub.com/menu' },
    { slug: 'voyagers', type: 'menu', url: 'https://voyagersrestaurant.com/menu' },
    { slug: 'voyagers', type: 'menu', url: 'https://voyagersrestaurant.com/admin/fm/source/5635_VoyagersPerdido/Voyagers-Dinner-Menu-March-2025-Website.pdf', format: 'pdf', section: 'Dinner' },
    { slug: 'docs-seafood-shack', type: 'menu', url: 'https://www.docsseafoodshack.com/seafood-menu/' },
    { slug: 'docs-seafood-shack', type: 'menu', url: 'https://www.docsseafoodshack.com/wp-content/uploads/2019/07/Docs-Seafood-Shack-and-Oyster-Bar-Menu.pdf', format: 'pdf' },
    { slug: 'lunas-eat-and-drink', type: 'menu', url: 'https://www.lunaseatanddrink.com/menu' },
    { slug: 'tacky-jacks-seafood-restaurant-and-tavern', type: 'menu', url: 'https://www.tackyjacks.com/download-menus' },
    { slug: 'sunliner-diner', type: 'specials', url: 'https://sunlinerdiner.com/happy-days-special/' }
];

async function fetchContent(url, format) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
            redirect: 'follow',
            signal: AbortSignal.timeout(30000)
        });
        if (!res.ok) return null;
        if (format === 'pdf') {
            const buf = Buffer.from(await res.arrayBuffer());
            return { pdfBase64: buf.toString('base64'), size: buf.length };
        }
        const text = await res.text();
        return { html: text.slice(0, 100000) };
    } catch (e) {
        return null;
    }
}

async function importToDb(entry, entityId, data) {
    if (!data || !data.sections) return { inserted: 0, sections: 0 };

    const isHH = entry.type === 'happy_hour';
    const sectionsTable = isHH ? 'happy_hour_sections' : 'menu_sections';
    const itemsTable = isHH ? 'happy_hour_items' : 'menu_items';

    let sectionsCreated = 0;
    let itemsInserted = 0;

    if (isHH && data.schedule_days) {
        await supabase.from('entity').update({
            hh_days: data.schedule_days || null,
            hh_start: data.schedule_start || null,
            hh_end: data.schedule_end || null,
            hh_description: data.schedule || null,
            updated_at: new Date().toISOString()
        }).eq('id', entityId);
    }

    for (const section of data.sections) {
        if (!section.items || section.items.length === 0) continue;

        const { data: sec, error: secErr } = await supabase.from(sectionsTable).insert({
            entity_id: entityId,
            section_name: section.name || 'Menu',
            sort_order: sectionsCreated
        }).select('id').single();

        if (secErr) { console.log(`    Section insert failed: ${secErr.message}`); continue; }
        sectionsCreated++;

        const rows = section.items.filter(i => i.name).map((item, idx) => ({
            entity_id: entityId,
            [isHH ? 'happy_hour_section_id' : 'menu_section_id']: sec.id,
            item_name: item.name,
            description: item.description || null,
            price: typeof item.price === 'number' ? item.price : null,
            price_text: typeof item.price === 'number' ? `$${item.price}` : (item.price_text || null),
            sort_order: idx,
            is_available: true
        }));

        if (rows.length > 0) {
            for (let i = 0; i < rows.length; i += 100) {
                const chunk = rows.slice(i, i + 100);
                const { error } = await supabase.from(itemsTable).insert(chunk);
                if (error) { console.log(`    Items insert failed: ${error.message}`); }
                else itemsInserted += chunk.length;
            }
        }
    }

    return { inserted: itemsInserted, sections: sectionsCreated };
}

async function extractMenuFromHtml(html, entryType) {
    // Simple extraction patterns for common menu structures
    const sections = [];

    // Look for common section headers
    const sectionPatterns = [
        /(?:appetizers?|starters?|apps?)/i,
        /(?:entrees?|mains?|main courses?)/i,
        /(?:drinks?|beverages?|cocktails?|wine|beer)/i,
        /(?:desserts?|sweets?)/i,
        /(?:breakfast|brunch)/i,
        /(?:lunch)/i,
        /(?:dinner)/i,
    ];

    // Extract menu items with prices
    const itemRegex = /([A-Z][A-Za-z\s]{2,50})\s+\.+\s*\$?([\d.]+)/g;
    const items = [];
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
        items.push({
            name: match[1].trim(),
            price: parseFloat(match[2]),
            description: null
        });
    }

    if (items.length > 0) {
        sections.push({
            name: 'Menu',
            items: items.slice(0, 50)
        });
    }

    return { sections };
}

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (use --apply to commit) ===\n' : '=== APPLYING ===\n');
    console.log(`Curated URLs to scrape: ${CURATED.length}\n`);

    const slugs = [...new Set(CURATED.map(c => c.slug))];
    const { data: entities } = await supabase.from('entity').select('id, name, slug').in('slug', slugs);
    const byS = {};
    entities.forEach(e => { byS[e.slug] = e; });

    const missingSlugs = slugs.filter(s => !byS[s]);
    if (missingSlugs.length) {
        console.log('⚠️  Slugs not found in DB:');
        missingSlugs.forEach(s => console.log(`    • ${s}`));
        console.log('');
    }

    const results = [];
    for (let i = 0; i < CURATED.length; i++) {
        const entry = CURATED[i];
        const entity = byS[entry.slug];
        console.log(`[${i+1}/${CURATED.length}] ${entity?.name || entry.slug} — ${entry.type}${entry.section ? ' · ' + entry.section : ''}`);
        console.log(`    ${entry.url}`);

        if (!entity) {
            console.log(`    ⏭ SKIP: entity not found`);
            results.push({ ...entry, status: 'entity-not-found' });
            continue;
        }

        const fetched = await fetchContent(entry.url, entry.format);
        if (!fetched) {
            console.log(`    ❌ fetch-failed`);
            results.push({ ...entry, status: 'fetch-failed' });
            continue;
        }

        let data;
        try {
            if (fetched.pdfBase64) {
                // For PDFs, extract simple structure
                data = { sections: [{ name: entry.section || 'Menu', items: [] }] };
            } else {
                data = await extractMenuFromHtml(fetched.html, entry.type);
            }
        } catch (e) {
            console.log(`    ❌ parse-error: ${e.message}`);
            results.push({ ...entry, status: 'parse-error' });
            continue;
        }

        const secs = (data.sections || []).filter(s => s.items?.length);
        const totalItems = secs.reduce((s, sec) => s + sec.items.length, 0);
        console.log(`    📋 Extracted: ${secs.length} sections, ${totalItems} items`);

        if (DRY_RUN) {
            console.log(`    (dry-run — not inserted)`);
        } else {
            const { inserted, sections } = await importToDb(entry, entity.id, data);
            console.log(`    ✅ Inserted: ${sections} sections, ${inserted} items`);
        }
        results.push({ ...entry, status: 'ok', data });
    }

    console.log('\n' + '═'.repeat(72));
    console.log('SUMMARY');
    console.log('═'.repeat(72));
    const ok = results.filter(r => r.status === 'ok');
    const failed = results.filter(r => r.status !== 'ok');
    console.log(`  Scraped successfully: ${ok.length}`);
    console.log(`  Failed:               ${failed.length}`);
}

run().catch(e => { console.error(e); process.exit(1); });
