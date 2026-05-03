require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    // Recently updated TTD entities
    const { data } = await supabase
        .from('entity')
        .select('name, slug, entity_subtype, is_active, updated_at, created_at')
        .in('entity_subtype', ['jet-ski-rentals-tours', 'activity', 'attraction', 'tour', 'rental', 'helicopter-airplane-tours'])
        .order('updated_at', { ascending: false })
        .limit(30);

    console.log('Most recently touched TTD entities:\n');
    data.forEach(e => console.log(`  ${e.updated_at?.slice(0,16)} | active=${e.is_active} | ${e.name} (${e.entity_subtype})`));
}

run();
