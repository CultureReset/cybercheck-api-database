require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

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

async function run() {
    const { data: entities } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype, price_from, price_to, price_unit')
        .eq('is_active', true)
        .in('entity_subtype', TTD_SUBTYPES)
        .order('name');

    console.log('Fetching all menu_items...');
    const menuItems = await fetchAll('menu_items', '*');
    
    // Check what columns actually exist
    if (menuItems.length > 0) {
        console.log('\nmenu_items columns:', Object.keys(menuItems[0]).join(', '));
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎯 THINGS TO DO — TOURS, RENTALS, PRICING');
    console.log('='.repeat(80) + '\n');

    for (const e of entities) {
        const items = menuItems.filter(i => i.entity_id === e.id);
        console.log(`\n📍 ${e.name}`);
        console.log(`   Slug: ${e.slug} | Subtype: ${e.entity_subtype}`);
        if (e.price_from || e.price_to) {
            console.log(`   Entity-level price: $${e.price_from || '?'}${e.price_to ? '–$' + e.price_to : ''} ${e.price_unit || ''}`);
        }
        if (items.length === 0) {
            console.log(`   ❌ NO tours/rentals in database`);
        } else {
            console.log(`   ✓ ${items.length} tours/rentals/packages:`);
            items.forEach(i => {
                const priceInfo = i.price_text || (i.price ? `$${i.price}` : 'NO PRICE');
                console.log(`      • ${i.name || '(unnamed)'} — ${priceInfo}`);
                if (i.description) console.log(`        ${i.description.slice(0, 100)}${i.description.length > 100 ? '...' : ''}`);
            });
        }
    }
}

run();
