require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const DRY_RUN = process.argv.includes('--apply') ? false : true;

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (use --apply to commit) ===\n' : '=== APPLYING ===\n');

    const { data, error } = await supabase
        .from('entity')
        .select('id, name, slug, city, is_active')
        .or('name.ilike.%mcdonalds%,name.ilike.%mcdonald\'s%,slug.ilike.%mcdonalds%')
        .eq('is_active', true);

    if (error) { console.error(error); return; }

    console.log(`Found ${data.length} active McDonald's entries:\n`);
    data.forEach(e => console.log(`  • ${e.name} (${e.city || '—'}) | slug=${e.slug}`));

    if (DRY_RUN) {
        console.log(`\nWould deactivate ${data.length} entities. Run with --apply to commit.`);
        return;
    }

    let ok = 0, fail = 0;
    for (const e of data) {
        const { error: upErr } = await supabase
            .from('entity')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', e.id);
        if (upErr) { console.log(`  FAIL ${e.slug}: ${upErr.message}`); fail++; }
        else ok++;
    }
    console.log(`\n✓ Deactivated: ${ok}  Failed: ${fail}`);
}

run();
