require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

async function run() {
    // Find the right tables — entity_section, group, item or similar
    const candidates = ['entity_section', 'section', 'section_group', 'section_item', 'group_item'];
    for (const t of candidates) {
        const { data, error } = await supabase.from(t).select('*').limit(1);
        if (error) console.log(`  ${t}: NOT FOUND`);
        else console.log(`  ${t}: EXISTS — sample columns: ${data[0] ? Object.keys(data[0]).join(', ') : '(empty)'}`);
    }
}

run();
