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

    const pages = [
        { emoji: '🍽️', name: 'RESTAURANTS', key: 'restaurants' },
        { emoji: '☕', name: 'COFFEE & SWEETS', key: 'coffee_sweets' },
        { emoji: '🍻', name: 'HAPPY HOURS', key: 'happy_hours' },
        { emoji: '🎯', name: 'THINGS TO DO', key: 'things_to_do' },
        { emoji: '🛠️', name: 'SERVICES', key: 'services' },
        { emoji: '✨', name: 'PUBLIC SPOTS', key: 'public_spots' },
    ];

    for (const page of pages) {
        const items = byCategory[page.key];
        console.log(`\n${'='.repeat(80)}`);
        console.log(`${page.emoji} ${page.name} (${items.length})`);
        console.log(`${'='.repeat(80)}\n`);
        
        items.forEach((e, idx) => {
            console.log(`${idx + 1}. ${e.name}`);
            console.log(`   Slug: ${e.slug}`);
            console.log(`   Subtype: ${e.entity_subtype}`);
            if (e.city) console.log(`   City: ${e.city}`);
            if (e.address_line_1) console.log(`   Address: ${e.address_line_1}`);
            console.log('');
        });
    }
}

run();
