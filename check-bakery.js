require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    const { data } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype, is_active')
        .ilike('name', '%specialty bakery%');

    console.log('A Specialty Bakery records:');
    data.forEach(e => console.log(`  ${e.name} | subtype=${e.entity_subtype} | active=${e.is_active} | slug=${e.slug}`));
}

run();
