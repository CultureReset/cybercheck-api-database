require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const DEACTIVATE = [
    { slug: 'carmelo-italian', keeping: 'carmelo-italian-restaurant' },
    { slug: 'docs-seafood-shack-and-oyster-bar', keeping: 'docs-seafood-shack' },
    { slug: 'lulus-gulf-shores', keeping: 'lulus-fun-food-music' },
    { slug: 'the-gulf-orange-beach', keeping: 'the-gulf' },
    { slug: 'the-hangout-restaurant', keeping: 'the-hangout-gulf-shores' },
    { slug: 'wolf-bay', keeping: 'wolf-bay-restaurant' },
    { slug: 'wolf-bay-lodge', keeping: 'wolf-bay-restaurant' },
    { slug: 'anchored-coffeehouse', keeping: 'anchored-coffee-house' },
    { slug: 'happy-pappys-coffeehouse', keeping: 'happy-pappys-coffee' },
    { slug: 'the-southern-grind-coffee-house-at-the-wharf', keeping: 'the-southern-grind-coffee-house' },
    { slug: 'angel-hair-salon-boutique', keeping: 'angel-hair-salon-day-spa' },
];

async function run() {
    console.log('=== DEACTIVATING 11 DUPLICATE ENTITIES ===\n');

    let ok = 0, fail = 0;
    for (const { slug, keeping } of DEACTIVATE) {
        const { data, error } = await supabase
            .from('entity')
            .select('id, name, slug, is_active')
            .eq('slug', slug);

        if (error) {
            console.log(`  ERROR looking up "${slug}": ${error.message}`);
            fail++;
            continue;
        }
        if (!data || data.length === 0) {
            console.log(`  NOT FOUND: ${slug}`);
            fail++;
            continue;
        }
        
        const row = data[0];
        console.log(`  ✓ deactivate: "${row.name}" | slug=${slug} | keeping=${keeping}`);

        const { error: upErr } = await supabase
            .from('entity')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', row.id);
        
        if (upErr) {
            console.log(`    FAILED: ${upErr.message}`);
            fail++;
        } else {
            ok++;
        }
    }

    console.log('\n' + '═'.repeat(70));
    console.log(`DEACTIVATED: ${ok}  FAILED: ${fail}`);
    console.log('═'.repeat(70));
}

run();
