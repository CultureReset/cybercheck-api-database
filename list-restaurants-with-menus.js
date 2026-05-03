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

async function fetchAll(table, cols) {
    const all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from(table).select(cols).range(from, from + 999);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < 1000) break;
        from += 1000;
    }
    return all;
}

async function run() {
    const entities = await fetchAll('entity', 'id, name, slug, entity_subtype, is_active');
    const restaurants = entities.filter(e => e.is_active && !isTestSlug(e.slug) && e.entity_subtype === 'restaurant');
    
    const menuItems = await fetchAll('menu_items', 'entity_id, price, price_text');
    const drinkItems = await fetchAll('drink_items', 'entity_id, price, price_text');
    
    const byEntity = {};
    for (const e of restaurants) byEntity[e.id] = { total: 0, priced: 0 };
    for (const i of menuItems) {
        if (!byEntity[i.entity_id]) continue;
        byEntity[i.entity_id].total++;
        if ((i.price && Number(i.price) > 0) || (i.price_text && String(i.price_text).trim())) byEntity[i.entity_id].priced++;
    }
    for (const i of drinkItems) {
        if (!byEntity[i.entity_id]) continue;
        byEntity[i.entity_id].total++;
        if ((i.price && Number(i.price) > 0) || (i.price_text && String(i.price_text).trim())) byEntity[i.entity_id].priced++;
    }
    
    const withPrices = restaurants
        .map(e => ({ ...e, ...byEntity[e.id] }))
        .filter(e => e.priced > 0)
        .sort((a, b) => b.priced - a.priced);
    
    console.log(`═══════════════════════════════════════════════════════════════`);
    console.log(`RESTAURANTS WITH PRICED MENU ITEMS (${withPrices.length} of ${restaurants.length} total)`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);
    
    withPrices.forEach((e, i) => {
        console.log(`${String(i+1).padStart(3)}. ${e.name.padEnd(50)} ${e.priced}/${e.total} priced`);
    });
    
    const emptyOrNoPrice = restaurants.filter(e => byEntity[e.id].priced === 0);
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`RESTAURANTS WITHOUT PRICED MENU ITEMS (${emptyOrNoPrice.length})`);
    console.log(`═══════════════════════════════════════════════════════════════\n`);
    emptyOrNoPrice.forEach(e => {
        const d = byEntity[e.id];
        const tag = d.total === 0 ? 'EMPTY' : `${d.total} items, none priced`;
        console.log(`  • ${e.name.padEnd(50)} [${tag}]`);
    });
}

run();
