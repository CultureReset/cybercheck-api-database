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
    'bar': 'happy_hours',
    'nightclub': 'happy_hours',
    'lounge': 'happy_hours',
    'activity': 'things_to_do',
    'attraction': 'things_to_do',
    'tour': 'things_to_do',
    'rental': 'things_to_do',
    'jet-ski-rentals-tours': 'things_to_do',
    'salon': 'services',
    'spa': 'services',
    'gym': 'services',
    'park': 'public_spots',
    'beach': 'public_spots',
    'pier': 'public_spots',
    'market': 'public_spots',
};

async function run() {
    const { data, error } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype, city, address_line_1, is_active')
        .eq('is_active', true)
        .order('name');

    if (error) { console.error(error); return; }

    const real = data.filter(e => !isTestSlug(e.slug));

    const byCategory = {
        'restaurants': [],
        'coffee_sweets': [],
        'happy_hours': [],
        'things_to_do': [],
        'services': [],
        'public_spots': [],
    };

    for (const e of real) {
        const cat = categoryMap[e.entity_subtype];
        if (cat) byCategory[cat].push(e);
    }

    console.log('🍽️ RESTAURANTS (' + byCategory.restaurants.length + ')');
    console.log('─'.repeat(70));
    byCategory.restaurants.forEach(e => console.log(e.name));
    
    console.log('\n☕ COFFEE & SWEETS (' + byCategory.coffee_sweets.length + ')');
    console.log('─'.repeat(70));
    byCategory.coffee_sweets.forEach(e => console.log(e.name));
    
    console.log('\n🍻 HAPPY HOURS (' + byCategory.happy_hours.length + ')');
    console.log('─'.repeat(70));
    byCategory.happy_hours.forEach(e => console.log(e.name));
    
    console.log('\n🎯 THINGS TO DO (' + byCategory.things_to_do.length + ')');
    console.log('─'.repeat(70));
    byCategory.things_to_do.forEach(e => console.log(e.name));
    
    console.log('\n🛠️ SERVICES (' + byCategory.services.length + ')');
    console.log('─'.repeat(70));
    byCategory.services.forEach(e => console.log(e.name));
    
    console.log('\n✨ PUBLIC SPOTS (' + byCategory.public_spots.length + ')');
    console.log('─'.repeat(70));
    byCategory.public_spots.forEach(e => console.log(e.name));
    
    const total = Object.values(byCategory).reduce((s, arr) => s + arr.length, 0);
    console.log('\n' + '═'.repeat(70));
    console.log('TOTAL: ' + total + ' businesses live');
}

run();
