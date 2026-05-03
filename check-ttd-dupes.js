require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

function normalizeName(s) {
    return String(s || '').toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const TTD_SUBTYPES = ['jet-ski-rentals-tours', 'activity', 'attraction', 'tour', 'rental', 'helicopter-airplane-tours'];

async function run() {
    const { data } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype, is_active, created_at')
        .eq('is_active', true)
        .in('entity_subtype', TTD_SUBTYPES)
        .order('name');

    // Group by normalized name
    const byName = {};
    data.forEach(e => {
        const k = normalizeName(e.name);
        if (!byName[k]) byName[k] = [];
        byName[k].push(e);
    });

    const dupes = Object.entries(byName).filter(([_, arr]) => arr.length > 1);
    console.log(`Total active Things To Do entities: ${data.length}`);
    console.log(`Duplicate name groups: ${dupes.length}\n`);

    if (dupes.length === 0) {
        console.log('✅ No duplicates found!');
        return;
    }

    dupes.forEach(([name, arr]) => {
        console.log(`⚠️ "${arr[0].name}" — ${arr.length} copies:`);
        arr.forEach(e => {
            console.log(`    • slug=${e.slug} | subtype=${e.entity_subtype} | created=${e.created_at?.slice(0,10)}`);
        });
        console.log('');
    });
}

run();
