require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    const { count: deactivated, error: e1 } = await supabase
        .from('entity')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', false);

    const { count: active, error: e2 } = await supabase
        .from('entity')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

    const { count: total, error: e3 } = await supabase
        .from('entity')
        .select('id', { count: 'exact', head: true });

    console.log(`ACTIVE: ${active}`);
    console.log(`DEACTIVATED: ${deactivated}`);
    console.log(`TOTAL: ${total}`);
    
    const { data } = await supabase
        .from('entity')
        .select('id, name, slug')
        .eq('is_active', false)
        .order('name');
    
    console.log(`\n=== DEACTIVATED ENTITIES ===`);
    (data || []).forEach(e => {
        console.log(`  • ${e.name} (${e.slug})`);
    });
}

run().catch(console.error);
