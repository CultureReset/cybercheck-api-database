require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const DRY_RUN = process.argv.includes('--apply') ? false : true;

// Each entry: the slug to deactivate, and the slug we're keeping (for reference)
const DEACTIVATE = [
    { slug: 'happy-harbor',                           keeping: 'happy-harbor-marina' },
    { slug: 'orange-beach-tritoon-rental',            keeping: 'orange-beach-tritoon-boat-rental' },
    { slug: 'flora-bama',                             keeping: 'flora-bama-lounge' },
    { slug: 'tiki-orange-beach',                      keeping: 'tiki-and-raw-bar-orange-beach' },
    { slug: 'seansuds',                               keeping: 'sea-n-suds' },
    { slug: 'cobaltrestaurant',                       keeping: 'cobalt-the-restaurant' },
];

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (use --apply to commit) ===' : '=== APPLYING CHANGES ===');
    console.log('');

    let ok = 0, fail = 0, notFound = 0;
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
            notFound++;
            continue;
        }
        const row = data[0];
        if (row.is_active === false) {
            console.log(`  already inactive: ${row.name} (${slug})`);
            continue;
        }
        console.log(`  deactivate: "${row.name}" | slug=${slug} | keeping=${keeping}`);

        if (!DRY_RUN) {
            const { error: upErr } = await supabase
                .from('entity')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', row.id);
            if (upErr) { console.log(`    FAILED: ${upErr.message}`); fail++; }
            else ok++;
        }
    }
    console.log('');
    if (DRY_RUN) console.log('Dry run complete. Run with --apply to commit.');
    else console.log(`Updated: ${ok}  Failed: ${fail}  NotFound: ${notFound}`);
}

run();
