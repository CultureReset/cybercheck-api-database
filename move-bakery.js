require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    const { error } = await supabase
        .from('entity')
        .update({ entity_subtype: 'bakery', updated_at: new Date().toISOString() })
        .eq('slug', 'a-specialty-bakery');
    
    if (error) { console.log('Error:', error.message); return; }
    console.log('✓ Moved "A Specialty Bakery and Party Shoppe" → Coffee & Sweets (bakery)');

    const { data } = await supabase
        .from('entity')
        .select('name, slug, entity_subtype, is_active')
        .ilike('name', '%specialty bakery%');
    
    console.log('\nFinal state:');
    data.forEach(e => console.log(`  ${e.name} | subtype=${e.entity_subtype} | active=${e.is_active}`));
}

run();
