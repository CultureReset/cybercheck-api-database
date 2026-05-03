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

async function run() {
    const { data: entities } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype')
        .eq('is_active', true);
    
    const real = entities.filter(e => !isTestSlug(e.slug));
    
    const byCategory = { restaurants: [], coffee_sweets: [], things_to_do: [] };
    for (const e of real) {
        const cat = categoryMap[e.entity_subtype];
        if (cat) byCategory[cat].push(e);
    }

    // Get all menu_items + their entity_ids
    const { data: menuItems } = await supabase
        .from('menu_items')
        .select('entity_id, name, price, price_text');
    
    const { data: drinkItems } = await supabase
        .from('drink_items')
        .select('entity_id, name, price, price_text');
    
    const { data: fleetItems } = await supabase
        .from('fleet_items')
        .select('entity_id, name, price, price_text');

    console.log(`Total menu_items: ${menuItems?.length || 0}`);
    console.log(`Total drink_items: ${drinkItems?.length || 0}`);
    console.log(`Total fleet_items: ${fleetItems?.length || 0}\n`);

    // Build entity_id sets with menu/drink/fleet items WITH a price
    const hasMenu = new Set();
    const hasMenuWithPrice = new Set();
    (menuItems || []).forEach(i => {
        hasMenu.add(i.entity_id);
        if (i.price || (i.price_text && i.price_text.trim())) hasMenuWithPrice.add(i.entity_id);
    });

    const hasDrink = new Set();
    const hasDrinkWithPrice = new Set();
    (drinkItems || []).forEach(i => {
        hasDrink.add(i.entity_id);
        if (i.price || (i.price_text && i.price_text.trim())) hasDrinkWithPrice.add(i.entity_id);
    });

    const hasFleet = new Set();
    const hasFleetWithPrice = new Set();
    (fleetItems || []).forEach(i => {
        hasFleet.add(i.entity_id);
        if (i.price || (i.price_text && i.price_text.trim())) hasFleetWithPrice.add(i.entity_id);
    });

    for (const [cat, list] of Object.entries(byCategory)) {
        const label = { restaurants: '🍽️ RESTAURANTS', coffee_sweets: '☕ COFFEE & SWEETS', things_to_do: '🎯 THINGS TO DO' }[cat];
        const withMenu = list.filter(e => hasMenu.has(e.id) || hasDrink.has(e.id) || hasFleet.has(e.id));
        const withPrice = list.filter(e => hasMenuWithPrice.has(e.id) || hasDrinkWithPrice.has(e.id) || hasFleetWithPrice.has(e.id));
        
        console.log(`\n${label} (${list.length} total)`);
        console.log(`  ✓ With any menu/items: ${withMenu.length}`);
        console.log(`  💰 With items that have prices: ${withPrice.length}`);
        console.log(`  ✗ Without any items: ${list.length - withMenu.length}`);
        
        if (withPrice.length > 0) {
            console.log(`\n  Businesses with priced items:`);
            withPrice.forEach(e => console.log(`    • ${e.name}`));
        }
    }
}

run();
