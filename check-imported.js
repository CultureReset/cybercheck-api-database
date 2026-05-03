require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    // Find the 2 entities we enriched
    const { data: entities } = await supabase
        .from('entity')
        .select('id, name, slug, description, duration_text, meeting_point, hero_image_url, price_from')
        .or('name.ilike.%Sunny Lady%,name.ilike.%Helicopter Tours%');

    for (const e of entities) {
        console.log('━'.repeat(70));
        console.log(`📍 ${e.name}`);
        console.log(`   slug: ${e.slug}`);
        console.log(`   description: ${e.description ? e.description.slice(0, 80) + '...' : '❌ MISSING'}`);
        console.log(`   duration: ${e.duration_text || '❌ MISSING'}`);
        console.log(`   meeting_point: ${e.meeting_point || '❌ MISSING'}`);
        console.log(`   hero_image_url: ${e.hero_image_url ? 'YES' : '❌ MISSING'}`);
        console.log(`   price_from: ${e.price_from || '❌ MISSING'}`);

        const { data: items } = await supabase
            .from('menu_items')
            .select('item_name, price, price_text, sort_order')
            .eq('entity_id', e.id)
            .order('sort_order');

        console.log(`   menu_items: ${items.length}`);
        items.forEach(i => console.log(`      • ${i.item_name} = ${i.price_text || '$' + i.price}`));
        console.log('');
    }
}

run();
