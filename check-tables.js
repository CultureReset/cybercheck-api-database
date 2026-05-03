require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    // Check what columns exist on a real entity
    const { data: entities } = await supabase
        .from('entity')
        .select('*')
        .eq('slug', 'cobalt-the-restaurant')
        .limit(1);
    
    if (entities && entities[0]) {
        console.log('Entity columns for Cobalt:');
        console.log(Object.keys(entities[0]).join(', '));
        console.log('\n---');
        // Print non-null values for a sense of what data exists
        for (const [k, v] of Object.entries(entities[0])) {
            if (v !== null && v !== undefined && v !== '') {
                const preview = typeof v === 'string' ? v.slice(0, 80) : 
                               typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : v;
                console.log(`  ${k}: ${preview}`);
            }
        }
    }

    // Check known related tables
    console.log('\n=== Checking related tables ===');
    const tables = ['menu', 'menu_item', 'menu_section', 'item', 'product', 'offering', 'package', 'tour', 'rental', 'price'];
    for (const t of tables) {
        const { data, error, count } = await supabase
            .from(t)
            .select('*', { count: 'exact', head: true });
        if (error) console.log(`  ${t}: NOT FOUND (${error.message})`);
        else console.log(`  ${t}: exists (${count} rows)`);
    }
}

run();
