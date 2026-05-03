require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const DRY_RUN = process.argv.includes('--apply') ? false : true;

// Slugs that should stay deactivated (intentional duplicates)
const KEEP_INACTIVE = ['happy-harbor'];

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (use --apply to commit) ===\n' : '=== APPLYING ===\n');

    const { data, error } = await supabase
        .from('entity')
        .select('id, name, slug, entity_subtype')
        .eq('is_active', false)
        .in('entity_subtype', ['jet-ski-rentals-tours', 'activity', 'attraction', 'tour', 'rental', 'helicopter-airplane-tours'])
        .gte('updated_at', '2026-04-24T00:00:00')
        .order('name');

    if (error) { console.error(error); return; }

    const toReactivate = data.filter(e => !KEEP_INACTIVE.includes(e.slug));

    console.log(`Reactivating ${toReactivate.length} Things To Do entities:\n`);
    toReactivate.forEach(e => console.log(`  • ${e.name} (${e.slug})`));

    if (DRY_RUN) {
        console.log(`\nRun with --apply to commit.`);
        return;
    }

    let ok = 0, fail = 0;
    for (const e of toReactivate) {
        const { error: upErr } = await supabase
            .from('entity')
            .update({ is_active: true, updated_at: new Date().toISOString() })
            .eq('id', e.id);
        if (upErr) { console.log(`  FAIL ${e.slug}: ${upErr.message}`); fail++; }
        else ok++;
    }

    console.log(`\n✓ Reactivated: ${ok}  Failed: ${fail}`);
}

run();
