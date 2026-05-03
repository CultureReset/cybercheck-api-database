require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

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
    'jet-ski-rentals-tours': 'things_to_do', 'activity': 'things_to_do',
    'attraction': 'things_to_do', 'tour': 'things_to_do', 'rental': 'things_to_do',
};

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

async function run() {
    const entities = await fetchAll('entity', 'id, name, slug, entity_subtype, is_active');
    const real = entities.filter(e => e.is_active && !isTestSlug(e.slug));
    
    const byCategory = { restaurants: [], coffee_sweets: [], things_to_do: [] };
    for (const e of real) {
        const cat = categoryMap[e.entity_subtype];
        if (cat) byCategory[cat].push(e);
    }

    console.log('Fetching menu_items, drink_items, fleet_items...');
    const menuItems = await fetchAll('menu_items', 'entity_id, price, price_text');
    const drinkItems = await fetchAll('drink_items', 'entity_id, price, price_text');
    const fleetItems = await fetchAll('fleet_items', 'entity_id, price, price_text');

    console.log(`\nTotal menu_items: ${menuItems.length}`);
    console.log(`Total drink_items: ${drinkItems.length}`);
    console.log(`Total fleet_items: ${fleetItems.length}\n`);

    const hasItems = (set, items) => items.forEach(i => i.entity_id && set.add(i.entity_id));
    const hasPriced = (set, items) => items.forEach(i => {
        if (!i.entity_id) return;
        if ((i.price && Number(i.price) > 0) || (i.price_text && i.price_text.trim())) set.add(i.entity_id);
    });

    const allItems = new Set();
    const allPriced = new Set();
    hasItems(allItems, menuItems); hasItems(allItems, drinkItems); hasItems(allItems, fleetItems);
    hasPriced(allPriced, menuItems); hasPriced(allPriced, drinkItems); hasPriced(allPriced, fleetItems);

    for (const [cat, list] of Object.entries(byCategory)) {
        const label = { restaurants: '🍽️ RESTAURANTS', coffee_sweets: '☕ COFFEE & SWEETS', things_to_do: '🎯 THINGS TO DO' }[cat];
        const withItems = list.filter(e => allItems.has(e.id));
        const withPrices = list.filter(e => allPriced.has(e.id));
        console.log(`${label} (${list.length} total)`);
        console.log(`  ✓ With menu/drink/fleet items: ${withItems.length}`);
        console.log(`  💰 With items that have prices: ${withPrices.length}`);
        console.log(`  ✗ Empty (no items at all): ${list.length - withItems.length}\n`);
    }
}

run();
