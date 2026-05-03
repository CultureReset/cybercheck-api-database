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
        .eq('is_active', true)
        .gte('updated_at', '2026-04-24T19:00:00');

    const subtypes = {};
    for (const e of data) {
        if (!subtypes[e.entity_subtype]) subtypes[e.entity_subtype] = [];
        subtypes[e.entity_subtype].push(e.name);
    }

    console.log(`57 active entities touched today, grouped by subtype:\n`);
    for (const [st, names] of Object.entries(subtypes).sort((a,b) => b[1].length - a[1].length)) {
        console.log(`\n${st} (${names.length}):`);
        names.forEach(n => console.log(`  • ${n}`));
    }
}

run();
