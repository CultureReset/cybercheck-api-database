require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    const { data, error } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype, city, address_line_1, is_active, created_at')
        .eq('is_active', true)
        .order('created_at');

    if (error) { console.error(error); return; }

    // DUPLICATES TO DEACTIVATE WITH REASONING
    const duplicates = [
        // RESTAURANTS
        {
            cluster: 'Carmelo (same address)',
            keep: 'carmelo-italian-restaurant',
            deactivate: ['carmelo-italian'],
            reason: 'Keep the longer, more descriptive slug'
        },
        {
            cluster: "Doc's Seafood Shack (same address)",
            keep: 'docs-seafood-shack',
            deactivate: ['docs-seafood-shack-and-oyster-bar'],
            reason: 'Keep the shorter, established slug'
        },
        {
            cluster: "Lulu's (same location)",
            keep: 'lulus-fun-food-music',
            deactivate: ['lulus-gulf-shores'],
            reason: 'Keep the more descriptive slug with full name'
        },
        {
            cluster: 'The Gulf (same address)',
            keep: 'the-gulf',
            deactivate: ['the-gulf-orange-beach'],
            reason: 'Keep the shorter, cleaner slug'
        },
        {
            cluster: 'The Hangout (same location)',
            keep: 'the-hangout-gulf-shores',
            deactivate: ['the-hangout-restaurant'],
            reason: 'Keep the slug with location identifier'
        },
        {
            cluster: 'Wolf Bay (3 variants)',
            keep: 'wolf-bay-restaurant',
            deactivate: ['wolf-bay', 'wolf-bay-lodge'],
            reason: 'Keep the most specific slug (restaurant)'
        },
        // COFFEE & SWEETS
        {
            cluster: 'Anchored Coffee (same address)',
            keep: 'anchored-coffee-house',
            deactivate: ['anchored-coffeehouse'],
            reason: 'Keep the hyphenated version (more standard)'
        },
        {
            cluster: 'Happy Pappys Coffee (same address)',
            keep: 'happy-pappys-coffee',
            deactivate: ['happy-pappys-coffeehouse'],
            reason: 'Keep the shorter slug'
        },
        {
            cluster: 'The Southern Grind (same location)',
            keep: 'the-southern-grind-coffee-house',
            deactivate: ['the-southern-grind-coffee-house-at-the-wharf'],
            reason: 'Keep the main location slug'
        },
        // SERVICES
        {
            cluster: 'Angel Hair Salon (same address)',
            keep: 'angel-hair-salon-day-spa',
            deactivate: ['angel-hair-salon-boutique'],
            reason: 'Keep the more complete slug (includes Day Spa)'
        }
    ];

    console.log('════════════════════════════════════════════════════════════════════════════════');
    console.log('GCR DEDUPLICATION LIST - RECOMMENDED DEACTIVATIONS');
    console.log('════════════════════════════════════════════════════════════════════════════════\n');

    let totalDedup = 0;
    for (const dup of duplicates) {
        console.log(`❌ ${dup.cluster}`);
        console.log(`   Keep: ${dup.keep}`);
        console.log(`   Deactivate: ${dup.deactivate.join(', ')}`);
        console.log(`   Reason: ${dup.reason}\n`);
        totalDedup += dup.deactivate.length;
    }

    console.log('════════════════════════════════════════════════════════════════════════════════');
    console.log(`TOTAL: ${duplicates.length} duplicate clusters = ${totalDedup} entities to deactivate`);
    console.log('════════════════════════════════════════════════════════════════════════════════\n');

    // Now look up the actual IDs
    console.log('\nFETCHING ENTITY IDs FOR DEACTIVATION:\n');
    const allSlugsToDeactivate = [];
    for (const dup of duplicates) {
        allSlugsToDeactivate.push(...dup.deactivate);
    }

    const { data: entitiesToDedup } = await supabase
        .from('entity')
        .select('id, name, slug')
        .in('slug', allSlugsToDeactivate);

    if (entitiesToDedup && entitiesToDedup.length > 0) {
        console.log('Entities ready to deactivate:');
        entitiesToDedup.forEach(e => {
            console.log(`  • ${e.name} (${e.slug}) - ID: ${e.id.slice(0, 8)}`);
        });
    }
}

run();
