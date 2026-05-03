require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    // All entities touched today
    const { data } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype, is_active, updated_at')
        .gte('updated_at', '2026-04-24T19:00:00')
        .order('updated_at', { ascending: false });

    const active = data.filter(e => e.is_active);
    const inactive = data.filter(e => !e.is_active);
    
    console.log(`Active entities touched today: ${active.length}`);
    console.log(`Inactive entities touched today: ${inactive.length}\n`);

    console.log('INACTIVE entities touched today (could be reactivated):');
    inactive.forEach(e => console.log(`  • ${e.name} | subtype=${e.entity_subtype} | slug=${e.slug}`));
}

run();
