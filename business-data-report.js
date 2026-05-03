require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

function isTestSlug(slug) {
    const s = (slug || '').toLowerCase();
    return s.startsWith('gcr-upload-test-') || s.startsWith('gcr-sections-test-') ||
           s.startsWith('gcr-toggle-test-') || s.startsWith('gcr-section-flow-test-') ||
           s.startsWith('gcr-items-test-') || s.startsWith('gcr-events-test-') ||
           s.startsWith('gcr-tags-test-') || s.startsWith('gcr-verify-') ||
           (s.startsWith('gcr-') && s.includes('-test-'));
}

const categoryMap = {
    'restaurant': 'restaurants',
    'coffee_shop': 'coffee_sweets', 'cafe': 'coffee_sweets', 'bakery': 'coffee_sweets',
};

const ARG = process.argv[2];
const ONLY_PAGE = ARG && ['restaurants', 'coffee_sweets'].includes(ARG) ? ARG : null;

async function fetchAll(table, cols) {
    const all = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await supabase.from(table).select(cols).range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return all;
}

function hasPrice(item) {
    return (item.price && Number(item.price) > 0) || (item.price_text && String(item.price_text).trim());
}

async function run() {
    console.log('Loading data from Supabase...\n');

    const entities = await fetchAll('entity', '*');
    const real = entities.filter(e => e.is_active && !isTestSlug(e.slug));

    const byCategory = { restaurants: [], coffee_sweets: [] };
    for (const e of real) {
        const cat = categoryMap[e.entity_subtype];
        if (cat) byCategory[cat].push(e);
    }

    const menuItems = await fetchAll('menu_items', 'entity_id, item_name, description, price, price_text, image_url, item_type');
    const drinkItems = await fetchAll('drink_items', 'entity_id, item_name, description, price, price_text, item_type');
    const happyHourItems = await fetchAll('happy_hour_items', 'entity_id, item_name, description, price, price_text');
    const menuSections = await fetchAll('menu_sections', 'entity_id, section_name');
    const drinkSections = await fetchAll('drink_sections', 'entity_id, section_name');
    const happyHourSections = await fetchAll('happy_hour_sections', 'entity_id, section_name');

    // Index by entity_id
    const byEntity = {};
    for (const e of real) {
        byEntity[e.id] = { menu: [], drinks: [], happyHour: [], menuSections: [], drinkSections: [], hhSections: [] };
    }
    for (const i of menuItems) if (byEntity[i.entity_id]) byEntity[i.entity_id].menu.push(i);
    for (const i of drinkItems) if (byEntity[i.entity_id]) byEntity[i.entity_id].drinks.push(i);
    for (const i of happyHourItems) if (byEntity[i.entity_id]) byEntity[i.entity_id].happyHour.push(i);
    for (const s of menuSections) if (byEntity[s.entity_id]) byEntity[s.entity_id].menuSections.push(s);
    for (const s of drinkSections) if (byEntity[s.entity_id]) byEntity[s.entity_id].drinkSections.push(s);
    for (const s of happyHourSections) if (byEntity[s.entity_id]) byEntity[s.entity_id].hhSections.push(s);

    const labels = { restaurants: '🍽️ RESTAURANTS', coffee_sweets: '☕ COFFEE & SWEETS' };

    const lines = [];
    const summary = [];

    for (const [cat, list] of Object.entries(byCategory)) {
        if (ONLY_PAGE && cat !== ONLY_PAGE) continue;

        lines.push('\n' + '═'.repeat(80));
        lines.push(`${labels[cat]} (${list.length} businesses)`);
        lines.push('═'.repeat(80));

        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));

        for (const e of sorted) {
            const d = byEntity[e.id];
            const menuCount = d.menu.length;
            const drinkCount = d.drinks.length;
            const hhCount = d.happyHour.length;
            const totalItems = menuCount + drinkCount + hhCount;
            const pricedMenu = d.menu.filter(hasPrice).length;
            const pricedDrinks = d.drinks.filter(hasPrice).length;
            const pricedHH = d.happyHour.filter(hasPrice).length;
            const totalPriced = pricedMenu + pricedDrinks + pricedHH;
            const photoCount = d.menu.filter(i => i.image_url).length;

            const status = totalItems === 0 ? '❌ EMPTY' :
                           totalPriced === 0 ? '⚠️ NO PRICES' :
                           totalPriced < totalItems ? '🟡 PARTIAL PRICES' : '✅ FULL';

            lines.push(`\n${status}  ${e.name}`);
            lines.push(`    Slug: ${e.slug}`);
            lines.push(`    City: ${e.city || '—'} | Subtype: ${e.entity_subtype}`);
            lines.push(`    Description: ${e.description ? 'YES' : '❌ MISSING'} | Hero Image: ${e.hero_image_url ? 'YES' : '❌ MISSING'} | Phone: ${e.phone || '❌'}`);
            lines.push(`    Menu Sections: ${d.menuSections.length} | Drink Sections: ${d.drinkSections.length} | HH Sections: ${d.hhSections.length}`);
            lines.push(`    Menu Items: ${menuCount} (${pricedMenu} priced, ${photoCount} with photos)`);
            lines.push(`    Drink Items: ${drinkCount} (${pricedDrinks} priced)`);
            lines.push(`    Happy Hour Items: ${hhCount} (${pricedHH} priced)`);
            lines.push(`    TOTAL: ${totalItems} items | ${totalPriced} priced`);

            summary.push({
                page: cat,
                name: e.name,
                slug: e.slug,
                status,
                description: !!e.description,
                heroImage: !!e.hero_image_url,
                phone: !!e.phone,
                menuItems: menuCount,
                menuPriced: pricedMenu,
                menuPhotos: photoCount,
                drinks: drinkCount,
                drinksPriced: pricedDrinks,
                happyHour: hhCount,
                happyHourPriced: pricedHH,
                totalItems,
                totalPriced
            });
        }
    }

    // Print to console
    console.log(lines.join('\n'));

    // Summary table
    console.log('\n' + '═'.repeat(80));
    console.log('SUMMARY BY PAGE');
    console.log('═'.repeat(80));
    for (const [cat, list] of Object.entries(byCategory)) {
        if (ONLY_PAGE && cat !== ONLY_PAGE) continue;
        const subset = summary.filter(s => s.page === cat);
        const empty = subset.filter(s => s.status === '❌ EMPTY').length;
        const noPrices = subset.filter(s => s.status === '⚠️ NO PRICES').length;
        const partial = subset.filter(s => s.status === '🟡 PARTIAL PRICES').length;
        const full = subset.filter(s => s.status === '✅ FULL').length;
        console.log(`\n${labels[cat]} (${subset.length} total)`);
        console.log(`  ✅ Full data:        ${full}`);
        console.log(`  🟡 Partial prices:   ${partial}`);
        console.log(`  ⚠️ Has items, no prices: ${noPrices}`);
        console.log(`  ❌ Empty (no items): ${empty}`);
    }

    // Write CSV
    const csvPath = '/Users/owner/cybercheck-api-database/business-data-report.csv';
    const headers = ['Page', 'Name', 'Slug', 'Status', 'Description', 'HeroImage', 'Phone',
                     'MenuItems', 'MenuPriced', 'MenuPhotos', 'Drinks', 'DrinksPriced',
                     'HappyHour', 'HappyHourPriced', 'TotalItems', 'TotalPriced'];
    const rows = [headers.join(',')];
    for (const s of summary) {
        rows.push([s.page, `"${s.name.replace(/"/g, '""')}"`, s.slug, s.status,
                   s.description, s.heroImage, s.phone,
                   s.menuItems, s.menuPriced, s.menuPhotos,
                   s.drinks, s.drinksPriced, s.happyHour, s.happyHourPriced,
                   s.totalItems, s.totalPriced].join(','));
    }
    fs.writeFileSync(csvPath, rows.join('\n'));
    console.log(`\n📊 CSV report saved: ${csvPath}`);

    // Write JSON
    const jsonPath = '/Users/owner/cybercheck-api-database/business-data-report.json';
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
    console.log(`📋 JSON report saved: ${jsonPath}`);

    console.log('\nUSAGE:');
    console.log('  node business-data-report.js                  (both pages)');
    console.log('  node business-data-report.js restaurants      (restaurants only)');
    console.log('  node business-data-report.js coffee_sweets    (coffee & sweets only)');
}

run();
