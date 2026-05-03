require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    const tables = ['menu', 'menu_item', 'menu_section', 'item', 'product', 'offering', 'package', 'tour', 'rental', 'price'];
    for (const t of tables) {
        const { data, error } = await supabase.from(t).select('id').limit(5);
        if (error) console.log(`  ${t}: ERROR (${error.message})`);
        else console.log(`  ${t}: ${data.length} rows (showing up to 5)`);
    }
    
    // Also check menu_item structure
    const { data: sample } = await supabase.from('menu_item').select('*').limit(3);
    if (sample && sample.length) {
        console.log('\nmenu_item sample:');
        console.log(JSON.stringify(sample, null, 2));
    }
}

run();
