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

const TTD_SUBTYPES = ['jet-ski-rentals-tours', 'activity', 'attraction', 'tour', 'rental'];

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

function priceLabel(item) {
    if (item.price_text && String(item.price_text).trim()) return item.price_text;
    if (item.price && Number(item.price) > 0) return `$${item.price}`;
    return 'NO PRICE';
}

async function run() {
    console.log('Loading Things To Do data from Supabase...\n');

    const entities = await fetchAll('entity', '*');
    const ttd = entities
        .filter(e => e.is_active && !isTestSlug(e.slug) && TTD_SUBTYPES.includes(e.entity_subtype))
        .sort((a, b) => a.name.localeCompare(b.name));

    const menuItems = await fetchAll('menu_items', 'entity_id, item_name, description, price, price_text, image_url, item_type');
    const menuSections = await fetchAll('menu_sections', 'entity_id, section_name');
    const fleetItems = await fetchAll('fleet_items', 'entity_id, name, price, price_text, description');

    const byEntity = {};
    for (const e of ttd) {
        byEntity[e.id] = { items: [], sections: [], fleet: [] };
    }
    for (const i of menuItems) if (byEntity[i.entity_id]) byEntity[i.entity_id].items.push(i);
    for (const s of menuSections) if (byEntity[s.entity_id]) byEntity[s.entity_id].sections.push(s);
    for (const f of fleetItems) if (byEntity[f.entity_id]) byEntity[f.entity_id].fleet.push(f);

    const lines = [];
    const summary = [];

    lines.push('═'.repeat(80));
    lines.push(`🎯 THINGS TO DO (${ttd.length} businesses)`);
    lines.push('═'.repeat(80));

    for (const e of ttd) {
        const d = byEntity[e.id];
        const itemCount = d.items.length;
        const fleetCount = d.fleet.length;
        const totalCount = itemCount + fleetCount;
        const pricedItems = d.items.filter(hasPrice).length;
        const pricedFleet = d.fleet.filter(hasPrice).length;
        const totalPriced = pricedItems + pricedFleet;
        const photoCount = d.items.filter(i => i.image_url).length;

        const status = totalCount === 0 ? '❌ EMPTY' :
                       totalPriced === 0 ? '⚠️ NO PRICES' :
                       totalPriced < totalCount ? '🟡 PARTIAL PRICES' : '✅ FULL';

        lines.push(`\n${status}  ${e.name}`);
        lines.push(`    Slug: ${e.slug}`);
        lines.push(`    City: ${e.city || '—'} | Subtype: ${e.entity_subtype}`);
        lines.push(`    Description: ${e.description ? 'YES' : '❌ MISSING'} | Hero Image: ${e.hero_image_url ? 'YES' : '❌ MISSING'} | Phone: ${e.phone || '❌'}`);
        if (e.price_from || e.price_to) {
            lines.push(`    Entity-level price: $${e.price_from || '?'}${e.price_to ? '–$' + e.price_to : ''} ${e.price_unit || ''}`);
        }
        lines.push(`    Sections: ${d.sections.length} | Tour/Rental Items: ${itemCount} (${pricedItems} priced, ${photoCount} with photos) | Fleet: ${fleetCount} (${pricedFleet} priced)`);
        lines.push(`    TOTAL: ${totalCount} items | ${totalPriced} priced`);

        if (d.items.length > 0) {
            lines.push(`    --- Tours/Rentals ---`);
            d.items.forEach(i => {
                const name = i.item_name || (i.description ? i.description.slice(0, 60) : '(unnamed)');
                lines.push(`      • ${name} — ${priceLabel(i)}`);
            });
        }
        if (d.fleet.length > 0) {
            lines.push(`    --- Fleet ---`);
            d.fleet.forEach(f => {
                lines.push(`      • ${f.name || '(unnamed)'} — ${priceLabel(f)}`);
            });
        }

        summary.push({
            name: e.name,
            slug: e.slug,
            subtype: e.entity_subtype,
            status,
            description: !!e.description,
            heroImage: !!e.hero_image_url,
            phone: !!e.phone,
            sections: d.sections.length,
            tourItems: itemCount,
            tourPriced: pricedItems,
            tourPhotos: photoCount,
            fleet: fleetCount,
            fleetPriced: pricedFleet,
            totalItems: totalCount,
            totalPriced
        });
    }

    console.log(lines.join('\n'));

    console.log('\n' + '═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));
    const empty = summary.filter(s => s.status === '❌ EMPTY').length;
    const noPrices = summary.filter(s => s.status === '⚠️ NO PRICES').length;
    const partial = summary.filter(s => s.status === '🟡 PARTIAL PRICES').length;
    const full = summary.filter(s => s.status === '✅ FULL').length;
    console.log(`  ✅ Full data:        ${full}`);
    console.log(`  🟡 Partial prices:   ${partial}`);
    console.log(`  ⚠️ Has items, no prices: ${noPrices}`);
    console.log(`  ❌ Empty (no items): ${empty}`);
    console.log(`  TOTAL:               ${summary.length}`);

    const csvPath = '/Users/owner/cybercheck-api-database/things-to-do-report.csv';
    const headers = ['Name', 'Slug', 'Subtype', 'Status', 'Description', 'HeroImage', 'Phone',
                     'Sections', 'TourItems', 'TourPriced', 'TourPhotos', 'Fleet', 'FleetPriced',
                     'TotalItems', 'TotalPriced'];
    const rows = [headers.join(',')];
    for (const s of summary) {
        rows.push([`"${s.name.replace(/"/g, '""')}"`, s.slug, s.subtype, s.status,
                   s.description, s.heroImage, s.phone,
                   s.sections, s.tourItems, s.tourPriced, s.tourPhotos,
                   s.fleet, s.fleetPriced, s.totalItems, s.totalPriced].join(','));
    }
    fs.writeFileSync(csvPath, rows.join('\n'));
    console.log(`\n📊 CSV report saved: ${csvPath}`);

    const jsonPath = '/Users/owner/cybercheck-api-database/things-to-do-report.json';
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
    console.log(`📋 JSON report saved: ${jsonPath}`);
}

run();
