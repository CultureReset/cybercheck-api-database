require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const UPDATES = [
    // Restaurant → Coffee & Sweets
    { name: 'A Specialty Bakery and Party Shoppe', subtype: 'bakery' },
    { name: 'Anchored Coffee House', subtype: 'coffee_shop' },
    { name: 'Badass Coffee', subtype: 'coffee_shop' },
    { name: 'BuzzCatz Coffee & Sweets', subtype: 'coffee_shop' },
    { name: 'City Donut', subtype: 'bakery' },
    { name: 'Happy Pappys Coffee', subtype: 'coffee_shop' },
    { name: 'Haze Coffee Company', subtype: 'coffee_shop' },
    { name: 'Parlor Doughnuts', subtype: 'bakery' },
    { name: 'The Southern Grind Coffee House', subtype: 'coffee_shop' },
    { name: 'Treehouse Cafe', subtype: 'cafe' },
    { name: 'Walmart Bakery - Orange Beach', subtype: 'bakery' },

    // Shopping → Services
    { name: 'Angel Hair Salon & Boutique', subtype: 'salon' },
    { name: 'Nail Boutique and Spa', subtype: 'salon' },
    { name: 'Rustic Beauty Salon', subtype: 'salon' },
    { name: 'Sun Kissed Hair Salon & Boutique', subtype: 'salon' },
    { name: 'The Dirty Rebel Barbershop and Grooming Lounge', subtype: 'salon' },

    // Shopping → Coffee & Sweets
    { name: 'Black Cafe and Bookstore', subtype: 'cafe' },
    { name: 'Bodacious Bookstore and Cafe', subtype: 'cafe' },
    { name: 'Chocolate Corner & Ice Cream', subtype: 'bakery' },

    // Shopping → Things To Do
    { name: 'JET SKI AND BOAT RENTA GALLERY', subtype: 'jet-ski-rentals-tours' },
];

const DRY_RUN = process.argv.includes('--apply') ? false : true;

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (pass --apply to actually update) ===' : '=== APPLYING UPDATES ===');
    console.log('');

    let matched = 0;
    let updated = 0;
    let notFound = [];
    let multiMatch = [];

    for (const { name, subtype } of UPDATES) {
        const { data, error } = await supabase
            .from('entity')
            .select('id, name, entity_subtype')
            .eq('name', name);

        if (error) {
            console.log(`  ERROR looking up "${name}": ${error.message}`);
            continue;
        }

        if (!data || data.length === 0) {
            notFound.push(name);
            console.log(`  NOT FOUND: "${name}"`);
            continue;
        }

        if (data.length > 1) {
            multiMatch.push({ name, count: data.length });
            console.log(`  MULTIPLE MATCHES for "${name}" (${data.length}) — skipping`);
            continue;
        }

        matched++;
        const row = data[0];
        console.log(`  ${row.entity_subtype} -> ${subtype}  |  ${row.name}`);

        if (!DRY_RUN) {
            const { error: upErr } = await supabase
                .from('entity')
                .update({ entity_subtype: subtype, updated_at: new Date().toISOString() })
                .eq('id', row.id);
            if (upErr) {
                console.log(`    UPDATE FAILED: ${upErr.message}`);
            } else {
                updated++;
            }
        }
    }

    console.log('');
    console.log(`Matched: ${matched} / ${UPDATES.length}`);
    if (notFound.length) console.log(`Not found: ${notFound.length}`);
    if (multiMatch.length) console.log(`Skipped (multi-match): ${multiMatch.length}`);
    if (!DRY_RUN) console.log(`Actually updated: ${updated}`);
    console.log('');
    if (DRY_RUN) console.log('Run with --apply to commit changes.');
}

run();
