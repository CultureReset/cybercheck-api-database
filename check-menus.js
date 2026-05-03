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
    'coffee_shop': 'coffee_sweets',
    'cafe': 'coffee_sweets',
    'bakery': 'coffee_sweets',
    'jet-ski-rentals-tours': 'things_to_do',
    'activity': 'things_to_do',
    'attraction': 'things_to_do',
    'tour': 'things_to_do',
    'rental': 'things_to_do',
};

async function run() {
    // Get all entities in the three categories
    const { data, error } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype, is_active')
        .eq('is_active', true)
        .order('name');

    if (error) { console.error(error); return; }

    const real = data.filter(e => !isTestSlug(e.slug));

    const byCategory = {
        'restaurants': [],
        'coffee_sweets': [],
        'things_to_do': [],
    };

    for (const e of real) {
        const cat = categoryMap[e.entity_subtype];
        if (cat) byCategory[cat].push(e);
    }

    console.log('Checking menu items with prices...\n');

    for (const [cat, entities] of Object.entries(byCategory)) {
        const label = {
            'restaurants': '🍽️ RESTAURANTS',
            'coffee_sweets': '☕ COFFEE & SWEETS',
            'things_to_do': '🎯 THINGS TO DO'
        }[cat];

        let withMenus = 0;
        const menusDetails = [];

        for (const e of entities) {
            const { data: items } = await supabase
                .from('item')
                .select('id, name, price')
                .eq('entity_id', e.id)
                .eq('is_active', true);

            if (items && items.length > 0) {
                withMenus++;
                const hasPrice = items.filter(i => i.price && i.price > 0).length;
                menusDetails.push({
                    name: e.name,
                    slug: e.slug,
                    totalItems: items.length,
                    itemsWithPrice: hasPrice
                });
            }
        }

        console.log(`${label} (${entities.length} total)`);
        console.log(`  ✓ With menu items: ${withMenus}`);
        console.log(`  ✗ Without menu items: ${entities.length - withMenus}`);
        
        if (menusDetails.length > 0) {
            console.log(`\n  Businesses with menus:\n`);
            menusDetails.forEach(m => {
                console.log(`    • ${m.name}`);
                console.log(`      Items: ${m.totalItems} (${m.itemsWithPrice} with prices)`);
                console.log(`      Slug: ${m.slug}\n`);
            });
        }
        console.log('');
    }
}

run();
