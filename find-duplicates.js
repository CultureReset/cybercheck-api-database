require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

function isTest(e) {
    const s = (e.slug || '').toLowerCase();
    return s.startsWith('gcr-upload-test') ||
           s.startsWith('gcr-sections-test') ||
           s.startsWith('gcr-toggle-test') ||
           s.startsWith('gcr-section-flow-test') ||
           s.startsWith('gcr-items-test') ||
           s.startsWith('gcr-events-test') ||
           s.startsWith('gcr-tags-test') ||
           s.startsWith('gcr-') && s.includes('-test-');
}

async function run() {
    const { data, error } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype, city, is_active, created_at')
        .order('name');

    if (error) { console.error(error); return; }

    // Filter out obvious test entities
    const real = data.filter(e => !isTest(e));
    const testRows = data.filter(e => isTest(e));

    const byName = {};
    for (const e of real) {
        const key = (e.name || '').trim().toLowerCase();
        if (!key) continue;
        if (!byName[key]) byName[key] = [];
        byName[key].push(e);
    }

    const dupes = Object.entries(byName).filter(([_, arr]) => arr.length > 1);
    console.log(`Total entities: ${data.length}`);
    console.log(`Test-slug entities: ${testRows.length}`);
    console.log(`Real entities: ${real.length}`);
    console.log(`Real names with duplicates: ${dupes.length}`);
    console.log(`Real duplicate rows: ${dupes.reduce((s, [_, a]) => s + a.length, 0)}`);
    console.log('');

    dupes.sort((a, b) => b[1].length - a[1].length);
    for (const [_, arr] of dupes) {
        console.log(`\n"${arr[0].name}" (${arr.length} copies):`);
        for (const e of arr) {
            console.log(`  id=${e.id.slice(0,8)}  subtype=${e.entity_subtype || '—'}  city=${e.city||'—'}  slug=${e.slug}  active=${e.is_active}  created=${(e.created_at||'').slice(0,10)}`);
        }
    }
}

run();
