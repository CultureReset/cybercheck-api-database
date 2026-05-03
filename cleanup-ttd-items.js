require('dotenv').config({ path: '/Users/owner/cybercheck-api-database/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.GCR_SUPABASE_URL,
    process.env.GCR_SUPABASE_KEY
);

const TTD_SUBTYPES = ['jet-ski-rentals-tours', 'activity', 'attraction', 'tour', 'rental'];
const DRY_RUN = process.argv.includes('--apply') ? false : true;

async function fetchAll(table, cols) {
    const all = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
        const { data, error } = await supabase.from(table).select(cols).range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return all;
}

function extractNameFromDescription(desc, businessName) {
    if (!desc) return null;
    let s = desc.trim();
    if (businessName) {
        const idx = s.toLowerCase().indexOf(businessName.toLowerCase());
        if (idx > 0) s = s.slice(0, idx).replace(/[—\-–:|]\s*$/, '').trim();
    }
    return s.slice(0, 80) || null;
}

async function run() {
    console.log(DRY_RUN ? '=== DRY RUN (use --apply to commit) ===\n' : '=== APPLYING CHANGES ===\n');

    const entities = await fetchAll('entity', 'id, name, slug, entity_subtype, is_active');
    const ttdEntities = entities.filter(e => e.is_active && TTD_SUBTYPES.includes(e.entity_subtype));
    const ttdIds = new Set(ttdEntities.map(e => e.id));
    const nameById = {};
    ttdEntities.forEach(e => nameById[e.id] = e.name);

    const allItems = await fetchAll('menu_items', 'id, entity_id, item_name, description, price, price_text');
    const ttdItems = allItems.filter(i => ttdIds.has(i.entity_id));

    console.log(`Found ${ttdItems.length} items across ${ttdEntities.length} Things To Do businesses\n`);

    // STEP 1: Backfill item_name from description where missing
    const toNameUpdate = [];
    for (const item of ttdItems) {
        if (!item.item_name || !item.item_name.trim()) {
            const extracted = extractNameFromDescription(item.description, nameById[item.entity_id]);
            if (extracted) {
                toNameUpdate.push({ id: item.id, item_name: extracted, was: item.description });
            }
        }
    }
    console.log(`STEP 1: Backfill missing item_name from description`);
    console.log(`  Items needing name backfill: ${toNameUpdate.length}\n`);
    if (toNameUpdate.length > 0 && toNameUpdate.length <= 20) {
        toNameUpdate.forEach(u => console.log(`    "${u.was?.slice(0, 60)}" → name="${u.item_name}"`));
    } else if (toNameUpdate.length > 20) {
        toNameUpdate.slice(0, 5).forEach(u => console.log(`    "${u.was?.slice(0, 60)}" → name="${u.item_name}"`));
        console.log(`    ... and ${toNameUpdate.length - 5} more`);
    }

    // STEP 2: Find duplicates (same entity_id + same description + same price)
    const seen = new Map();
    const toDelete = [];
    for (const item of ttdItems) {
        const key = `${item.entity_id}|${(item.description || '').trim()}|${item.price || ''}|${item.price_text || ''}`;
        if (seen.has(key)) {
            toDelete.push({ id: item.id, key, name: item.item_name || item.description?.slice(0, 60) });
        } else {
            seen.set(key, item.id);
        }
    }
    console.log(`\nSTEP 2: Remove duplicates (same entity + same description + same price)`);
    console.log(`  Duplicates to delete: ${toDelete.length}\n`);
    if (toDelete.length > 0 && toDelete.length <= 20) {
        toDelete.forEach(d => console.log(`    DELETE id=${d.id.slice(0, 8)} | "${d.name}"`));
    } else if (toDelete.length > 20) {
        toDelete.slice(0, 5).forEach(d => console.log(`    DELETE id=${d.id.slice(0, 8)} | "${d.name}"`));
        console.log(`    ... and ${toDelete.length - 5} more`);
    }

    if (DRY_RUN) {
        console.log('\n══════════════════════════════════════════════════════════════════════');
        console.log(`DRY RUN: would update ${toNameUpdate.length} names + delete ${toDelete.length} duplicates`);
        console.log('Run with --apply to commit.');
        console.log('══════════════════════════════════════════════════════════════════════');
        return;
    }

    // APPLY
    let nameOk = 0, nameFail = 0;
    for (const u of toNameUpdate) {
        const { error } = await supabase
            .from('menu_items')
            .update({ item_name: u.item_name })
            .eq('id', u.id);
        if (error) { nameFail++; console.log(`  Name FAIL ${u.id}: ${error.message}`); }
        else nameOk++;
    }

    let delOk = 0, delFail = 0;
    for (const d of toDelete) {
        const { error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', d.id);
        if (error) { delFail++; console.log(`  Delete FAIL ${d.id}: ${error.message}`); }
        else delOk++;
    }

    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log(`Names backfilled: ${nameOk} OK / ${nameFail} failed`);
    console.log(`Duplicates removed: ${delOk} OK / ${delFail} failed`);
    console.log('══════════════════════════════════════════════════════════════════════');
}

run();
