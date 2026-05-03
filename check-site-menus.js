require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    // Try menu_items with site_id
    const { data, error } = await supabase
        .from('menu_items')
        .select('id, site_id, entity_id, name, price')
        .limit(5);
    
    console.log('menu_items sample:');
    console.log(error ? 'ERROR: ' + error.message : JSON.stringify(data, null, 2));
    
    // Get total count
    const { count } = await supabase.from('menu_items').select('*', { count: 'exact', head: true });
    console.log(`\nTotal menu_items: ${count}`);
    
    // Distinct site_ids
    const { data: all } = await supabase.from('menu_items').select('site_id, entity_id, price');
    if (all) {
        const sites = new Set(all.map(i => i.site_id).filter(Boolean));
        const ents = new Set(all.map(i => i.entity_id).filter(Boolean));
        const withPrice = all.filter(i => i.price && i.price > 0).length;
        console.log(`Distinct site_ids: ${sites.size}`);
        console.log(`Distinct entity_ids: ${ents.size}`);
        console.log(`Items with price > 0: ${withPrice}`);
    }
}

run();
