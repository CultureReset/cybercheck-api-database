require('dotenv').config();
const supabase = require('./db');

async function run() {
    console.log('\n=== CIRCLE BOATS BUSINESS RECORD ===\n');

    // Find circle boats business
    const { data: businesses, error } = await supabase
        .from('businesses')
        .select('site_id, name, subdomain, domain, status, type')
        .or('name.ilike.%circle%,name.ilike.%beachside%,subdomain.ilike.%circle%,domain.ilike.%circle%,domain.ilike.%beachside%');

    if (error) {
        console.error('Error fetching businesses:', error.message);
        process.exit(1);
    }

    if (!businesses || businesses.length === 0) {
        console.log('No matching business found. Listing ALL businesses:\n');
        const { data: all } = await supabase
            .from('businesses')
            .select('site_id, name, subdomain, domain, status, type')
            .order('name');
        console.table(all);
        process.exit(0);
    }

    console.table(businesses);

    // For each match, check site_content domain config
    for (const biz of businesses) {
        console.log(`\n--- ${biz.name} (site_id: ${biz.site_id}) ---`);
        console.log(`  subdomain : ${biz.subdomain || '(not set)'}`);
        console.log(`  domain    : ${biz.domain || '(not set) <-- THIS IS THE PROBLEM IF EMPTY'}`);
        console.log(`  status    : ${biz.status}`);

        if (!biz.domain) {
            console.log('\n  FIX: Run this SQL in Supabase to set the domain:');
            console.log(`  UPDATE businesses SET domain = 'beachsidecircleboats.com' WHERE site_id = '${biz.site_id}';\n`);
        }
    }

    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
