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
    
    const counts = {};
    for (const e of restaurants) counts[e.id] = { menu: 0, drinks: 0, priced: 0 };
    for (const i of menuItems) {
        if (!counts[i.entity_id]) continue;
        counts[i.entity_id].menu++;
        if ((i.price && Number(i.price) > 0) || (i.price_text && String(i.price_text).trim())) counts[i.entity_id].priced++;
    }
    for (const i of drinkItems) {
        if (!counts[i.entity_id]) continue;
        counts[i.entity_id].drinks++;
        if ((i.price && Number(i.price) > 0) || (i.price_text && String(i.price_text).trim())) counts[i.entity_id].priced++;
    }
    
    const withAny = restaurants
        .map(e => ({ ...e, ...counts[e.id], total: counts[e.id].menu + counts[e.id].drinks }))
        .filter(e => e.total > 0)
        .sort((a, b) => b.total - a.total);
    
    const empty = restaurants.filter(e => counts[e.id].menu + counts[e.id].drinks === 0);
    
    console.log(`═══════════════════════════════════════════════════════════════════════════`);
    console.log(`RESTAURANTS WITH ANY MENU DATA (${withAny.length} of ${restaurants.length})`);
    console.log(`═══════════════════════════════════════════════════════════════════════════\n`);
    console.log(`  # | Restaurant                                          | Food | Drinks | Total | Priced`);
    console.log(`────┼─────────────────────────────────────────────────────┼──────┼────────┼───────┼───────`);
    withAny.forEach((e, i) => {
        const n = String(i+1).padStart(3);
        const name = e.name.length > 50 ? e.name.slice(0,47)+'...' : e.name.padEnd(50);
        console.log(`${n} | ${name}  | ${String(e.menu).padStart(4)} | ${String(e.drinks).padStart(6)} | ${String(e.total).padStart(5)} | ${String(e.priced).padStart(5)}`);
    });
    
    console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
    console.log(`RESTAURANTS WITH ZERO MENU DATA (${empty.length})`);
    console.log(`═══════════════════════════════════════════════════════════════════════════\n`);
    empty.forEach(e => console.log(`  • ${e.name}`));
    
    const totalMenu = withAny.reduce((s, e) => s + e.menu, 0);
    const totalDrinks = withAny.reduce((s, e) => s + e.drinks, 0);
    const totalPriced = withAny.reduce((s, e) => s + e.priced, 0);
    console.log(`\n═══════════════════════════════════════════════════════════════════════════`);
    console.log(`TOTALS`);
    console.log(`═══════════════════════════════════════════════════════════════════════════`);
    console.log(`  Restaurants with menus: ${withAny.length} of ${restaurants.length}`);
    console.log(`  Total food items: ${totalMenu}`);
    console.log(`  Total drink items: ${totalDrinks}`);
    console.log(`  Total items priced: ${totalPriced}`);
}

run();
